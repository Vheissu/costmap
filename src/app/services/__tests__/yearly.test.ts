import { describe, expect, it } from 'vitest';
import { toMonthly, toYearly } from '../yearly';
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
});
