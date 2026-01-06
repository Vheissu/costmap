import type { Frequency } from '../../types';

const MULTIPLIERS: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  one_off: 1
};

export const toYearly = (amount: number, frequency: Frequency) => {
  return amount * MULTIPLIERS[frequency];
};

export const toMonthly = (yearly: number) => yearly / 12;
