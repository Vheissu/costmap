import type { Category, Expense, TreemapItem } from '../types';
import { toYearly } from './services/yearly';

export interface AppState {
  expenses: Expense[];
  categories: Category[];
  selectedExpenseId: string | null;
  selectedCategoryId: string | null;
  isExpenseFormOpen: boolean;
  includeOneOffs: boolean;
  groupByCategory: boolean;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'housing', name: 'Mortgage / Rent', color: '#FCD34D' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#A5B4FC' },
  { id: 'utilities', name: 'Utilities & Rates', color: '#60A5FA' },
  { id: 'fuel', name: 'Fuel', color: '#FB923C' },
  { id: 'education', name: 'Education & Fees', color: '#34D399' },
  { id: 'food', name: 'Food & Dining', color: '#F59E0B' },
  { id: 'transport', name: 'Transport', color: '#8B5CF6' },
  { id: 'health', name: 'Health & Fitness', color: '#10B981' },
  { id: 'shopping', name: 'Shopping', color: '#EC4899' },
  { id: 'entertainment', name: 'Entertainment', color: '#F472B6' },
  { id: 'other', name: 'Other', color: '#6B7280' }
];

const initialState: AppState = {
  expenses: [],
  categories: DEFAULT_CATEGORIES,
  selectedExpenseId: null,
  selectedCategoryId: null,
  isExpenseFormOpen: false,
  includeOneOffs: false,
  groupByCategory: false
};

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState = initialState;
  private listeners = new Set<Listener>();

  getState() {
    return this.state;
  }

  setState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setExpenses(expenses: Expense[]) {
    this.setState({ expenses });
  }

  setCategories(categories: Category[]) {
    this.setState({ categories });
  }

  upsertExpense(expense: Expense) {
    const existing = this.state.expenses.find((item) => item.id === expense.id);
    const expenses = existing
      ? this.state.expenses.map((item) => (item.id === expense.id ? expense : item))
      : [...this.state.expenses, expense];
    this.setState({ expenses });
  }

  removeExpense(id: string) {
    this.setState({ expenses: this.state.expenses.filter((item) => item.id !== id) });
  }

  get activeExpenses() {
    return this.state.expenses.filter((expense) => {
      if (expense.status !== 'active') return false;
      if (!this.state.includeOneOffs && expense.frequency === 'one_off') return false;
      return true;
    });
  }

  get selectedExpense() {
    return this.state.expenses.find((expense) => expense.id === this.state.selectedExpenseId) ?? null;
  }

  get selectedCategory() {
    return this.state.categories.find((category) => category.id === this.state.selectedCategoryId) ?? null;
  }

  get totalYearlyCost() {
    return this.activeExpenses.reduce((sum, expense) => sum + toYearly(expense.amount, expense.frequency), 0);
  }

  get treemapItems(): TreemapItem[] {
    if (this.state.groupByCategory) {
      const totals = new Map<string, { value: number; category: Category }>();
      for (const expense of this.activeExpenses) {
        const category =
          this.state.categories.find((cat) => cat.id === expense.categoryId) ??
          this.state.categories[this.state.categories.length - 1];
        const current = totals.get(category.id) ?? { value: 0, category };
        current.value += toYearly(expense.amount, expense.frequency);
        totals.set(category.id, current);
      }
      return Array.from(totals.values()).map(({ value, category }) => ({
        id: category.id,
        label: category.name,
        value,
        color: category.color,
        categoryId: category.id,
        kind: 'category'
      }));
    }

    return this.activeExpenses.map((expense) => {
      const category =
        this.state.categories.find((cat) => cat.id === expense.categoryId) ??
        this.state.categories[this.state.categories.length - 1];
      return {
        id: expense.id,
        label: expense.name,
        value: toYearly(expense.amount, expense.frequency),
        color: category.color,
        categoryId: category.id,
        kind: 'expense'
      };
    });
  }
}

export const store = new Store();
