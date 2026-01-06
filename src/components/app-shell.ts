import type { AppSettings, Category, Expense, Frequency } from '../types';
import { createShadowRoot } from '../app/dom';
import { formatAmount } from '../app/format';
import { generateRecommendations } from '../app/services/recommendations';
import { toYearly } from '../app/services/yearly';
import { store } from '../app/store';
import type { Database } from '../app/services/db';
import './expense-form';
import './treemap-view';
import './detail-drawer';
import './ui/button';
import './ui/modal';
import './ui/toast';

type ExportPayload = {
  version: '1.0';
  exportDate: string;
  expenses: Expense[];
  categories: Category[];
  settings?: AppSettings;
};

const QUICK_ADD: Array<{
  id: string;
  label: string;
  categoryId: string;
  frequency: Frequency;
}> = [
  { id: 'netflix', label: 'Netflix', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'hbo-max', label: 'HBO Max', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'disney-plus', label: 'Disney+', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'prime-video', label: 'Prime Video', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'hulu', label: 'Hulu', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'apple-tv', label: 'Apple TV+', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'spotify', label: 'Spotify', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'apple-music', label: 'Apple Music', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'youtube-premium', label: 'YouTube Premium', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'audible', label: 'Audible', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'kindle', label: 'Kindle Unlimited', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'xbox-game-pass', label: 'Xbox Game Pass', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'playstation-plus', label: 'PlayStation Plus', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'chatgpt', label: 'ChatGPT', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'adobe', label: 'Adobe CC', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'microsoft-365', label: 'Microsoft 365', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'google-one', label: 'Google One', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'icloud-plus', label: 'iCloud+', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'dropbox', label: 'Dropbox', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'notion', label: 'Notion', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'figma', label: 'Figma', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'canva', label: 'Canva', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'zoom', label: 'Zoom', categoryId: 'subscriptions', frequency: 'monthly' },
  { id: 'github', label: 'GitHub', categoryId: 'subscriptions', frequency: 'monthly' }
];

class AppShell extends HTMLElement {
  private container: HTMLDivElement;
  private unsubscribe: (() => void) | null = null;
  private db: Database | null = null;
  private hasRendered = false;
  private pendingImport: ExportPayload | null = null;
  private importFileName: string | null = null;
  private importError: string | null = null;
  private pendingDraft: Partial<Expense> | null = null;
  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const isTypingTarget = event
      .composedPath()
      .some((target) => {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName.toLowerCase();
        return (
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'select' ||
          target.isContentEditable
        );
      });

