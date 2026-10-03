import type { Category, Expense, Period, Recommendation } from '../types';
import { createShadowRoot } from '../app/dom';
import { escapeHtml, formatMoney, formatPercent, PERIOD_SUFFIX } from '../app/format';
import { FREQUENCY_LABELS, toPeriod, toYearly } from '../app/services/yearly';
import { deleteExpense, openEditExpense, setExpenseStatus } from '../app/actions';
import { store } from '../app/store';

export type DrawerView =
  | {
      kind: 'expense';
      expense: Expense;
      category: Category;
      recommendations: Recommendation[];
      total: number;
      currency: string;
      period: Period;
    }
  | {
      kind: 'category';
      category: Category;
      expenses: Expense[];
      total: number;
      currency: string;
      period: Period;
    };

const EFFORT_LABEL: Record<Recommendation['effort'], string> = {
  low: 'Quick to do',
  medium: 'Some effort',
  high: 'Takes real work'
};

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const closeIcon =
  '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

class DetailDrawer extends HTMLElement {
  private container: HTMLDivElement;
  private current: DrawerView | null = null;
  private lastKey = '';

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;

    this.container.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!button || !this.current) return;
      const action = button.dataset.action;
      const view = this.current;
      if (action === 'close') {
        this.dispatchEvent(new CustomEvent('close-drawer', { bubbles: true, composed: true }));
      } else if (view.kind === 'expense' && action === 'edit') {
        openEditExpense(view.expense.id);
      } else if (view.kind === 'expense' && action === 'cancel') {
        setExpenseStatus(view.expense.id, 'cancelled');
      } else if (view.kind === 'expense' && action === 'restore') {
        setExpenseStatus(view.expense.id, 'active');
      } else if (view.kind === 'expense' && action === 'delete') {
        deleteExpense(view.expense.id);
      } else if (action === 'open-expense' && button.dataset.id) {
        store.setState({ selectedExpenseId: button.dataset.id, selectedCategoryId: null });
      }
    });
  }

  set view(value: DrawerView | null) {
    // Cheap identity check so unrelated store updates don't rebuild the panel.
    const key = value ? JSON.stringify(value) : '';
    if (key === this.lastKey) return;
    const wasOpen = Boolean(this.current);
    this.lastKey = key;
    this.current = value;

    const focusedAction = (this.shadowRoot?.activeElement as HTMLElement | null)?.dataset?.action;
    this.render();
    if (!value) return;
    const refocus =
      (focusedAction && this.container.querySelector<HTMLElement>(`[data-action="${focusedAction}"]`)) ||
      (!wasOpen ? this.container.querySelector<HTMLElement>('[data-action="close"]') : null);
    refocus?.focus({ preventScroll: true });
  }

  private money(yearly: number, period: Period, currency: string) {
    return formatMoney(toPeriod(yearly, period), currency);
  }

  private render() {
    const view = this.current;
    if (!view) {
      this.container.innerHTML = '';
      return;
    }

    const body = view.kind === 'expense' ? this.renderExpense(view) : this.renderCategory(view);
    const title = view.kind === 'expense' ? view.expense.name : view.category.name;

    this.container.innerHTML = `
      <aside role="dialog" aria-modal="false" aria-label="${escapeHtml(title)} details"
        class="fixed inset-x-0 bottom-0 z-40 max-h-[82dvh] overflow-y-auto rounded-t-[6px] border-t-2 border-ink bg-raised px-5 pb-6 pt-4 shadow-sheet lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[400px] lg:rounded-none lg:border-l lg:border-t-0 lg:border-rule-strong lg:pt-6">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-rule-strong lg:hidden" aria-hidden="true"></div>
        ${body}
      </aside>
    `;
  }

  private header(category: Category, title: string, kicker: string) {
    return `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm text-ink-soft">
            <span class="inline-block h-3 w-3 shrink-0 rounded-[2px]" style="background:${escapeHtml(category.color)}"></span>
            ${escapeHtml(kicker)}
          </p>
          <h2 class="mt-1 break-words text-2xl font-bold leading-tight">${escapeHtml(title)}</h2>
        </div>
        <button type="button" data-action="close" class="btn-ghost -mr-2 shrink-0 px-2" aria-label="Close details">${closeIcon}</button>
      </div>
    `;
  }

  private breakdown(yearly: number, period: Period, currency: string) {
    const rows: Array<[Period, string]> = [
      ['week', 'Per week'],
      ['month', 'Per month'],
      ['year', 'Per year']
    ];
    return `
      <table class="figures mt-4 w-full text-[15px]">
        <tbody>
          ${rows
            .map(
              ([key, label]) => `
              <tr class="border-b border-rule ${key === period ? 'font-bold' : 'text-ink-soft'}">
                <th scope="row" class="py-1.5 text-left font-[inherit]">${label}</th>
                <td class="py-1.5 text-right">${this.money(yearly, key, currency)}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  private renderExpense(view: Extract<DrawerView, { kind: 'expense' }>) {
    const { expense, category, recommendations, total, currency, period } = view;
    const yearly = toYearly(expense.amount, expense.frequency);
    const isCancelled = expense.status === 'cancelled';
    const share = total > 0 && !isCancelled ? yearly / total : 0;

    const status = isCancelled
      ? `<div class="mt-4 rounded-[3px] bg-save-wash px-3 py-2.5 text-sm text-save">
          <strong>Cancelled${expense.cancelledAt ? ` on ${dateFormatter.format(expense.cancelledAt)}` : ''}.</strong>
          ${expense.frequency === 'one_off' ? '' : `You're saving ${formatMoney(yearly, currency)} a year.`}
        </div>`
      : expense.frequency === 'one_off'
        ? '<p class="mt-4 rounded-[3px] bg-warn-wash px-3 py-2 text-sm text-warn">One-off cost. It only counts toward totals when one-offs are included.</p>'
        : '';

    const recs = recommendations.length
      ? `<ol class="mt-2 divide-y divide-rule border-y border-rule">
          ${recommendations
            .map(
              (rec) => `
              <li class="py-3">
                <div class="flex items-baseline justify-between gap-3">
                  <p class="font-semibold">${escapeHtml(rec.title)}</p>
                  <p class="figures shrink-0 text-sm font-bold text-save">up to ${formatMoney(rec.savingsYearly, currency)}/yr</p>
                </div>
                <p class="mt-1 text-sm text-ink-soft">${escapeHtml(rec.description)}</p>
                <p class="mt-1 text-xs text-ink-faint">${EFFORT_LABEL[rec.effort]}</p>
              </li>`
            )
            .join('')}
        </ol>`
      : `<p class="mt-2 text-sm text-ink-soft">${isCancelled ? 'Nothing to save on a cancelled expense.' : 'No obvious savings for this one.'}</p>`;

    return `
      ${this.header(category, expense.name, category.name)}
      <p class="figures mt-4 text-sm text-ink-soft">
        Entered as <strong class="text-ink">${formatMoney(expense.amount, currency)}</strong> ${FREQUENCY_LABELS[expense.frequency].toLowerCase()}
      </p>
      <p class="figures mt-1 text-4xl font-bold ${isCancelled ? 'text-ink-faint line-through' : ''}">
        ${this.money(yearly, period, currency)}<span class="text-lg font-semibold text-ink-soft">${PERIOD_SUFFIX[period]}</span>
      </p>
      ${share > 0 ? `<p class="mt-1 text-sm text-ink-soft">${formatPercent(share)} of everything you pay for</p>` : ''}
      ${status}
      ${expense.frequency === 'one_off' ? '' : this.breakdown(yearly, period, currency)}
      ${expense.notes ? `<p class="mt-4 whitespace-pre-line rounded-[3px] bg-sunk px-3 py-2 text-sm">${escapeHtml(expense.notes)}</p>` : ''}

      <div class="mt-5 flex flex-wrap gap-2">
        <button type="button" class="btn-primary" data-action="edit">Edit</button>
        ${
          isCancelled
            ? '<button type="button" class="btn-outline" data-action="restore">Restore</button>'
            : '<button type="button" class="btn-outline" data-action="cancel">Mark as cancelled</button>'
        }
        <button type="button" class="btn-danger ml-auto" data-action="delete">Delete</button>
      </div>

      <h3 class="mt-7 border-b-2 border-ink pb-1 text-base font-bold">Ways to pay less</h3>
      ${recs}
    `;
  }

  private renderCategory(view: Extract<DrawerView, { kind: 'category' }>) {
    const { category, expenses, total, currency, period } = view;
    const yearly = expenses.reduce((sum, expense) => sum + toYearly(expense.amount, expense.frequency), 0);
    const share = total > 0 ? yearly / total : 0;
    const sorted = [...expenses].sort(
      (a, b) => toYearly(b.amount, b.frequency) - toYearly(a.amount, a.frequency)
    );

    return `
      ${this.header(category, category.name, `${expenses.length} expense${expenses.length === 1 ? '' : 's'}`)}
      <p class="figures mt-4 text-4xl font-bold">
        ${this.money(yearly, period, currency)}<span class="text-lg font-semibold text-ink-soft">${PERIOD_SUFFIX[period]}</span>
      </p>
      ${share > 0 ? `<p class="mt-1 text-sm text-ink-soft">${formatPercent(share)} of everything you pay for</p>` : ''}
      ${this.breakdown(yearly, period, currency)}

      <h3 class="mt-7 border-b-2 border-ink pb-1 text-base font-bold">In this category</h3>
      <ul class="divide-y divide-rule">
        ${sorted
          .map((expense) => {
            const value = toYearly(expense.amount, expense.frequency);
            return `
              <li>
                <button type="button" data-action="open-expense" data-id="${escapeHtml(expense.id)}"
                  class="figures flex w-full items-baseline justify-between gap-3 py-2.5 text-left hover:bg-sunk">
                  <span class="min-w-0">
                    <span class="block truncate font-semibold">${escapeHtml(expense.name)}</span>
                    <span class="block text-xs text-ink-soft">${formatMoney(expense.amount, currency)} ${FREQUENCY_LABELS[expense.frequency].toLowerCase()}</span>
                  </span>
                  <span class="shrink-0 text-right">
                    <span class="block font-semibold">${this.money(value, period, currency)}</span>
                    <span class="block text-xs text-ink-soft">${formatPercent(yearly > 0 ? value / yearly : 0)}</span>
                  </span>
                </button>
              </li>`;
          })
          .join('')}
      </ul>
    `;
  }
}

customElements.define('detail-drawer', DetailDrawer);
