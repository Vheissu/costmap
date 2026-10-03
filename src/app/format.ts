import type { Period } from '../types';

const locale = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

const formatters = new Map<string, Intl.NumberFormat>();

const getFormatter = (key: string, options: Intl.NumberFormatOptions) => {
  let formatter = formatters.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale(), options);
    } catch {
      // Unknown currency codes throw; fall back to plain decimals.
      formatter = new Intl.NumberFormat(locale(), {
        minimumFractionDigits: options.minimumFractionDigits,
        maximumFractionDigits: options.maximumFractionDigits
      });
    }
    formatters.set(key, formatter);
  }
  return formatter;
};

const safe = (amount: number) => (Number.isFinite(amount) ? amount : 0);

export const formatAmount = (amount: number) =>
  getFormatter('decimal', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe(amount));

export const formatMoney = (amount: number, currency: string) =>
  getFormatter(`money:${currency}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe(amount));

/** Whole-unit money for tight spaces, e.g. "$1,240". */
export const formatMoneyShort = (amount: number, currency: string) =>
  getFormatter(`money-short:${currency}`, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safe(amount));

export const formatPercent = (share: number) => {
  const percent = safe(share) * 100;
  if (percent > 0 && percent < 0.1) return '<0.1%';
  return `${percent >= 10 ? percent.toFixed(0) : percent.toFixed(1)}%`;
};

export const PERIOD_SUFFIX: Record<Period, string> = {
  year: '/yr',
  month: '/mo',
  week: '/wk'
};

export const PERIOD_LABEL: Record<Period, string> = {
  year: 'Yearly',
  month: 'Monthly',
  week: 'Weekly'
};

/** Guess a currency from the browser locale's region. */
export const guessCurrency = () => {
  const region = locale().split('-')[1]?.toUpperCase();
  const byRegion: Record<string, string> = {
    US: 'USD', AU: 'AUD', NZ: 'NZD', GB: 'GBP', CA: 'CAD', IE: 'EUR', DE: 'EUR', FR: 'EUR',
    ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', JP: 'JPY',
    IN: 'INR', SG: 'SGD', ZA: 'ZAR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', BR: 'BRL',
    MX: 'MXN', HK: 'HKD', KR: 'KRW', PL: 'PLN'
  };
  return (region && byRegion[region]) || 'USD';
};

export const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN',
  'INR', 'SGD', 'HKD', 'KRW', 'ZAR', 'BRL', 'MXN'
];

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/** Escape user-provided text before it goes anywhere near innerHTML. */
export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
