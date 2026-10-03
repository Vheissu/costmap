import type { Category, Expense, Frequency } from '../types';
import { createShadowRoot } from '../app/dom';
import { escapeHtml, formatMoney } from '../app/format';
import { FREQUENCIES, isFrequency, toMonthly, toYearly } from '../app/services/yearly';
import { findQuickAdd, QUICK_ADD } from '../app/quick-add';
import { OTHER_CATEGORY_ID } from '../app/store';

const NEW_CATEGORY = '__new__';

export type FormOpenOptions = {
  expense: Expense | null;
  draft: Partial<Expense> | null;
  categories: Category[];
  currency: string;
};

export type FormSubmitDetail = { expense: Expense; newCategoryName: string | null };

class ExpenseForm extends HTMLElement {
  private container: HTMLDivElement;
  private dialog: HTMLDialogElement | null = null;
  private expense: Expense | null = null;
  private currency = 'USD';
  private categoryTouched = false;

  constructor() {
    super();
    const { container } = createShadowRoot(this);
    this.container = container;
  }

  get isOpen() {
    return Boolean(this.dialog?.open);
  }

  openWith({ expense, draft, categories, currency }: FormOpenOptions) {
    this.expense = expense;
    this.currency = currency;
    this.categoryTouched = Boolean(expense || draft?.categoryId);
    this.render(expense ?? draft ?? {}, categories);
    this.dialog?.showModal();
    const focusTarget = expense || draft?.name ? 'amount' : 'name';
    this.field<HTMLInputElement>(focusTarget)?.focus();
    this.updatePreview();
  }

  close() {
    if (this.dialog?.open) this.dialog.close();
  }

  private field<T extends HTMLElement>(name: string) {
    return this.container.querySelector<T>(`[name="${name}"]`);
  }

