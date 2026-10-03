import { describe, expect, it } from 'vitest';
import { mergeWithDefaults, Store, DEFAULT_CATEGORIES } from '../../store';
import type { Expense } from '../../../types';

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'e',
  name: 'Thing',
  amount: 10,
  frequency: 'monthly',
  categoryId: 'subscriptions',
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const seeded = (expenses: Expense[]) => {
  const store = new Store();
  store.setState({ expenses });
  return store;
};

describe('store', () => {
  it('totals active recurring expenses and leaves out hidden one-offs', () => {
    const store = seeded([
      expense({ id: 'a', amount: 10 }),
      expense({ id: 'b', amount: 100, frequency: 'one_off' }),
      expense({ id: 'c', amount: 50, status: 'cancelled' })
    ]);
    expect(store.totalYearlyCost).toBe(120);
    expect(store.hiddenOneOffCount).toBe(1);
    store.setState({ includeOneOffs: true });
    expect(store.totalYearlyCost).toBe(220);
    expect(store.hiddenOneOffCount).toBe(0);
  });

  it('counts recurring cancelled expenses as yearly savings', () => {
    const store = seeded([
      expense({ id: 'a', amount: 10, status: 'cancelled' }),
      expense({ id: 'b', amount: 99, frequency: 'one_off', status: 'cancelled' })
    ]);
    expect(store.yearlySavings).toBe(120);
  });

  it('falls back to Other for unknown categories', () => {
    const store = seeded([expense({ categoryId: 'deleted-category' })]);
    expect(store.treemapItems[0].categoryId).toBe('other');
  });

  it('groups treemap items by category', () => {
    const store = seeded([
      expense({ id: 'a', amount: 10 }),
      expense({ id: 'b', amount: 5 }),
      expense({ id: 'c', amount: 100, categoryId: 'housing' })
    ]);
    store.setState({ groupByCategory: true });
    expect(store.treemapItems.map((item) => [item.id, item.value])).toEqual([
      ['housing', 1200],
      ['subscriptions', 180]
    ]);
  });

  it('searches and sorts the list, cancelled last', () => {
    const store = seeded([
      expense({ id: 'a', name: 'Netflix', amount: 20 }),
      expense({ id: 'b', name: 'Rent', amount: 2000, categoryId: 'housing' }),
      expense({ id: 'c', name: 'Gym', amount: 5000, status: 'cancelled' })
    ]);
    expect(store.listedExpenses.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    store.setState({ sort: 'name' });
    expect(store.listedExpenses.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    store.setState({ search: 'mortgage' });
    expect(store.listedExpenses.map((e) => e.id)).toEqual(['b']);
  });

  it('clears the selection when the selected expense is removed', () => {
    const store = seeded([expense({ id: 'a' })]);
    store.setState({ selectedExpenseId: 'a' });
    store.removeExpense('a');
    expect(store.getState().selectedExpenseId).toBeNull();
  });

  it('keeps custom categories after the defaults', () => {
    const custom = { id: 'custom-1', name: 'Pets', color: '#123456' };
    const merged = mergeWithDefaults([{ ...DEFAULT_CATEGORIES[0], color: '#000000' }, custom]);
    expect(merged[0]).toEqual(DEFAULT_CATEGORIES[0]);
    expect(merged.at(-1)).toEqual(custom);
  });
});
