import { describe, expect, it } from 'vitest';
import { buildCsv, parseBackup } from '../backup';

const valid = {
  id: 'e1',
  name: 'Rent',
  amount: 400,
  frequency: 'weekly',
  categoryId: 'housing',
  status: 'active',
  createdAt: 1,
  updatedAt: 2
};

describe('backup parsing', () => {
  it('rejects malformed files', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('[]').ok).toBe(false);
    expect(parseBackup('{"expenses": []}').ok).toBe(false);
    expect(parseBackup('{"version": "9", "expenses": [], "categories": []}').ok).toBe(false);
  });

  it('keeps valid records and skips broken ones', () => {
    const result = parseBackup(
      JSON.stringify({
        version: '1.0',
        expenses: [
          valid,
          { ...valid, id: 'e2', amount: -5 },
          { ...valid, id: 'e3', frequency: 'hourly' },
          { ...valid, id: 'e4', name: '' },
          { ...valid }, // duplicate id
          'nonsense'
        ],
        categories: [{ id: 'housing', name: 'Housing', color: 'red; background:url(x)' }],
        settings: { includeOneOffs: 1, groupByCategory: false, currency: 'aud', period: 'month' }
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.expenses.map((e) => e.id)).toEqual(['e1']);
    expect(result.skipped).toBe(5);
    expect(result.payload.categories[0].color).toBe('#8A867D');
    expect(result.payload.settings).toEqual({
      id: 'app-settings',
      includeOneOffs: true,
      groupByCategory: false,
      period: 'month'
    });
  });

  it('fills in defaults for older backups', () => {
    const result = parseBackup(
      JSON.stringify({ expenses: [{ id: 'x', name: 'Gym', amount: '20', frequency: 'monthly' }], categories: [] })
    );
    expect(result.ok && result.payload.expenses[0]).toMatchObject({
      amount: 20,
      categoryId: 'other',
      status: 'active'
    });
  });
});

describe('csv export', () => {
  it('quotes fields and neutralises formulas', () => {
    const csv = buildCsv(
      [
        { ...valid, frequency: 'weekly', name: '=HYPERLINK("x")', notes: 'line, with "quotes"' } as never
      ],
      [{ id: 'housing', name: 'Housing', color: '#000' }]
    );
    const [header, row] = csv.split('\r\n');
    expect(header).toBe('Name,Category,Amount,Frequency,Yearly,Monthly,Status,Notes');
    expect(row).toBe(`"'=HYPERLINK(""x"")",Housing,400.00,Weekly,20800.00,1733.33,active,"line, with ""quotes"""`);
  });
});
