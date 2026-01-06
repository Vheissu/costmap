import { describe, expect, it } from 'vitest';
import { generateRecommendations } from '../recommendations';
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

  it('adds negotiate suggestion for high yearly cost', () => {
    const expense = baseExpense({ name: 'Gym', amount: 100, frequency: 'monthly' });
    const recs = generateRecommendations(expense, [expense]);
    expect(recs.some((rec) => rec.type === 'negotiate')).toBe(true);
  });

  it('detects possible duplicates', () => {
    const primary = baseExpense({ id: 'exp-1', name: 'Spotify Family' });
    const duplicate = baseExpense({ id: 'exp-2', name: 'Spotify Familly' });
    const recs = generateRecommendations(primary, [primary, duplicate]);
    expect(recs.some((rec) => rec.type === 'cancel')).toBe(true);
  });
});
