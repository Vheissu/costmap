import type { Frequency } from '../types';

export type QuickAddItem = { label: string; categoryId: string; frequency: Frequency };

/** Common bills offered as one-click starting points in the form. */
export const QUICK_ADD: QuickAddItem[] = [
  { label: 'Rent', categoryId: 'housing', frequency: 'weekly' },
  { label: 'Mortgage', categoryId: 'housing', frequency: 'monthly' },
  { label: 'Groceries', categoryId: 'food', frequency: 'weekly' },
  { label: 'Electricity', categoryId: 'utilities', frequency: 'quarterly' },
  { label: 'Internet', categoryId: 'utilities', frequency: 'monthly' },
  { label: 'Mobile phone', categoryId: 'utilities', frequency: 'monthly' },
  { label: 'Fuel', categoryId: 'fuel', frequency: 'weekly' },
  { label: 'Car insurance', categoryId: 'transport', frequency: 'yearly' },
  { label: 'Health insurance', categoryId: 'health', frequency: 'monthly' },
  { label: 'Gym', categoryId: 'health', frequency: 'monthly' },
  { label: 'Netflix', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Spotify', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Disney+', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'YouTube Premium', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Prime Video', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Apple TV+', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'iCloud+', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Google One', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Microsoft 365', categoryId: 'subscriptions', frequency: 'yearly' },
  { label: 'ChatGPT', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Claude', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Adobe Creative Cloud', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'Xbox Game Pass', categoryId: 'subscriptions', frequency: 'monthly' },
  { label: 'PlayStation Plus', categoryId: 'subscriptions', frequency: 'yearly' },
  { label: 'Audible', categoryId: 'subscriptions', frequency: 'monthly' }
];

export const findQuickAdd = (name: string) => {
  const needle = name.trim().toLowerCase();
  return QUICK_ADD.find((item) => item.label.toLowerCase() === needle) ?? null;
};
