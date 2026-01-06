import type { Category, Expense, Frequency } from '../types';
import { createShadowRoot } from '../app/dom';
import './ui/modal';
import './ui/button';

const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Fortnightly', value: 'fortnightly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'One-off', value: 'one_off' }
];

class ExpenseForm extends HTMLElement {
  private container: HTMLDivElement;
  private categories: Category[] = [];
  private expense: Expense | null = null;
  private draft: Partial<Expense> | null = null;
  private error: string | null = null;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  set formCategories(value: Category[]) {
    this.categories = value;
    this.render();
  }

  set formExpense(value: Expense | null) {
    this.expense = value;
    this.render();
  }

  set formDraft(value: Partial<Expense> | null) {
    this.draft = value;
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

  connectedCallback() {
    this.render();
  }

  private render() {
    const open = this.open;
    const expense = this.expense;
    const draft = this.draft;
    const name = expense?.name ?? draft?.name ?? '';
    const amount = expense?.amount?.toString() ?? draft?.amount?.toString() ?? '';
    const frequency = expense?.frequency ?? draft?.frequency ?? 'monthly';
    const categoryId = expense?.categoryId ?? draft?.categoryId ?? this.categories[0]?.id ?? '';
    const notes = expense?.notes ?? draft?.notes ?? '';

    this.container.innerHTML = `
      <ui-modal ${open ? 'open' : ''}>
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">${expense ? 'Edit Expense' : 'Add New Expense'}</h2>
            <p class="text-xs text-slate-500">Track a recurring cost and see its yearly impact.</p>
          </div>
          <button id="close" class="text-xs text-slate-500 hover:text-slate-900">Close</button>
        </div>
        <form id="expense-form" class="mt-4 space-y-3">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
          <input
            class="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
            type="text"
            name="name"
            required
            minlength="1"
            maxlength="50"
            value="${name}"
            placeholder="Netflix"
          />

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</label>
              <input
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
                type="number"
                step="0.01"
                min="0"
                name="amount"
                required
                value="${amount}"
                placeholder="15.99"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Frequency</label>
              <select
                class="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
                name="frequency"
                required
              >
                ${FREQUENCIES.map(
                  (item) => `
                    <option value="${item.value}" ${item.value === frequency ? 'selected' : ''}>
                      ${item.label}
                    </option>
                  `
                ).join('')}
              </select>
            </div>
          </div>
          <p class="text-[11px] text-slate-500">One-off expenses are hidden unless \"Include one-off items\" is enabled.</p>

          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
          <select
            class="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
            name="category"
            required
          >
            ${this.categories
              .map(
                (cat) => `
                  <option value="${cat.id}" ${cat.id === categoryId ? 'selected' : ''}>
                    ${cat.name}
                  </option>
                `
              )
              .join('')}
          </select>

          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-500">Notes (optional)</label>
          <textarea
            class="w-full rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-900 focus:border-primary-500 focus:outline-none"
            name="notes"
            rows="3"
            placeholder="Add any details..."
          >${notes}</textarea>

          ${this.error ? `<p class="text-xs text-red-600">${this.error}</p>` : ''}

          <div class="mt-4 flex items-center justify-end gap-2">
            <ui-button variant="ghost" id="cancel">Cancel</ui-button>
            <ui-button variant="primary" type="submit">Save</ui-button>
          </div>
        </form>
      </ui-modal>
    `;

    const form = this.container.querySelector<HTMLFormElement>('#expense-form');
    const cancel = this.container.querySelector<HTMLButtonElement>('#cancel');
    const close = this.container.querySelector<HTMLButtonElement>('#close');

    const handleClose = () => {
      this.error = null;
      this.dispatchEvent(new CustomEvent('close-form', { bubbles: true }));
    };

    cancel?.addEventListener('click', (event) => {
      event.preventDefault();
      handleClose();
    });

    close?.addEventListener('click', (event) => {
      event.preventDefault();
      handleClose();
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name') ?? '').trim();
      const amount = Number(data.get('amount'));
      const frequency = data.get('frequency') as Frequency;
      const categoryId = String(data.get('category') ?? '');
      const notes = String(data.get('notes') ?? '').trim();

      if (!name || !Number.isFinite(amount) || amount <= 0 || !frequency || !categoryId) {
        this.error = 'Please complete all required fields with valid values.';
        this.render();
        return;
      }

      const now = Date.now();
      const payload: Expense = {
        id: expense?.id ?? (crypto.randomUUID ? crypto.randomUUID() : `exp-${now}`),
        name,
        amount,
        frequency,
        categoryId,
        notes: notes || undefined,
        status: expense?.status ?? 'active',
        createdAt: expense?.createdAt ?? now,
        updatedAt: now
      };

      this.error = null;
      this.dispatchEvent(new CustomEvent('save-expense', { bubbles: true, detail: payload }));
    });
  }
}

customElements.define('expense-form', ExpenseForm);
