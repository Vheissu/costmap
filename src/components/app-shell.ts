import type { Category, Expense, Period, TreemapItem } from '../types';
import { createShadowRoot } from '../app/dom';
import { CURRENCIES, escapeHtml, formatMoney, formatPercent, PERIOD_LABEL } from '../app/format';
import { generateRecommendations, topSavings } from '../app/services/recommendations';
import { toPeriod } from '../app/services/yearly';
import { BACKUP_VERSION, buildCsv, parseBackup, type BackupPayload } from '../app/services/backup';
import { DEFAULT_CATEGORIES, mergeWithDefaults, store, yearlyOf, type AppState } from '../app/store';
import {
  addCategory,
  addExpenses,
  closeExpenseForm,
  openNewExpense,
  replaceAllData,
  saveExpense,
  saveSettings,
  takeDraft
} from '../app/actions';
import { buildSampleExpenses } from '../app/sample';
import { showToast } from './ui/toast';
import type { DrawerView } from './detail-drawer';
import type { FormOpenOptions, FormSubmitDetail } from './expense-form';
import './expense-form';
import './expense-list';
import './treemap-view';
import './detail-drawer';
import './ui/toast';

type TreemapElement = HTMLElement & {
  data: TreemapItem[];
  selectedId: string | null;
  highlightCategory: string | null;
  currency: string;
  period: Period;
};
type FormElement = HTMLElement & { openWith(options: FormOpenOptions): void; close(): void; isOpen: boolean };
type DrawerElement = HTMLElement & { view: DrawerView | null };
type ListElement = HTMLElement & { focusSearch(): void };

const PERIODS: Period[] = ['year', 'month', 'week'];

const logo = `
  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 32 32">
    <rect x="3" y="3" width="15" height="17" fill="#E0A526"/>
    <rect x="19.5" y="3" width="9.5" height="10" fill="#3B78C2"/>
    <rect x="19.5" y="14.5" width="9.5" height="5.5" fill="#1F9E8F"/>
    <rect x="3" y="21.5" width="10" height="7.5" fill="#C8432F"/>
    <rect x="14.5" y="21.5" width="14.5" height="7.5" fill="#3E9B57"/>
  </svg>`;

const download = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const isTypingTarget = (event: KeyboardEvent) =>
  event.composedPath().some((target) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  });

