import type { Category, Expense, ExpenseStatus } from '../types';
import type { Database } from './services/db';
import type { BackupPayload } from './services/backup';
import { CUSTOM_CATEGORY_COLORS, store, type AppState } from './store';
import { showToast } from '../components/ui/toast';

let db: Database | null = null;
let askedForPersistence = false;

export const setDatabase = (database: Database | null) => {
  db = database;
};

const reportFailure = (error: unknown) => {
  console.error('[doughmap] storage error', error);
  showToast("Couldn't save to this browser's storage. Export a backup to keep your changes.");
};

/** Run a write against IndexedDB without blocking the UI on it. */
const persist = (write: (database: Database) => Promise<void>) => {
  if (!db) return;
  write(db).catch(reportFailure);
  if (!askedForPersistence) {
    askedForPersistence = true;
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.().catch(() => undefined);
  }
};

export const saveSettings = (partial: Partial<AppState> = {}) => {
  if (Object.keys(partial).length) store.setState(partial);
  const settings = store.settings;
  persist((database) => database.saveSettings(settings));
};

export const openNewExpense = (draft: Partial<Expense> | null = null) => {
  pendingDraft = draft;
  store.setState({ isExpenseFormOpen: true, editingExpenseId: null });
};

export const openEditExpense = (id: string) => {
  pendingDraft = null;
  store.setState({ isExpenseFormOpen: true, editingExpenseId: id });
};

export const closeExpenseForm = () => {
  pendingDraft = null;
  store.setState({ isExpenseFormOpen: false, editingExpenseId: null });
};

let pendingDraft: Partial<Expense> | null = null;
export const takeDraft = () => pendingDraft;

export const saveExpense = (expense: Expense) => {
  const isNew = !store.getState().expenses.some((item) => item.id === expense.id);
  store.upsertExpense(expense);
  closeExpenseForm();
  persist((database) => database.saveExpense(expense));
  showToast(isNew ? `Added ${expense.name}` : `Saved ${expense.name}`);
};

export const deleteExpense = (id: string) => {
  const expense = store.getState().expenses.find((item) => item.id === id);
  if (!expense) return;
  store.removeExpense(id);
  persist((database) => database.deleteExpense(id));
  showToast(`Deleted ${expense.name}`, {
    actionLabel: 'Undo',
    onAction: () => {
      store.upsertExpense(expense);
      persist((database) => database.saveExpense(expense));
    }
  });
};

export const setExpenseStatus = (id: string, status: ExpenseStatus) => {
  const expense = store.getState().expenses.find((item) => item.id === id);
  if (!expense || expense.status === status) return;
  const now = Date.now();
  const updated: Expense = { ...expense, status, updatedAt: now };
  if (status === 'cancelled') updated.cancelledAt = now;
  else delete updated.cancelledAt;
  store.upsertExpense(updated);
  persist((database) => database.saveExpense(updated));
  if (status === 'cancelled') {
    showToast(`Marked ${expense.name} as cancelled`, {
      actionLabel: 'Undo',
      onAction: () => setExpenseStatus(id, expense.status)
    });
  } else {
    showToast(`${expense.name} is back on the map`);
  }
};

export const addCategory = (name: string): Category => {
  const { categories } = store.getState();
  const existing = categories.find((category) => category.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const customCount = categories.filter((category) => category.id.startsWith('custom-')).length;
  const category: Category = {
    id: `custom-${Date.now().toString(36)}`,
    name,
    color: CUSTOM_CATEGORY_COLORS[customCount % CUSTOM_CATEGORY_COLORS.length]
  };
  store.setState({ categories: [...categories, category] });
  persist((database) => database.saveCategories([category]));
  return category;
};

export const replaceAllData = async (payload: BackupPayload, mergeCategories: (c: Category[]) => Category[]) => {
  const categories = mergeCategories(payload.categories);
  const settings = payload.settings ? { ...store.settings, ...payload.settings } : store.settings;
  if (db) await db.replaceAll(payload.expenses, categories, settings);
  store.setState({
    expenses: payload.expenses,
    categories,
    includeOneOffs: settings.includeOneOffs,
    groupByCategory: settings.groupByCategory,
    currency: settings.currency ?? store.getState().currency,
    period: settings.period ?? store.getState().period,
    selectedExpenseId: null,
    selectedCategoryId: null,
    isExpenseFormOpen: false,
    editingExpenseId: null
  });
};

export const addExpenses = (expenses: Expense[]) => {
  store.setState({ expenses: [...store.getState().expenses, ...expenses] });
  persist(async (database) => {
    for (const expense of expenses) await database.saveExpense(expense);
  });
};
