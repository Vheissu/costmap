import { describe, expect, it } from 'vitest';
import { generateRecommendations, topSavings } from '../recommendations';
import type { Expense } from '../../../types';

const baseExpense = (overrides: Partial<Expense>): Expense => ({
  id: 'exp-1',
  name: 'Netflix Premium',
  amount: 15.99,
  frequency: 'monthly',
  categoryId: 'entertainment',
  status: 'active',
  createdAt: 0,
  updatedAt: 0,
  ...overrides
});

describe('recommendation rules', () => {
  it('adds targeted suggestions for known services', () => {
    const expense = baseExpense({ name: 'Netflix Premium' });
    const recs = generateRecommendations(expense, [expense]);
    expect(recs.some((rec) => rec.type === 'cheaper')).toBe(true);
  });

  it('adds negotiate suggestion for high yearly cost in negotiable categories', () => {
    const expense = baseExpense({ name: 'Home security', amount: 100, categoryId: 'other' });
    const recs = generateRecommendations(expense, [expense]);
    expect(recs.some((rec) => rec.type === 'negotiate')).toBe(true);
  });

  it('does not suggest negotiating groceries', () => {
    const expense = baseExpense({ name: 'Groceries', amount: 200, frequency: 'weekly', categoryId: 'food' });
    const recs = generateRecommendations(expense, [expense]);
    expect(recs.some((rec) => rec.type === 'negotiate')).toBe(false);
    expect(recs.some((rec) => rec.id.endsWith('cap'))).toBe(true);
  });

  it('detects possible duplicates', () => {
    const primary = baseExpense({ id: 'exp-1', name: 'Spotify Family' });
    const duplicate = baseExpense({ id: 'exp-2', name: 'Spotify Familly' });
    const recs = generateRecommendations(primary, [primary, duplicate]);
    expect(recs.some((rec) => rec.type === 'cancel')).toBe(true);
  });

  it('ignores cancelled expenses when looking for duplicates', () => {
    const primary = baseExpense({ id: 'exp-1', name: 'Gym' });
    const old = baseExpense({ id: 'exp-2', name: 'Gym', status: 'cancelled' });
    const recs = generateRecommendations(primary, [primary, old]);
    expect(recs.some((rec) => rec.id.endsWith('duplicate'))).toBe(false);
  });

  it('suggests rotating when there are several streaming services', () => {
    const all = ['Netflix', 'Disney+', 'Max'].map((name, i) => baseExpense({ id: `s${i}`, name }));
    const recs = generateRecommendations(all[0], all);
    expect(recs.some((rec) => rec.id.endsWith('rotate'))).toBe(true);
  });

  it('never estimates more savings than the expense costs', () => {
    const expense = baseExpense({ name: 'Netflix', amount: 1, frequency: 'yearly' });
    const recs = generateRecommendations(expense, [expense]);
    recs.forEach((rec) => expect(rec.savingsYearly).toBeLessThanOrEqual(1));
  });

  it('has nothing to say about cancelled expenses', () => {
    const expense = baseExpense({ status: 'cancelled' });
    expect(generateRecommendations(expense, [expense])).toEqual([]);
  });

  it('ranks the biggest savings first', () => {
    const small = baseExpense({ id: 'a', name: 'Netflix', amount: 10 });
    const big = baseExpense({ id: 'b', name: 'Mobile phone', amount: 90, categoryId: 'utilities' });
    const top = topSavings([small, big]);
    expect(top[0].expense.id).toBe('b');
  });
});