class AppShell extends HTMLElement {
  private container: HTMLDivElement;
  private unsubscribe: (() => void) | null = null;
  private pendingImport: { payload: BackupPayload; fileName: string; skipped: number } | null = null;
  private formWasOpen = false;

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (this.isDialogOpen()) return;
    if (isTypingTarget(event)) return;

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      openNewExpense();
    } else if (event.key === '/') {
      event.preventDefault();
      this.el<ListElement>('expense-list')?.focusSearch();
    } else if (event.key === 'Escape') {
      const state = store.getState();
      if (state.selectedExpenseId || state.selectedCategoryId) {
        event.preventDefault();
        store.setState({ selectedExpenseId: null, selectedCategoryId: null });
      }
      this.closeMenus();
    }
  };

  private handleDocumentClick = (event: MouseEvent) => {
    const menu = this.container.querySelector('details[data-menu]');
    if (menu && !event.composedPath().includes(menu)) this.closeMenus();
  };

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  connectedCallback() {
    this.render();
    this.unsubscribe = store.subscribe((state) => this.update(state));
    window.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('click', this.handleDocumentClick);
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private el<T extends Element>(selector: string) {
    return this.container.querySelector(selector) as T | null;
  }

  private isDialogOpen() {
    return (
      Boolean(this.el<FormElement>('expense-form')?.isOpen) ||
      [...this.container.querySelectorAll('dialog')].some((dialog) => dialog.open)
    );
  }

  private closeMenus() {
    this.container.querySelectorAll('details[data-menu]').forEach((menu) => menu.removeAttribute('open'));
  }

  // ---------------------------------------------------------------- import/export

  private exportJson() {
    const state = store.getState();
    const payload: BackupPayload = {
      version: BACKUP_VERSION,
      exportDate: new Date().toISOString(),
      expenses: state.expenses,
      categories: state.categories,
      settings: store.settings
    };
    download(
      `doughmap-backup-${payload.exportDate.slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast('Backup downloaded');
  }

  private exportCsv() {
    const state = store.getState();
    download(
      `doughmap-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(state.expenses, state.categories),
      'text/csv;charset=utf-8'
    );
    showToast('Spreadsheet downloaded');
  }

  private async readImportFile(file: File) {
    let result: ReturnType<typeof parseBackup>;
    try {
      result = parseBackup(await file.text());
    } catch {
      result = { ok: false, error: 'Could not read that file.' };
    }

    const dialog = this.el<HTMLDialogElement>('#importDialog');
    const body = this.el<HTMLDivElement>('#importBody');
    if (!dialog || !body) return;

    if (!result.ok) {
      this.pendingImport = null;
      body.innerHTML = `
        <h2 class="text-xl font-bold">Couldn't import that file</h2>
        <p class="mt-2 text-ink-soft">${escapeHtml(result.error)}</p>
        <div class="mt-6 flex justify-end"><button type="button" class="btn-primary" data-close>OK</button></div>`;
    } else {
      this.pendingImport = { payload: result.payload, fileName: file.name, skipped: result.skipped };
      const { expenses, categories, exportDate } = result.payload;
      const date = new Date(exportDate);
      const hasData = store.getState().expenses.length > 0;
      body.innerHTML = `
        <h2 class="text-xl font-bold">Import backup</h2>
        <p class="mt-1 break-all text-sm text-ink-soft">${escapeHtml(file.name)}${
          Number.isNaN(date.getTime()) ? '' : `, saved ${escapeHtml(date.toLocaleDateString())}`
        }</p>
        <table class="figures mt-4 w-full text-[15px]"><tbody>
          <tr class="border-b border-rule"><th scope="row" class="py-1.5 text-left font-normal">Expenses</th><td class="py-1.5 text-right font-semibold">${expenses.length}</td></tr>
          <tr class="border-b border-rule"><th scope="row" class="py-1.5 text-left font-normal">Categories</th><td class="py-1.5 text-right font-semibold">${categories.length}</td></tr>
        </tbody></table>
        ${
          result.skipped
            ? `<p class="mt-3 rounded-[3px] bg-warn-wash px-3 py-2 text-sm text-warn">${result.skipped} damaged or incomplete record${result.skipped === 1 ? ' was' : 's were'} skipped.</p>`
            : ''
        }
        ${
          hasData
            ? '<p class="mt-4 text-sm text-ink-soft"><strong class="text-ink">Add</strong> keeps what you have and adds these. <strong class="text-ink">Replace</strong> deletes your current data first.</p>'
            : ''
        }
        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" class="btn-ghost" data-close>Cancel</button>
          ${
            hasData
              ? `<button type="button" class="btn-outline" data-import="merge">Add to my data</button>
                 <button type="button" class="btn-danger" data-import="replace">Replace everything</button>`
              : '<button type="button" class="btn-primary" data-import="replace">Import</button>'
          }
        </div>`;
    }
    dialog.showModal();
  }

  private async applyImport(mode: 'merge' | 'replace') {
    if (!this.pendingImport) return;
    const { payload } = this.pendingImport;
    let next = payload;
    if (mode === 'merge') {
      const state = store.getState();
      const incoming = new Map(payload.expenses.map((expense) => [expense.id, expense]));
      const kept = state.expenses.filter((expense) => !incoming.has(expense.id));
      const categoryIds = new Set(state.categories.map((category) => category.id));
      next = {
        ...payload,
        expenses: [...kept, ...payload.expenses],
        categories: [...state.categories, ...payload.categories.filter((c) => !categoryIds.has(c.id))],
        settings: undefined
      };
    }

    try {
      await replaceAllData(next, mergeWithDefaults);
      showToast(`Imported ${payload.expenses.length} expense${payload.expenses.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error(error);
      showToast('Import failed. Your existing data was not changed.');
    }
    this.pendingImport = null;
    this.el<HTMLDialogElement>('#importDialog')?.close();
  }

  private async eraseEverything() {
    try {
      await replaceAllData(
        { version: BACKUP_VERSION, exportDate: '', expenses: [], categories: DEFAULT_CATEGORIES },
        mergeWithDefaults
      );
      showToast('All data deleted');
    } catch (error) {
      console.error(error);
      showToast("Couldn't delete your data. Try again.");
    }
    this.el<HTMLDialogElement>('#eraseDialog')?.close();
  }

  // ---------------------------------------------------------------- render

  private render() {
    const { currency } = store.getState();
    const currencies = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

    this.container.innerHTML = `
      <div class="mx-auto max-w-[1440px] px-4 pb-10 sm:px-6 lg:px-8">
        <header class="flex items-center justify-between gap-3 border-b border-rule-strong py-3">
          <a href="/" class="flex items-center gap-2 text-xl font-extrabold text-ink no-underline">${logo}Doughmap</a>
          <div class="flex items-center gap-2">
            <details data-menu class="relative">
              <summary class="btn-outline cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span class="sm:hidden">Data</span><span class="hidden sm:inline">Your data</span>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
              </summary>
              <div class="absolute right-0 z-30 mt-1 w-60 rounded-[3px] border border-rule-strong bg-raised py-1 shadow-sheet" role="menu">
                <button type="button" role="menuitem" class="block w-full px-3 py-2 text-left text-sm hover:bg-sunk" data-menu-action="import">Import a backup…</button>
                <button type="button" role="menuitem" class="block w-full px-3 py-2 text-left text-sm hover:bg-sunk" data-menu-action="export-json">Download backup (.json)</button>
                <button type="button" role="menuitem" class="block w-full px-3 py-2 text-left text-sm hover:bg-sunk" data-menu-action="export-csv">Download spreadsheet (.csv)</button>
                <hr class="my-1 border-rule" />
                <button type="button" role="menuitem" class="block w-full px-3 py-2 text-left text-sm text-red hover:bg-sunk" data-menu-action="erase">Delete all data…</button>
              </div>
            </details>
            <button type="button" class="btn-primary" data-action="add">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              <span>Add<span class="hidden sm:inline"> expense</span></span>
            </button>
          </div>
        </header>

        <p id="storageWarning" class="mt-3 hidden rounded-[3px] bg-warn-wash px-3 py-2 text-sm text-warn">
          This browser isn't letting Doughmap save data, so changes will be lost when you close the tab. Use <strong>Your data → Download backup</strong> to keep a copy.
        </p>

        <section aria-labelledby="totalLabel" class="mt-6 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p id="totalLabel" class="text-sm font-semibold text-ink-soft">You pay</p>
            <p class="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span id="total" class="figures total-rule text-5xl font-extrabold leading-tight sm:text-6xl">–</span>
              <span id="totalSuffix" class="text-xl font-semibold text-ink-soft"></span>
            </p>
            <p id="totalAlt" class="figures mt-3 text-[15px] text-ink-soft"></p>
          </div>
          <div class="flex flex-wrap items-center gap-3 md:justify-end">
            <div class="segmented" role="group" aria-label="Show amounts per">
              ${PERIODS.map(
                (period) => `<button type="button" data-period="${period}" aria-pressed="false">${PERIOD_LABEL[period]}</button>`
              ).join('')}
            </div>
            <label class="flex items-center gap-2 text-sm text-ink-soft">
              Currency
              <select id="currency" class="field w-auto py-1 text-sm">
                ${currencies.map((code) => `<option value="${code}">${code}</option>`).join('')}
              </select>
            </label>
          </div>
        </section>

        <dl id="stats" class="figures mt-5 grid grid-cols-2 border-y border-rule-strong sm:grid-cols-4"></dl>

        <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <section aria-label="Cost map" class="min-w-0">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="segmented" role="group" aria-label="Map shows">
                <button type="button" data-group="false" aria-pressed="true">Each expense</button>
                <button type="button" data-group="true" aria-pressed="false">By category</button>
              </div>
              <label id="oneOffToggle" class="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <input id="includeOneOffs" type="checkbox" class="h-4 w-4 accent-[var(--ink)]" />
                <span>Include one-off costs <span id="oneOffCount"></span></span>
              </label>
            </div>

            <div class="relative mt-3 h-[clamp(320px,62vh,640px)]">
              <treemap-view class="block h-full w-full"></treemap-view>
              <div id="emptyState" class="absolute inset-0 hidden"></div>
            </div>

            <ul id="legend" class="mt-4 flex flex-wrap gap-x-1 gap-y-1" aria-label="Categories"></ul>

            <section id="savings" class="mt-10 hidden" aria-labelledby="savingsTitle">
              <div class="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-1">
                <h2 id="savingsTitle" class="text-lg font-bold">Where you could pay less</h2>
                <p id="savingsTotal" class="figures text-sm text-ink-soft"></p>
              </div>
              <ol id="savingsList" class="divide-y divide-rule"></ol>
            </section>
          </section>

          <aside class="min-w-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)] lg:self-start">
            <expense-list class="block h-full"></expense-list>
          </aside>
        </div>

        <footer class="mt-12 flex flex-wrap justify-between gap-3 border-t border-rule-strong pt-4 text-sm text-ink-soft">
          <p>Your data stays in this browser. Nothing is uploaded anywhere.</p>
          <p class="hidden sm:block">Shortcuts: <kbd class="font-semibold text-ink">N</kbd> add · <kbd class="font-semibold text-ink">/</kbd> search · <kbd class="font-semibold text-ink">Esc</kbd> close</p>
        </footer>
      </div>

      <expense-form></expense-form>
      <detail-drawer></detail-drawer>
      <ui-toast></ui-toast>
      <input id="importFile" type="file" accept="application/json,.json" class="hidden" />

      <dialog id="importDialog" class="m-auto w-[min(100vw-1.5rem,440px)] rounded-[4px] border border-rule-strong bg-raised p-6 shadow-sheet" aria-label="Import backup">
        <div id="importBody"></div>
      </dialog>

      <dialog id="eraseDialog" class="m-auto w-[min(100vw-1.5rem,420px)] rounded-[4px] border border-rule-strong bg-raised p-6 shadow-sheet" aria-labelledby="eraseTitle">
        <h2 id="eraseTitle" class="text-xl font-bold">Delete all data?</h2>
        <p class="mt-2 text-ink-soft">Every expense and custom category in this browser will be removed. This can't be undone, so download a backup first if you might want it back.</p>
        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" class="btn-ghost" data-close>Cancel</button>
          <button type="button" class="btn-outline" data-menu-action="export-json">Download backup</button>
          <button type="button" class="btn-danger" data-erase>Delete everything</button>
        </div>
      </dialog>
    `;

    this.wire();
  }

  private wire() {
    const c = this.container;
    const importFile = this.el<HTMLInputElement>('#importFile');

    c.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;

      const menuAction = target.closest<HTMLElement>('[data-menu-action]')?.dataset.menuAction;
      if (menuAction) {
        this.closeMenus();
        if (menuAction === 'import') importFile?.click();
        if (menuAction === 'export-json') this.exportJson();
        if (menuAction === 'export-csv') this.exportCsv();
        if (menuAction === 'erase') this.el<HTMLDialogElement>('#eraseDialog')?.showModal();
        return;
      }

      if (target.closest('[data-action="add"]')) openNewExpense();
      if (target.closest('[data-action="sample"]')) {
        addExpenses(buildSampleExpenses());
        showToast('Sample data added. Delete it any time from Your data.');
      }
      if (target.closest('[data-action="show-one-offs"]')) saveSettings({ includeOneOffs: true });

      const period = target.closest<HTMLElement>('[data-period]')?.dataset.period as Period | undefined;
      if (period) saveSettings({ period });

      const group = target.closest<HTMLElement>('[data-group]')?.dataset.group;
      if (group) {
        saveSettings({ groupByCategory: group === 'true', selectedExpenseId: null, selectedCategoryId: null });
      }

      const legend = target.closest<HTMLElement>('[data-legend]')?.dataset.legend;
      if (legend) store.setState({ selectedCategoryId: legend, selectedExpenseId: null });

      const saving = target.closest<HTMLElement>('[data-saving]')?.dataset.saving;
      if (saving) store.setState({ selectedExpenseId: saving, selectedCategoryId: null });

      const importMode = target.closest<HTMLElement>('[data-import]')?.dataset.import as 'merge' | 'replace' | undefined;
      if (importMode) void this.applyImport(importMode);
      if (target.closest('[data-erase]')) void this.eraseEverything();
      if (target.closest('[data-close]')) target.closest('dialog')?.close();
    });

    // Close dialogs when their backdrop is clicked.
    c.querySelectorAll('dialog').forEach((dialog) =>
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
      })
    );

    const legend = this.el<HTMLUListElement>('#legend');
    const treemap = this.el<TreemapElement>('treemap-view');
    const highlight = (event: Event) => {
      if (!treemap) return;
      const id = (event.target as HTMLElement).closest<HTMLElement>('[data-legend]')?.dataset.legend ?? null;
      treemap.highlightCategory = store.getState().groupByCategory ? null : id;
    };
    legend?.addEventListener('pointerover', highlight);
    legend?.addEventListener('focusin', highlight);
    legend?.addEventListener('pointerleave', () => treemap && (treemap.highlightCategory = null));
    legend?.addEventListener('focusout', () => treemap && (treemap.highlightCategory = null));

    this.el<HTMLSelectElement>('#currency')?.addEventListener('change', (event) => {
      saveSettings({ currency: (event.target as HTMLSelectElement).value });
    });

    this.el<HTMLInputElement>('#includeOneOffs')?.addEventListener('change', (event) => {
      saveSettings({ includeOneOffs: (event.target as HTMLInputElement).checked });
    });

    importFile?.addEventListener('change', () => {
      const file = importFile.files?.[0];
      importFile.value = '';
      if (file) void this.readImportFile(file);
    });

    treemap?.addEventListener('select-item', (event: Event) => {
      const { id, kind } = (event as CustomEvent<{ id: string; kind: 'expense' | 'category' }>).detail;
      const state = store.getState();
      if (kind === 'expense') {
        store.setState({
          selectedExpenseId: state.selectedExpenseId === id ? null : id,
          selectedCategoryId: null
        });
      } else {
        store.setState({
          selectedCategoryId: state.selectedCategoryId === id ? null : id,
          selectedExpenseId: null
        });
      }
    });

    const form = this.el<FormElement>('expense-form');
    form?.addEventListener('save-expense', (event: Event) => {
      const { expense, newCategoryName } = (event as CustomEvent<FormSubmitDetail>).detail;
      const categoryId = newCategoryName ? addCategory(newCategoryName).id : expense.categoryId;
      saveExpense({ ...expense, categoryId });
    });
    form?.addEventListener('close-form', () => {
      if (store.getState().isExpenseFormOpen) closeExpenseForm();
    });

    this.el('detail-drawer')?.addEventListener('close-drawer', () => {
      store.setState({ selectedExpenseId: null, selectedCategoryId: null });
    });
  }

  // ---------------------------------------------------------------- update

  private update(state: AppState) {
    const totalYearly = store.totalYearlyCost;
    const { currency, period } = state;
    const money = (yearly: number, p: Period = period) => formatMoney(toPeriod(yearly, p), currency);

    this.el('#storageWarning')?.classList.toggle('hidden', state.persistent);

    // Headline total
    const total = this.el<HTMLElement>('#total');
    if (total) total.textContent = money(totalYearly);
    const suffix = this.el<HTMLElement>('#totalSuffix');
    if (suffix) suffix.textContent = `a ${period}`;
    const alt = this.el<HTMLElement>('#totalAlt');
    if (alt) {
      const others = PERIODS.filter((p) => p !== period);
      alt.textContent = totalYearly > 0 ? `That's ${money(totalYearly, others[0])} a ${others[0]}, or ${money(totalYearly, others[1])} a ${others[1]}.` : '';
    }

    this.container.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.period === period));
    });
    this.container.querySelectorAll<HTMLButtonElement>('[data-group]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.group === String(state.groupByCategory)));
    });
    const currencySelect = this.el<HTMLSelectElement>('#currency');
    if (currencySelect) currencySelect.value = currency;

    const includeOneOffs = this.el<HTMLInputElement>('#includeOneOffs');
    if (includeOneOffs) includeOneOffs.checked = state.includeOneOffs;
    const oneOffCount = this.el<HTMLElement>('#oneOffCount');
    const hidden = store.hiddenOneOffCount;
    if (oneOffCount) oneOffCount.textContent = hidden ? `(${hidden} hidden)` : '';

    this.updateStats(state, totalYearly);

    // Map
    const items = store.treemapItems;
    const treemap = this.el<TreemapElement>('treemap-view');
    if (treemap) {
      treemap.currency = currency;
      treemap.period = period;
      treemap.data = items;
      treemap.selectedId = state.groupByCategory ? state.selectedCategoryId : state.selectedExpenseId;
    }
    this.updateEmptyState(state, items.length);
    this.updateLegend(state, totalYearly);
    this.updateSavings(state);

    // Form: only react to open/close transitions so typing is never clobbered.
    const form = this.el<FormElement>('expense-form');
    if (form) {
      if (state.isExpenseFormOpen && !this.formWasOpen) {
        form.openWith({
          expense: store.editingExpense,
          draft: takeDraft(),
          categories: state.categories,
          currency
        });
      } else if (!state.isExpenseFormOpen && this.formWasOpen) {
        form.close();
      }
      this.formWasOpen = state.isExpenseFormOpen;
    }

    // Drawer
    const drawer = this.el<DrawerElement>('detail-drawer');
    if (drawer) drawer.view = this.drawerView(state, totalYearly);
  }

  private updateStats(state: AppState, totalYearly: number) {
    const stats = this.el<HTMLElement>('#stats');
    if (!stats) return;
    const active = store.activeExpenses;
    const biggest = [...active].sort((a, b) => yearlyOf(b) - yearlyOf(a))[0];
    const saved = store.yearlySavings;
    const tips = topSavings(state.expenses, 50);
    const potential = tips.reduce((sum, tip) => sum + tip.rec.savingsYearly, 0);

    const cell = (label: string, value: string, extra = '') => `
      <div class="border-rule py-3 pr-3 odd:border-r sm:border-r sm:pl-4 sm:first:pl-0 sm:last:border-r-0 ${extra}">
        <dt class="text-xs font-semibold text-ink-soft">${label}</dt>
        <dd class="mt-0.5 break-words text-base font-bold sm:text-lg">${value}</dd>
      </div>`;

    stats.innerHTML = [
      cell('On the map', `${active.length} expense${active.length === 1 ? '' : 's'}`, 'pl-0'),
      cell(
        'Biggest cost',
        biggest
          ? `${escapeHtml(biggest.name)} <span class="text-sm font-semibold text-ink-soft">${formatPercent(yearlyOf(biggest) / totalYearly)}</span>`
          : '–',
        'pl-3'
      ),
      cell(
        'Saved by cancelling',
        saved > 0 ? `<span class="text-save">${formatMoney(saved, state.currency)}/yr</span>` : '–',
        'pl-0'
      ),
      cell('Could save', potential > 0 ? `up to ${formatMoney(potential, state.currency)}/yr` : '–', 'pl-3')
    ].join('');
  }

  private updateEmptyState(state: AppState, itemCount: number) {
    const empty = this.el<HTMLElement>('#emptyState');
    const treemap = this.el<HTMLElement>('treemap-view');
    if (!empty || !treemap) return;
    const show = itemCount === 0;
    empty.classList.toggle('hidden', !show);
    treemap.classList.toggle('invisible', show);
    if (!show) return;

    const hasAny = state.expenses.some((expense) => expense.status !== 'archived');
    const hidden = store.hiddenOneOffCount;

    empty.innerHTML = hasAny
      ? `
        <div class="flex h-full flex-col items-center justify-center border border-dashed border-rule-strong px-6 text-center">
          <p class="text-xl font-bold">Nothing on the map right now</p>
          <p class="mt-2 max-w-sm text-ink-soft">${
            hidden
              ? `You have ${hidden} one-off cost${hidden === 1 ? '' : 's'} hidden.`
              : 'Everything you have is marked as cancelled.'
          }</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            ${hidden ? '<button type="button" class="btn-outline" data-action="show-one-offs">Show one-off costs</button>' : ''}
            <button type="button" class="btn-primary" data-action="add">Add an expense</button>
          </div>
        </div>`
      : `
        <div class="flex h-full flex-col justify-center border border-dashed border-rule-strong px-6 py-8 sm:px-12">
          <h1 class="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">What do your bills cost in a year?</h1>
          <p class="mt-3 max-w-lg text-[17px] text-ink-soft">
            $15.99 a month doesn't sound like much. $191.88 a year might. Add your rent, bills and subscriptions,
            and each one gets a block sized by what it costs you over a year.
          </p>
          <div class="mt-6 flex flex-wrap gap-2">
            <button type="button" class="btn-primary" data-action="add">Add your first expense</button>
            <button type="button" class="btn-outline" data-action="sample">Try it with sample data</button>
          </div>
          <p class="mt-6 text-sm text-ink-faint">Everything stays in this browser. No account, nothing uploaded.</p>
        </div>`;
  }

  private updateLegend(state: AppState, totalYearly: number) {
    const legend = this.el<HTMLUListElement>('#legend');
    if (!legend) return;
    const totals = store.categoryTotals;
    legend.innerHTML = totals
      .map(
        ({ category, value }) => `
        <li>
          <button type="button" data-legend="${escapeHtml(category.id)}"
            class="figures flex items-center gap-2 rounded-[3px] px-2 py-1 text-sm hover:bg-sunk ${state.selectedCategoryId === category.id ? 'bg-sunk' : ''}">
            <span class="h-3 w-3 shrink-0 rounded-[2px]" style="background:${escapeHtml(category.color)}" aria-hidden="true"></span>
            <span class="font-semibold">${escapeHtml(category.name)}</span>
            <span class="text-ink-soft">${formatMoney(toPeriod(value, state.period), state.currency)} · ${formatPercent(totalYearly > 0 ? value / totalYearly : 0)}</span>
          </button>
        </li>`
      )
      .join('');
  }

  private updateSavings(state: AppState) {
    const section = this.el<HTMLElement>('#savings');
    const list = this.el<HTMLOListElement>('#savingsList');
    const totalEl = this.el<HTMLElement>('#savingsTotal');
    if (!section || !list || !totalEl) return;
    const tips = topSavings(state.expenses, 5);
    section.classList.toggle('hidden', tips.length === 0);
    if (!tips.length) return;

    const sum = tips.reduce((total, tip) => total + tip.rec.savingsYearly, 0);
    totalEl.textContent = `Top ${tips.length}: up to ${formatMoney(sum, state.currency)} a year`;
    list.innerHTML = tips
      .map(
        ({ expense, rec }) => `
        <li>
          <button type="button" data-saving="${escapeHtml(expense.id)}" class="figures grid w-full grid-cols-[1fr_auto] gap-x-4 py-3 text-left hover:bg-sunk">
            <span class="min-w-0">
              <span class="block font-semibold">${escapeHtml(rec.title)}</span>
              <span class="block truncate text-sm text-ink-soft">${escapeHtml(expense.name)} · ${escapeHtml(store.categoryFor(expense.categoryId).name)}</span>
            </span>
            <span class="self-center font-bold text-save">up to ${formatMoney(rec.savingsYearly, state.currency)}/yr</span>
          </button>
        </li>`
      )
      .join('');
  }

  private drawerView(state: AppState, totalYearly: number): DrawerView | null {
    const { currency, period } = state;
    const expense = store.selectedExpense;
    if (expense) {
      return {
        kind: 'expense',
        expense,
        category: store.categoryFor(expense.categoryId),
        recommendations: generateRecommendations(expense, state.expenses),
        total: totalYearly,
        currency,
        period
      };
    }
    const category = store.selectedCategory;
    if (category) {
      return {
        kind: 'category',
        category: category as Category,
        expenses: store.activeExpenses.filter(
          (item: Expense) => store.categoryFor(item.categoryId).id === category.id
        ),
        total: totalYearly,
        currency,
        period
      };
    }
    return null;
  }
}

customElements.define('app-shell', AppShell);
