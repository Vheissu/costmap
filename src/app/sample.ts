import type { Expense, Frequency } from '../types';

type SampleRow = [name: string, amount: number, frequency: Frequency, categoryId: string, notes?: string];

const ROWS: SampleRow[] = [
  ['Rent', 520, 'weekly', 'housing'],
  ['Groceries', 180, 'weekly', 'food'],
  ['Car fuel', 65, 'weekly', 'fuel'],
  ['Electricity', 420, 'quarterly', 'utilities'],
  ['Internet', 85, 'monthly', 'utilities'],
  ['Mobile phone', 55, 'monthly', 'utilities'],
  ['Car insurance', 980, 'yearly', 'transport', 'Renews in March'],
  ['Car registration', 860, 'yearly', 'transport'],
  ['Health insurance', 210, 'monthly', 'health'],
  ['Gym', 22, 'weekly', 'health'],
  ['Netflix', 18.99, 'monthly', 'subscriptions'],
  ['Disney+', 13.99, 'monthly', 'subscriptions'],
  ['Max', 15.99, 'monthly', 'subscriptions'],
  ['Spotify Family', 23.99, 'monthly', 'subscriptions'],
  ['iCloud+', 4.49, 'monthly', 'subscriptions'],
  ['Takeaway', 45, 'weekly', 'food'],
  ['School fees', 1450, 'quarterly', 'education']
];

export const buildSampleExpenses = (): Expense[] => {
  const now = Date.now();
  return ROWS.map(([name, amount, frequency, categoryId, notes], index) => ({
    id: `sample-${index}-${now.toString(36)}`,
    name,
    amount,
    frequency,
    categoryId,
    ...(notes ? { notes } : {}),
    status: 'active',
    createdAt: now - index * 1000,
    updatedAt: now - index * 1000
  }));
};
