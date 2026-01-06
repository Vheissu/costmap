import type { Category, Expense, Recommendation } from '../types';
import { createShadowRoot } from '../app/dom';
import { formatAmount } from '../app/format';
import { toMonthly, toYearly } from '../app/services/yearly';
import './recommendation-card';

class DetailDrawer extends HTMLElement {
  private container: HTMLDivElement;
  private expense: Expense | null = null;
  private category: Category | null = null;
  private categoryExpenses: Expense[] = [];
  private recommendations: Recommendation[] = [];

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  set detailExpense(value: Expense | null) {
    this.expense = value;
    if (value) this.category = null;
    this.render();
  }

  set detailCategory(value: Category | null) {
    this.category = value;
    if (value) this.expense = null;
    this.render();
  }

  set detailCategoryExpenses(value: Expense[]) {
    this.categoryExpenses = value;
    this.render();
  }

  set detailRecommendations(value: Recommendation[]) {
    this.recommendations = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['open'];
  }

  attributeChangedCallback() {
    this.render();
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(value: boolean) {
    if (value) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  private render() {
    const isOpen = this.open;
    if (!isOpen) {
      this.container.innerHTML = '';
      return;
    }

    const expenseYearly = this.expense
      ? toYearly(this.expense.amount, this.expense.frequency)
      : 0;
    const expenseMonthly = this.expense ? toMonthly(expenseYearly) : 0;
    const categoryYearly = this.category
      ? this.categoryExpenses.reduce(
          (sum, expense) => sum + toYearly(expense.amount, expense.frequency),
          0
        )
      : 0;
    const categoryMonthly = this.category ? toMonthly(categoryYearly) : 0;

    const header = this.expense
      ? `
        <h3 class="text-lg font-semibold text-slate-900">${this.expense.name}</h3>
        <p class="text-sm text-slate-600">${formatAmount(expenseYearly)} per year</p>
        <p class="text-xs text-slate-500">${formatAmount(expenseMonthly)} per month</p>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <span>Frequency: ${this.expense.frequency.replace('_', ' ')}</span>
          ${
            this.expense.frequency === 'one_off'
              ? '<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">One-off</span>'
              : ''
          }
        </div>
      `
      : this.category
        ? `
        <h3 class="text-lg font-semibold text-slate-900">${this.category.name}</h3>
        <p class="text-sm text-slate-600">${this.categoryExpenses.length} expenses in this category</p>
        <p class="text-xs text-slate-500">${formatAmount(categoryYearly)} / yr · ${formatAmount(
          categoryMonthly
        )} / mo</p>
      `
        : '<h3 class="text-lg font-semibold text-slate-900">Details</h3>';

    const list = this.category
      ? `
        <div class="mt-4 space-y-2">
          ${this.categoryExpenses
            .slice(0, 4)
            .map((expense) => {
              const yearly = toYearly(expense.amount, expense.frequency);
              return `
                <div class="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-700">
                  <span>${expense.name}</span>
                  <span class="font-semibold">${formatAmount(yearly)}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      `
      : '';

    const recs = this.recommendations.length
      ? `
        <div class="mt-6 space-y-3">
          ${this.recommendations
            .map(() => '<recommendation-card></recommendation-card>')
            .join('')}
        </div>
      `
      : '<p class="mt-4 text-xs text-slate-500">No recommendations yet.</p>';

    this.container.innerHTML = `
      <aside class="fixed inset-x-4 bottom-6 z-40 max-h-[78vh] overflow-y-auto rounded-3xl border border-white/60 bg-white/90 p-5 shadow-xl backdrop-blur lg:inset-auto lg:right-6 lg:top-24 lg:bottom-auto lg:w-[min(92vw,360px)]">
        <div class="flex items-center justify-between">
          ${header}
          <button id="close" class="text-xs text-slate-500 hover:text-slate-900">Close</button>
        </div>
        ${list}
        <div class="mt-6">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendations</h4>
          ${recs}
        </div>
      </aside>
    `;

    this.container.querySelectorAll('recommendation-card').forEach((card, index) => {
      (card as any).recommendation = this.recommendations[index] ?? null;
    });

    const closeButton = this.container.querySelector<HTMLButtonElement>('#close');
    closeButton?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('close-drawer', { bubbles: true }));
    });
  }
}

customElements.define('detail-drawer', DetailDrawer);
