import type { Frequency, Period } from '../../types';

const MULTIPLIERS: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  one_off: 1
};

const PERIODS_PER_YEAR: Record<Period, number> = {
  year: 1,
  month: 12,
  week: 52
};

export const FREQUENCIES: { label: string; value: Frequency }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Fortnightly', value: 'fortnightly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'One-off', value: 'one_off' }
];

export const FREQUENCY_LABELS = Object.fromEntries(
  FREQUENCIES.map((item) => [item.value, item.label])
) as Record<Frequency, string>;

export const isFrequency = (value: unknown): value is Frequency =>
  typeof value === 'string' && value in MULTIPLIERS;

export const toYearly = (amount: number, frequency: Frequency) => {
  return amount * MULTIPLIERS[frequency];
};

export const toMonthly = (yearly: number) => yearly / 12;

export const toPeriod = (yearly: number, period: Period) => yearly / PERIODS_PER_YEAR[period];