  private render(values: Partial<Expense>, categories: Category[]) {
    const isEdit = Boolean(this.expense);
    const name = values.name ?? '';
    const amount = values.amount?.toString() ?? '';
    const frequency: Frequency = values.frequency ?? 'monthly';
    const fallbackCategory = categories.find((cat) => cat.id === OTHER_CATEGORY_ID) ?? categories[0];
    const categoryId = values.categoryId ?? fallbackCategory?.id ?? '';
    const notes = values.notes ?? '';
    const showQuickPicks = !isEdit && !name;

    this.container.innerHTML = `
      <dialog class="m-auto w-[min(100vw-1.5rem,500px)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[4px] border border-rule-strong bg-raised p-0 text-ink shadow-sheet" aria-labelledby="formTitle">
        <form method="dialog" class="p-5 sm:p-6" novalidate>
          <div class="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 id="formTitle" class="text-xl font-bold">${isEdit ? 'Edit expense' : 'Add an expense'}</h2>
            <button type="button" data-action="cancel" class="btn-ghost -mr-2 -mt-1 px-2" aria-label="Close">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>

          ${
            showQuickPicks
              ? `<div class="mt-4">
                  <p class="text-sm text-ink-soft">Start from a common one, or type your own below.</p>
                  <div class="mt-2 flex flex-wrap gap-1.5" data-quick>
                    ${QUICK_ADD.slice(0, 12)
                      .map(
                        (item) =>
                          `<button type="button" class="rounded-[3px] border border-rule-strong px-2 py-1 text-[13px] font-medium text-ink-soft hover:border-ink hover:text-ink" data-quick-name="${escapeHtml(item.label)}">${escapeHtml(item.label)}</button>`
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }

          <div class="mt-4 space-y-4">
            <div>
              <label class="field-label" for="name">Name</label>
              <input id="name" class="field" type="text" name="name" required maxlength="80" autocomplete="off"
                list="quickNames" value="${escapeHtml(name)}" placeholder="e.g. Netflix, Rent, Car insurance" />
              <datalist id="quickNames">
                ${QUICK_ADD.map((item) => `<option value="${escapeHtml(item.label)}"></option>`).join('')}
              </datalist>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="field-label" for="amount">Amount <span class="font-normal text-ink-faint">(${escapeHtml(this.currency)})</span></label>
                <input id="amount" class="field figures" type="number" name="amount" required min="0.01" step="0.01"
                  inputmode="decimal" value="${escapeHtml(amount)}" placeholder="0.00" />
              </div>
              <div>
                <label class="field-label" for="frequency">How often</label>
                <select id="frequency" class="field" name="frequency">
                  ${FREQUENCIES.map(
                    (item) =>
                      `<option value="${item.value}" ${item.value === frequency ? 'selected' : ''}>${item.label}</option>`
                  ).join('')}
                </select>
              </div>
            </div>

            <p id="preview" class="figures min-h-[1.25rem] text-sm text-ink-soft" aria-live="polite"></p>

            <div>
              <label class="field-label" for="category">Category</label>
              <select id="category" class="field" name="category">
                ${categories
                  .map(
                    (cat) =>
                      `<option value="${escapeHtml(cat.id)}" ${cat.id === categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`
                  )
                  .join('')}
                <option value="${NEW_CATEGORY}">New category…</option>
              </select>
              <input class="field mt-2 hidden" type="text" name="newCategory" maxlength="40" placeholder="Category name" aria-label="New category name" />
            </div>

            <div>
              <label class="field-label" for="notes">Notes <span class="font-normal text-ink-faint">(optional)</span></label>
              <textarea id="notes" class="field" name="notes" rows="2" maxlength="500" placeholder="Renewal date, account number, anything useful">${escapeHtml(notes)}</textarea>
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end gap-2 border-t border-rule pt-4">
            <button type="button" class="btn-ghost" data-action="cancel">Cancel</button>
            <button type="submit" class="btn-primary">${isEdit ? 'Save changes' : 'Add expense'}</button>
          </div>
        </form>
      </dialog>
    `;

    this.dialog = this.container.querySelector('dialog');
    this.wire();
  }

  private wire() {
    const dialog = this.dialog;
    const form = this.container.querySelector<HTMLFormElement>('form');
    if (!dialog || !form) return;

    const nameInput = this.field<HTMLInputElement>('name')!;
    const amountInput = this.field<HTMLInputElement>('amount')!;
    const frequencySelect = this.field<HTMLSelectElement>('frequency')!;
    const categorySelect = this.field<HTMLSelectElement>('category')!;
    const newCategoryInput = this.field<HTMLInputElement>('newCategory')!;

    dialog.addEventListener('close', () => {
      this.dispatchEvent(new CustomEvent('close-form', { bubbles: true, composed: true }));
    });

    // Clicking the backdrop (outside the form box) closes the dialog.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    this.container.querySelectorAll('[data-action="cancel"]').forEach((button) =>
      button.addEventListener('click', () => dialog.close())
    );

    const applyQuickAdd = (label: string) => {
      const match = findQuickAdd(label);
      if (!match) return false;
      frequencySelect.value = match.frequency;
      if (!this.categoryTouched && [...categorySelect.options].some((o) => o.value === match.categoryId)) {
        categorySelect.value = match.categoryId;
      }
      return true;
    };

    this.container.querySelector('[data-quick]')?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-quick-name]');
      if (!button) return;
      nameInput.value = button.dataset.quickName ?? '';
      applyQuickAdd(nameInput.value);
      this.updatePreview();
      amountInput.focus();
    });

    nameInput.addEventListener('change', () => {
      if (!this.expense) applyQuickAdd(nameInput.value);
      this.updatePreview();
    });
    nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));

    categorySelect.addEventListener('change', () => {
      this.categoryTouched = true;
      const isNew = categorySelect.value === NEW_CATEGORY;
      newCategoryInput.classList.toggle('hidden', !isNew);
      newCategoryInput.required = isNew;
      if (isNew) newCategoryInput.focus();
    });

    amountInput.addEventListener('input', () => {
      amountInput.setCustomValidity('');
      this.updatePreview();
    });
    frequencySelect.addEventListener('change', () => this.updatePreview());

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit(form);
    });
  }

  private updatePreview() {
    const preview = this.container.querySelector<HTMLElement>('#preview');
    const amount = Number(this.field<HTMLInputElement>('amount')?.value);
    const frequency = this.field<HTMLSelectElement>('frequency')?.value;
    if (!preview) return;
    if (!Number.isFinite(amount) || amount <= 0 || !isFrequency(frequency)) {
      preview.textContent = '';
      return;
    }
    const yearly = toYearly(amount, frequency);
    preview.textContent =
      frequency === 'one_off'
        ? `A one-off cost of ${formatMoney(amount, this.currency)}.`
        : `That's ${formatMoney(yearly, this.currency)} a year, or ${formatMoney(toMonthly(yearly), this.currency)} a month.`;
  }

  private submit(form: HTMLFormElement) {
    const nameInput = this.field<HTMLInputElement>('name')!;
    const amountInput = this.field<HTMLInputElement>('amount')!;
    const newCategoryInput = this.field<HTMLInputElement>('newCategory')!;

    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const amount = Number(data.get('amount'));
    const frequency = data.get('frequency');
    const rawCategory = String(data.get('category') ?? '');
    const newCategoryName = rawCategory === NEW_CATEGORY ? String(data.get('newCategory') ?? '').trim() : null;
    const notes = String(data.get('notes') ?? '').trim();

    nameInput.setCustomValidity(name ? '' : 'Give this expense a name.');
    amountInput.setCustomValidity(
      Number.isFinite(amount) && amount > 0 ? '' : 'Enter an amount greater than zero.'
    );
    newCategoryInput.setCustomValidity(
      rawCategory === NEW_CATEGORY && !newCategoryName ? 'Name the new category.' : ''
    );
    if (!form.reportValidity() || !isFrequency(frequency)) return;

    const now = Date.now();
    const existing = this.expense;
    const expense: Expense = {
      id: existing?.id ?? (crypto.randomUUID?.() ?? `exp-${now}-${Math.random().toString(36).slice(2)}`),
      name,
      amount: Math.round(amount * 100) / 100,
      frequency,
      categoryId: rawCategory === NEW_CATEGORY ? '' : rawCategory,
      status: existing?.status ?? 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    if (notes) expense.notes = notes;
    if (existing?.cancelledAt) expense.cancelledAt = existing.cancelledAt;

    const detail: FormSubmitDetail = { expense, newCategoryName };
    this.dispatchEvent(new CustomEvent('save-expense', { bubbles: true, composed: true, detail }));
  }
}

customElements.define('expense-form', ExpenseForm);
