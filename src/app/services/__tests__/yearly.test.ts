import { describe, expect, it } from 'vitest';
import { toMonthly, toPeriod, toYearly } from '../yearly';
import type { Frequency } from '../../../types';

describe('yearly conversions', () => {
  const amount = 10;
  const cases: Array<[Frequency, number]> = [
    ['weekly', 520],
    ['fortnightly', 260],
    ['monthly', 120],
    ['quarterly', 40],
    ['yearly', 10],
    ['one_off', 10]
  ];

  it('converts frequencies to yearly totals', () => {
    cases.forEach(([frequency, expected]) => {
      expect(toYearly(amount, frequency)).toBe(expected);
    });
  });

  it('converts yearly totals to monthly', () => {
    expect(toMonthly(120)).toBe(10);
  });

  it('converts yearly totals to any display period', () => {
    expect(toPeriod(520, 'year')).toBe(520);
    expect(toPeriod(520, 'week')).toBe(10);
    expect(toPeriod(120, 'month')).toBe(10);
  });
});
