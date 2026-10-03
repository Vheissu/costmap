import type { AppSettings, Category, Expense, ExpenseStatus, Period } from '../../types';
import { FREQUENCY_LABELS, isFrequency, toMonthly, toYearly } from './yearly';

export const BACKUP_VERSION = '1.0';

export type BackupPayload = {
  version: typeof BACKUP_VERSION;
  exportDate: string;
  expenses: Expense[];
  categories: Category[];
  settings?: AppSettings;
};

export type ParseResult =
  | { ok: true; payload: BackupPayload; skipped: number }
  | { ok: false; error: string };

const STATUSES: ExpenseStatus[] = ['active', 'cancelled', 'archived'];
const PERIODS: Period[] = ['year', 'month', 'week'];
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const timestamp = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

export const sanitizeExpense = (raw: unknown, now = Date.now()): Expense | null => {
  if (!isRecord(raw)) return null;
  const id = text(raw.id, 100);
  const name = text(raw.name, 80);
  const amount = typeof raw.amount === 'string' ? Number(raw.amount) : raw.amount;
  if (!id || !name || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (!isFrequency(raw.frequency)) return null;

  const status = STATUSES.includes(raw.status as ExpenseStatus) ? (raw.status as ExpenseStatus) : 'active';
  const createdAt = timestamp(raw.createdAt, now);
  const expense: Expense = {
    id,
    name,
    amount: Math.round(amount * 100) / 100,
    frequency: raw.frequency,
    categoryId: text(raw.categoryId, 100) || 'other',
    status,
    createdAt,
    updatedAt: timestamp(raw.updatedAt, createdAt)
  };
  const notes = text(raw.notes, 500);
  if (notes) expense.notes = notes;
  if (status === 'cancelled') expense.cancelledAt = timestamp(raw.cancelledAt, expense.updatedAt);
  return expense;
};

export const sanitizeCategory = (raw: unknown): Category | null => {
  if (!isRecord(raw)) return null;
  const id = text(raw.id, 100);
  const name = text(raw.name, 40);
  if (!id || !name) return null;
  const color = typeof raw.color === 'string' && HEX_COLOR.test(raw.color) ? raw.color : '#8A867D';
  return { id, name, color };
};

export const sanitizeSettings = (raw: unknown): AppSettings | undefined => {
  if (!isRecord(raw)) return undefined;
  const settings: AppSettings = {
    id: 'app-settings',
    includeOneOffs: Boolean(raw.includeOneOffs),
    groupByCategory: Boolean(raw.groupByCategory)
  };
  if (typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency)) {
    settings.currency = raw.currency;
  }
  if (PERIODS.includes(raw.period as Period)) settings.period = raw.period as Period;
  return settings;
};

export const parseBackup = (source: string): ParseResult => {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }

  if (!isRecord(data)) return { ok: false, error: 'This file is not a Doughmap backup.' };
  if (data.version !== undefined && data.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(data.version).slice(0, 20)}` };
  }
  if (!Array.isArray(data.expenses) || !Array.isArray(data.categories)) {
    return { ok: false, error: 'This file is missing its expenses or categories.' };
  }

  const now = Date.now();
  const seen = new Set<string>();
  const expenses: Expense[] = [];
  for (const raw of data.expenses) {
    const expense = sanitizeExpense(raw, now);
    if (expense && !seen.has(expense.id)) {
      seen.add(expense.id);
      expenses.push(expense);
    }
  }

  const categoryIds = new Set<string>();
  const categories: Category[] = [];
  for (const raw of data.categories) {
    const category = sanitizeCategory(raw);
    if (category && !categoryIds.has(category.id)) {
      categoryIds.add(category.id);
      categories.push(category);
    }
  }

  return {
    ok: true,
    skipped: data.expenses.length - expenses.length,
    payload: {
      version: BACKUP_VERSION,
      exportDate: typeof data.exportDate === 'string' ? data.exportDate : new Date(now).toISOString(),
      expenses,
      categories,
      settings: sanitizeSettings(data.settings)
    }
  };
};

const csvCell = (value: string | number) => {
  let cell = String(value);
  // Stop spreadsheet apps from evaluating user text as a formula.
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
};

export const buildCsv = (expenses: Expense[], categories: Category[]) => {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const header = ['Name', 'Category', 'Amount', 'Frequency', 'Yearly', 'Monthly', 'Status', 'Notes'];
  const rows = expenses.map((expense) => {
    const yearly = toYearly(expense.amount, expense.frequency);
    return [
      expense.name,
      categoryName.get(expense.categoryId) ?? 'Other',
      expense.amount.toFixed(2),
      FREQUENCY_LABELS[expense.frequency],
      yearly.toFixed(2),
      toMonthly(yearly).toFixed(2),
      expense.status,
      expense.notes ?? ''
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
};
