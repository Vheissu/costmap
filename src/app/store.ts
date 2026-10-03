import type { AppSettings, Category, Expense, Period, TreemapItem } from '../types';
import { guessCurrency } from './format';
import { toYearly } from './services/yearly';

export type SortKey = 'cost' | 'name' | 'recent';

export interface AppState {
  expenses: Expense[];
  categories: Category[];
  selectedExpenseId: string | null;
  selectedCategoryId: string | null;
  editingExpenseId: string | null;
  isExpenseFormOpen: boolean;
  includeOneOffs: boolean;
  groupByCategory: boolean;
  currency: string;
  period: Period;
  search: string;
  sort: SortKey;
  persistent: boolean;
}

export const OTHER_CATEGORY_ID = 'other';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'housing', name: 'Mortgage / Rent', color: '#E0A526' },
  { id: 'subscriptions', name: 'Subscriptions', color: '#3B78C2' },
  { id: 'utilities', name: 'Utilities & Rates', color: '#1F9E8F' },
  { id: 'fuel', name: 'Fuel', color: '#E5722E' },
  { id: 'education', name: 'Education & Fees', color: '#8C9A2E' },
  { id: 'food', name: 'Food & Dining', color: '#C8432F' },
  { id: 'transport', name: 'Transport', color: '#5C7A99' },
  { id: 'health', name: 'Health & Fitness', color: '#3E9B57' },
  { id: 'shopping', name: 'Shopping', color: '#E07AA0' },
  { id: 'entertainment', name: 'Entertainment', color: '#9B4F96' },
  { id: OTHER_CATEGORY_ID, name: 'Other', color: '#8A867D' }
];

/** Colours handed to categories people create themselves, in order. */
export const CUSTOM_CATEGORY_COLORS = ['#B5651D', '#2A8FBD', '#C2A000', '#6B8E23', '#D65F5F', '#7D6B5D'];

const initialState: AppState = {
  expenses: [],
  categories: DEFAULT_CATEGORIES,
  selectedExpenseId: null,
  selectedCategoryId: null,
  editingExpenseId: null,
  isExpenseFormOpen: false,
  includeOneOffs: false,
  groupByCategory: false,
  currency: guessCurrency(),
  period: 'year',
  search: '',
  sort: 'cost',
  persistent: true
};

type Listener = (state: AppState) => void;

export const yearlyOf = (expense: Expense) => toYearly(expense.amount, expense.frequency);

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

  get settings(): AppSettings {
    const { includeOneOffs, groupByCategory, currency, period } = this.state;
    return { id: 'app-settings', includeOneOffs, groupByCategory, currency, period };
  }

  upsertExpense(expense: Expense) {
    const existing = this.state.expenses.some((item) => item.id === expense.id);
    const expenses = existing
      ? this.state.expenses.map((item) => (item.id === expense.id ? expense : item))
      : [...this.state.expenses, expense];
    this.setState({ expenses });
  }

  removeExpense(id: string) {
    this.setState({
      expenses: this.state.expenses.filter((item) => item.id !== id),
      selectedExpenseId: this.state.selectedExpenseId === id ? null : this.state.selectedExpenseId
    });
  }

  categoryFor(categoryId: string): Category {
    const { categories } = this.state;
    return (
      categories.find((cat) => cat.id === categoryId) ??
      categories.find((cat) => cat.id === OTHER_CATEGORY_ID) ??
      DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]
    );
  }

  /** Expenses that count toward the map and totals. */
  get activeExpenses() {
    return this.state.expenses.filter((expense) => {
      if (expense.status !== 'active') return false;
      if (!this.state.includeOneOffs && expense.frequency === 'one_off') return false;
      return true;
    });
  }

  get cancelledExpenses() {
    return this.state.expenses.filter((expense) => expense.status === 'cancelled');
  }

  get hiddenOneOffCount() {
    if (this.state.includeOneOffs) return 0;
    return this.state.expenses.filter(
      (expense) => expense.status === 'active' && expense.frequency === 'one_off'
    ).length;
  }

  get selectedExpense() {
    return this.state.expenses.find((expense) => expense.id === this.state.selectedExpenseId) ?? null;
  }

  get selectedCategory() {
    return this.state.categories.find((category) => category.id === this.state.selectedCategoryId) ?? null;
  }

  get editingExpense() {
    return this.state.expenses.find((expense) => expense.id === this.state.editingExpenseId) ?? null;
  }

  get totalYearlyCost() {
    return this.activeExpenses.reduce((sum, expense) => sum + yearlyOf(expense), 0);
  }

  /** Yearly amount no longer being paid for things marked cancelled (recurring only). */
  get yearlySavings() {
    return this.cancelledExpenses
      .filter((expense) => expense.frequency !== 'one_off')
      .reduce((sum, expense) => sum + yearlyOf(expense), 0);
  }

  get categoryTotals() {
    const totals = new Map<string, { category: Category; value: number; count: number }>();
    for (const expense of this.activeExpenses) {
      const category = this.categoryFor(expense.categoryId);
      const current = totals.get(category.id) ?? { category, value: 0, count: 0 };
      current.value += yearlyOf(expense);
      current.count += 1;
      totals.set(category.id, current);
    }
    return Array.from(totals.values()).sort((a, b) => b.value - a.value);
  }

  /** Every non-archived expense, filtered by search and sorted for the list view. */
  get listedExpenses() {
    const query = this.state.search.trim().toLowerCase();
    const filtered = this.state.expenses.filter((expense) => {
      if (expense.status === 'archived') return false;
      if (!query) return true;
      const category = this.categoryFor(expense.categoryId);
      return (
        expense.name.toLowerCase().includes(query) ||
        category.name.toLowerCase().includes(query) ||
        (expense.notes ?? '').toLowerCase().includes(query)
      );
    });

    const rank = (expense: Expense) => (expense.status === 'cancelled' ? 1 : 0);
    return filtered.sort((a, b) => {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      if (this.state.sort === 'name') return a.name.localeCompare(b.name);
      if (this.state.sort === 'recent') return b.updatedAt - a.updatedAt;
      return yearlyOf(b) - yearlyOf(a);
    });
  }

  get treemapItems(): TreemapItem[] {
    if (this.state.groupByCategory) {
      return this.categoryTotals.map(({ value, category }) => ({
        id: category.id,
        label: category.name,
        value,
        color: category.color,
        categoryId: category.id,
        kind: 'category'
      }));
    }

    return this.activeExpenses.map((expense) => {
      const category = this.categoryFor(expense.categoryId);
      return {
        id: expense.id,
        label: expense.name,
        value: yearlyOf(expense),
        color: category.color,
        categoryId: category.id,
        kind: 'expense'
      };
    });
  }
}

export const store = new Store();