    if (isTypingTarget && event.key !== 'Escape') {
      return;
    }

    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      this.pendingDraft = null;
      store.setState({ isExpenseFormOpen: true });
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      store.setState({
        isExpenseFormOpen: false,
        selectedExpenseId: null,
        selectedCategoryId: null
      });
      this.updateImportModal(false);
    }
  };

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  set database(value: Database) {
    this.db = value;
  }

  connectedCallback() {
    if (!this.hasRendered) {
      this.render();
      this.hasRendered = true;
    }
    this.unsubscribe = store.subscribe((state) => this.update(state));
    window.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private persistSettings() {
    if (!this.db) return;
    const state = store.getState();
    const settings: AppSettings = {
      id: 'app-settings',
      includeOneOffs: state.includeOneOffs,
      groupByCategory: state.groupByCategory
    };
    return this.db.saveSettings(settings);
  }

  private buildExportPayload(): ExportPayload {
    const state = store.getState();
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      expenses: state.expenses,
      categories: state.categories,
      settings: {
        id: 'app-settings',
        includeOneOffs: state.includeOneOffs,
        groupByCategory: state.groupByCategory
      }
    };
  }

  private handleExport() {
    const payload = this.buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateTag = payload.exportDate.slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `doughmap-backup-${dateTag}.json`;
    link.click();
    URL.revokeObjectURL(url);
    const toast = this.container.querySelector('ui-toast') as any;
    toast?.show('Export ready');
  }

  private async handleImportFile(file: File | null) {
    if (!file) return;
    this.importError = null;
    this.pendingImport = null;
    this.importFileName = file.name;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<ExportPayload> & {
        settings?: Partial<AppSettings>;
      };

      if (data.version && data.version !== '1.0') {
        this.importError = `Unsupported backup version: ${data.version}`;
      } else if (!Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
        this.importError = 'Invalid backup file. Missing expenses or categories.';
      } else {
        const settings: AppSettings | undefined = data.settings
          ? {
              id: 'app-settings' as const,
              includeOneOffs: Boolean(data.settings.includeOneOffs),
              groupByCategory: Boolean(data.settings.groupByCategory)
            }
          : undefined;
        this.pendingImport = {
          version: '1.0',
          exportDate: data.exportDate ?? new Date().toISOString(),
          expenses: data.expenses as Expense[],
          categories: data.categories as Category[],
          settings
        };
      }
    } catch (error) {
      this.importError = 'Could not read the selected file.';
    }

    this.updateImportModal(true);
  }

  private updateImportModal(open: boolean) {
    const modal = this.container.querySelector('ui-modal#importModal') as any;
    const content = this.container.querySelector<HTMLDivElement>('#importContent');
    if (!modal || !content) return;

    modal.open = open;
    if (!open) return;

    if (this.importError) {
      content.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold text-slate-900">Import failed</h3>
          <p class="mt-2 text-sm text-slate-600">${this.importError}</p>
          <div class="mt-6 flex justify-end">
            <ui-button id="closeImport" variant="primary">Close</ui-button>
          </div>
        </div>
      `;
      const close = content.querySelector('#closeImport');
      close?.addEventListener('click', () => this.updateImportModal(false));
      return;
    }

    if (!this.pendingImport) {
      content.innerHTML = `
        <div>
          <h3 class="text-lg font-semibold text-slate-900">Import data</h3>
          <p class="mt-2 text-sm text-slate-600">Select a valid backup file to continue.</p>
          <div class="mt-6 flex justify-end">
            <ui-button id="closeImport" variant="primary">Close</ui-button>
          </div>
        </div>
      `;
      const close = content.querySelector('#closeImport');
      close?.addEventListener('click', () => this.updateImportModal(false));
      return;
    }

    const { expenses, categories, settings } = this.pendingImport;
    const oneOffCount = expenses.filter((expense) => expense.frequency === 'one_off').length;
    content.innerHTML = `
      <div>
        <h3 class="text-lg font-semibold text-slate-900">Import backup</h3>
        <p class="mt-2 text-sm text-slate-600">File: ${this.importFileName ?? 'backup.json'}</p>
        <div class="mt-4 space-y-2 text-sm text-slate-600">
          <p>${expenses.length} expenses</p>
          <p>${categories.length} categories</p>
          ${oneOffCount ? `<p>${oneOffCount} one-off items</p>` : ''}
          ${
            settings
              ? `<p>Settings: ${settings.groupByCategory ? 'grouped' : 'ungrouped'} | ${
                  settings.includeOneOffs ? 'one-offs visible' : 'one-offs hidden'
                }</p>`
              : '<p>Settings: keep current</p>'
          }
        </div>
        <p class="mt-4 text-xs text-amber-600">Importing will replace current data.</p>
        <div class="mt-6 flex items-center justify-end gap-2">
          <ui-button id="cancelImport" variant="ghost">Cancel</ui-button>
          <ui-button id="confirmImport" variant="primary">Replace Data</ui-button>
        </div>
      </div>
    `;

    const cancel = content.querySelector('#cancelImport');
    const confirm = content.querySelector('#confirmImport');
    cancel?.addEventListener('click', () => this.updateImportModal(false));
    confirm?.addEventListener('click', () => void this.applyImport());
  }

  private async applyImport() {
    if (!this.pendingImport || !this.db) return;
    const state = store.getState();
    const fallbackSettings: AppSettings = {
      id: 'app-settings',
      includeOneOffs: state.includeOneOffs,
      groupByCategory: state.groupByCategory
    };
    const settings = this.pendingImport.settings ?? fallbackSettings;

    await this.db.replaceAll(this.pendingImport.expenses, this.pendingImport.categories, settings);
    store.setState({
      expenses: this.pendingImport.expenses,
      categories: this.pendingImport.categories,
      includeOneOffs: settings.includeOneOffs,
      groupByCategory: settings.groupByCategory,
      selectedExpenseId: null,
      selectedCategoryId: null,
      isExpenseFormOpen: false
    });

    this.pendingImport = null;
    this.importError = null;
    this.updateImportModal(false);
    const toast = this.container.querySelector('ui-toast') as any;
    toast?.show('Import complete');
  }

  private render() {
    this.container.innerHTML = `
      <div class="min-h-screen px-6 py-8">
        <header class="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm">
          <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">Doughmap</p>
              <h1 class="mt-2 text-2xl font-semibold text-slate-900">Map your yearly spending</h1>
              <p class="mt-1 text-sm text-slate-600">Add subscriptions and bills to see their true annual impact.</p>
            </div>
            <div class="rounded-2xl bg-white px-4 py-3 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total yearly cost</p>
              <p id="totalCost" class="text-2xl font-semibold text-slate-900">$0</p>
            </div>
          </div>
          <div class="mt-6 flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
              <input id="groupBy" type="checkbox" class="accent-primary-500" />
              Group by category
            </label>
            <label class="flex items-center gap-2 rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700">
              <input id="includeOneOffs" type="checkbox" class="accent-primary-500" />
              Include one-off items
            </label>
            <div class="flex flex-wrap items-center gap-2 md:ml-auto">
              <ui-button id="importData" variant="outline">Import</ui-button>
              <ui-button id="exportData" variant="outline">Export</ui-button>
              <ui-button id="addExpense" variant="primary">Add Expense</ui-button>
            </div>
          </div>
          <div class="mt-4 rounded-2xl border border-white/60 bg-white/70 p-3">
            <div class="flex items-center justify-between">
              <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Quick add</p>
              <button id="quickAddCustom" class="text-xs font-semibold text-primary-600 hover:text-primary-500">
                Custom
              </button>
            </div>
            <div id="quickAdd" class="mt-2 flex gap-2 overflow-x-auto pb-2">
              ${QUICK_ADD.map(
                (item) => `
                  <button
                    class="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-primary-50"
                    data-quick="${item.id}"
                    data-name="${item.label}"
                    data-category="${item.categoryId}"
                    data-frequency="${item.frequency}"
                    type="button"
                  >
                    ${item.label}
                  </button>
                `
              ).join('')}
            </div>
          </div>
          <p id="oneOffHint" class="mt-3 text-xs text-slate-500"></p>
        </header>

        <main class="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section class="min-h-[360px]">
            <treemap-view id="treemap" class="block h-[360px] w-full sm:h-[420px] lg:h-[520px]"></treemap-view>
          </section>
          <section class="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-900">Recent expenses</h2>
              <button id="newExpense" class="text-xs text-primary-600 hover:text-primary-500">New</button>
            </div>
            <div id="expenseList" class="mt-4 space-y-3 text-sm text-slate-700"></div>
          </section>
        </main>

        <expense-form id="expenseForm"></expense-form>
        <detail-drawer id="detailDrawer"></detail-drawer>
        <ui-toast id="toast"></ui-toast>
        <input id="importFile" type="file" accept="application/json" class="hidden" />
        <ui-modal id="importModal">
          <div id="importContent"></div>
        </ui-modal>
      </div>
    `;

    const addExpense = this.container.querySelector<HTMLButtonElement>('#addExpense');
    const newExpense = this.container.querySelector<HTMLButtonElement>('#newExpense');
    const importData = this.container.querySelector<HTMLButtonElement>('#importData');
    const exportData = this.container.querySelector<HTMLButtonElement>('#exportData');
    const importFile = this.container.querySelector<HTMLInputElement>('#importFile');
    const quickAdd = this.container.querySelector<HTMLDivElement>('#quickAdd');
    const quickAddCustom = this.container.querySelector<HTMLButtonElement>('#quickAddCustom');
    const groupBy = this.container.querySelector<HTMLInputElement>('#groupBy');
    const includeOneOffs = this.container.querySelector<HTMLInputElement>('#includeOneOffs');
    const treemap = this.container.querySelector('treemap-view');
    const form = this.container.querySelector('expense-form');
    const drawer = this.container.querySelector('detail-drawer');

    addExpense?.addEventListener('click', () => {
      this.pendingDraft = null;
      store.setState({ isExpenseFormOpen: true });
    });
    newExpense?.addEventListener('click', () => {
      this.pendingDraft = null;
      store.setState({ isExpenseFormOpen: true });
    });

    groupBy?.addEventListener('change', () => {
      store.setState({ groupByCategory: groupBy.checked });
      void this.persistSettings();
    });

    includeOneOffs?.addEventListener('change', () => {
      store.setState({ includeOneOffs: includeOneOffs.checked });
      void this.persistSettings();
    });

    exportData?.addEventListener('click', () => this.handleExport());
    importData?.addEventListener('click', () => importFile?.click());
    importFile?.addEventListener('change', () => {
      const file = importFile.files?.[0];
      importFile.value = '';
      void this.handleImportFile(file ?? null);
    });

    quickAddCustom?.addEventListener('click', () => {
      this.pendingDraft = null;
      store.setState({ isExpenseFormOpen: true });
    });

    quickAdd?.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-quick]');
      if (!target) return;
      const name = target.getAttribute('data-name') ?? '';
      const categoryId = target.getAttribute('data-category') ?? 'subscriptions';
      const frequency = (target.getAttribute('data-frequency') as Frequency) ?? 'monthly';
      this.pendingDraft = {
        name,
        categoryId,
        frequency
      };
      store.setState({ isExpenseFormOpen: true });
    });

    treemap?.addEventListener('select-item', (event: Event) => {
      const detail = (event as CustomEvent).detail as { id: string; kind: 'expense' | 'category' };
      if (detail.kind === 'expense') {
        store.setState({ selectedExpenseId: detail.id, selectedCategoryId: null });
      } else {
        store.setState({ selectedExpenseId: null, selectedCategoryId: detail.id });
      }
    });

    form?.addEventListener('save-expense', async (event: Event) => {
      const expense = (event as CustomEvent).detail as Expense;
      this.pendingDraft = null;
      store.upsertExpense(expense);
      store.setState({ isExpenseFormOpen: false });
      await this.db?.saveExpense(expense);
      const toast = this.container.querySelector('ui-toast') as any;
      toast?.show('Expense saved');
    });

    form?.addEventListener('close-form', () => {
      this.pendingDraft = null;
      store.setState({ isExpenseFormOpen: false });
    });

    drawer?.addEventListener('close-drawer', () => {
      store.setState({ selectedExpenseId: null, selectedCategoryId: null });
    });
  }

  private update(state: { [key: string]: any }) {
    const totalCost = this.container.querySelector<HTMLElement>('#totalCost');
    const groupBy = this.container.querySelector<HTMLInputElement>('#groupBy');
    const includeOneOffs = this.container.querySelector<HTMLInputElement>('#includeOneOffs');
    const treemap = this.container.querySelector('treemap-view') as any;
    const form = this.container.querySelector('expense-form') as any;
    const drawer = this.container.querySelector('detail-drawer') as any;
    const list = this.container.querySelector('#expenseList');
    const oneOffHint = this.container.querySelector<HTMLElement>('#oneOffHint');

    totalCost && (totalCost.textContent = formatAmount(store.totalYearlyCost));
    if (groupBy) groupBy.checked = state.groupByCategory;
    if (includeOneOffs) includeOneOffs.checked = state.includeOneOffs;

    if (treemap) treemap.data = store.treemapItems;

    if (oneOffHint) {
      const oneOffCount = state.expenses.filter((expense: Expense) => expense.frequency === 'one_off')
        .length;
      if (!state.includeOneOffs && oneOffCount > 0) {
        oneOffHint.textContent = `${oneOffCount} one-off expense${oneOffCount === 1 ? '' : 's'} hidden. Toggle to include.`;
      } else {
        oneOffHint.textContent = '';
      }
    }

    if (form) {
      form.open = state.isExpenseFormOpen;
      form.formCategories = state.categories;
      form.formExpense = null;
      form.formDraft = this.pendingDraft;
    }

    if (drawer) {
      const selectedExpense = store.selectedExpense;
      const selectedCategory = store.selectedCategory;
      if (selectedExpense) {
        drawer.open = true;
        drawer.detailExpense = selectedExpense;
        drawer.detailCategory = null;
        drawer.detailCategoryExpenses = [];
        drawer.detailRecommendations = generateRecommendations(selectedExpense, store.activeExpenses);
      } else if (selectedCategory) {
        const categoryExpenses = store.activeExpenses.filter(
          (expense) => expense.categoryId === selectedCategory.id
        );
        drawer.open = true;
        drawer.detailCategory = selectedCategory as Category;
        drawer.detailCategoryExpenses = categoryExpenses;
        drawer.detailRecommendations = [];
      } else {
        drawer.open = false;
      }
    }

    if (list) {
      const recent = [...store.activeExpenses]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 5);
      list.innerHTML = recent.length
        ? recent
            .map((expense) => {
              const yearly = toYearly(expense.amount, expense.frequency);
              const oneOffTag =
                expense.frequency === 'one_off'
                  ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">One-off</span>'
                  : '';
              return `
                <div class="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-800">${expense.name}</p>
                    <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>${expense.frequency}</span>
                      ${oneOffTag}
                    </div>
                  </div>
                  <span class="text-sm font-semibold text-slate-700">${formatAmount(yearly)}</span>
                </div>
              `;
            })
            .join('')
        : '<p class="text-sm text-slate-500">No expenses added yet.</p>';
    }
  }
}

customElements.define('app-shell', AppShell);
