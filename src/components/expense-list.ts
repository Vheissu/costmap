import type { Expense } from '../types';
import { createShadowRoot } from '../app/dom';
import { escapeHtml, formatMoney, PERIOD_SUFFIX } from '../app/format';
import { FREQUENCY_LABELS, toPeriod } from '../app/services/yearly';
import { store, yearlyOf, type AppState, type SortKey } from '../app/store';

class ExpenseList extends HTMLElement {
  private container: HTMLDivElement;
  private rows: HTMLUListElement | null = null;
  private summary: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastKey = '';

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
    this.container.className = 'flex h-full flex-col';
  }

  connectedCallback() {
    this.renderFrame();
    this.unsubscribe = store.subscribe((state) => this.update(state));
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  focusSearch() {
    this.container.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }

  private renderFrame() {
    const { sort, search } = store.getState();
    this.container.innerHTML = `
      <div class="flex items-end justify-between gap-3 border-b-2 border-ink pb-2">
        <h2 class="text-lg font-bold">Expenses</h2>
        <p data-summary class="text-sm text-ink-soft"></p>
      </div>
      <div class="mt-3 flex gap-2">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Search expenses</span>
          <svg aria-hidden="true" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" width="16" height="16" viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input type="search" class="field py-1.5 pl-8 text-sm" placeholder="Search" value="${escapeHtml(search)}" autocomplete="off" />
        </label>
        <label>
          <span class="sr-only">Sort by</span>
          <select class="field w-auto py-1.5 text-sm" data-sort>
            <option value="cost" ${sort === 'cost' ? 'selected' : ''}>Highest cost</option>
            <option value="name" ${sort === 'name' ? 'selected' : ''}>Name</option>
            <option value="recent" ${sort === 'recent' ? 'selected' : ''}>Recently changed</option>
          </select>
        </label>
      </div>
      <ul data-rows class="mt-2 min-h-0 flex-1 divide-y divide-rule overflow-y-auto"></ul>
    `;

    this.rows = this.container.querySelector('[data-rows]');
    this.summary = this.container.querySelector('[data-summary]');

    const searchInput = this.container.querySelector<HTMLInputElement>('input[type="search"]');
    searchInput?.addEventListener('input', () => store.setState({ search: searchInput.value }));
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && searchInput.value) {
        event.stopPropagation();
        searchInput.value = '';
        store.setState({ search: '' });
      }
    });

    const sortSelect = this.container.querySelector<HTMLSelectElement>('[data-sort]');
    sortSelect?.addEventListener('change', () => store.setState({ sort: sortSelect.value as SortKey }));

    this.rows?.addEventListener('click', (event) => {
      const row = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (!row?.dataset.id) return;
      store.setState({ selectedExpenseId: row.dataset.id, selectedCategoryId: null });
    });
  }

  private update(state: AppState) {
    if (!this.rows || !this.summary) return;
    const listed = store.listedExpenses;
    const key = JSON.stringify([
      listed.map((e) => [e.id, e.updatedAt, e.status]),
      state.currency,
      state.period,
      state.includeOneOffs,
      state.selectedExpenseId,
      state.categories.length
    ]);
    if (key === this.lastKey) return;
    this.lastKey = key;

    const active = state.expenses.filter((expense) => expense.status === 'active').length;
    this.summary.textContent = `${active} active`;

    if (!listed.length) {
      this.rows.innerHTML = state.search
        ? `<li class="py-6 text-center text-sm text-ink-soft">Nothing matches “${escapeHtml(state.search)}”.</li>`
        : '<li class="py-6 text-center text-sm text-ink-soft">Nothing here yet.</li>';
      return;
    }

    this.rows.innerHTML = listed.map((expense) => this.row(expense, state)).join('');
  }

  private row(expense: Expense, state: AppState) {
    const category = store.categoryFor(expense.categoryId);
    const yearly = yearlyOf(expense);
    const isCancelled = expense.status === 'cancelled';
    const isHiddenOneOff = expense.frequency === 'one_off' && !state.includeOneOffs;
    const muted = isCancelled || isHiddenOneOff;
    const selected = state.selectedExpenseId === expense.id;
    const value =
      expense.frequency === 'one_off'
        ? formatMoney(expense.amount, state.currency)
        : `${formatMoney(toPeriod(yearly, state.period), state.currency)}<span class="text-xs font-normal text-ink-soft">${PERIOD_SUFFIX[state.period]}</span>`;

    const detail = isCancelled
      ? `<span class="text-save">Cancelled${expense.frequency === 'one_off' ? '' : ` · saving ${formatMoney(yearly, state.currency)}/yr`}</span>`
      : `${escapeHtml(category.name)} · ${formatMoney(expense.amount, state.currency)} ${FREQUENCY_LABELS[expense.frequency].toLowerCase()}${isHiddenOneOff ? ' · not in totals' : ''}`;

    return `
      <li>
        <button type="button" data-id="${escapeHtml(expense.id)}" aria-current="${selected}"
          class="figures flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-sunk ${selected ? 'bg-sunk' : ''}">
          <span class="h-8 w-1.5 shrink-0 rounded-[1px] ${muted ? 'opacity-40' : ''}" style="background:${escapeHtml(category.color)}" aria-hidden="true"></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold ${isCancelled ? 'text-ink-soft line-through' : ''}">${escapeHtml(expense.name)}</span>
            <span class="block truncate text-xs text-ink-soft">${detail}</span>
          </span>
          <span class="shrink-0 text-right font-semibold ${muted ? 'text-ink-faint' : ''}">${value}</span>
        </button>
      </li>
    `;
  }
}

customElements.define('expense-list', ExpenseList);
