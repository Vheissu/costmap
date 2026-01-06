import type { Expense, Recommendation } from '../../types';
import { toYearly } from './yearly';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const bigrams = (value: string) => {
  const tokens = normalize(value).split(' ').filter(Boolean);
  const joined = tokens.join(' ');
  const pairs: string[] = [];
  for (let i = 0; i < joined.length - 1; i += 1) {
    pairs.push(joined.slice(i, i + 2));
  }
  return pairs;
};

const similarity = (a: string, b: string) => {
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  if (aPairs.length === 0 || bPairs.length === 0) return 0;
  const bCounts = new Map<string, number>();
  for (const pair of bPairs) {
    bCounts.set(pair, (bCounts.get(pair) ?? 0) + 1);
  }
  let matches = 0;
  for (const pair of aPairs) {
    const count = bCounts.get(pair) ?? 0;
    if (count > 0) {
      matches += 1;
      bCounts.set(pair, count - 1);
    }
  }
  return (2 * matches) / (aPairs.length + bPairs.length);
};

export const generateRecommendations = (expense: Expense, allExpenses: Expense[]): Recommendation[] => {
  const recs: Recommendation[] = [];
  const yearly = toYearly(expense.amount, expense.frequency);
  const name = expense.name.toLowerCase();

  if (/netflix/.test(name)) {
    recs.push({
      id: `rec-${expense.id}-netflix-ads`,
      title: 'Switch to an ad-supported tier',
      description: 'Check if a lower-priced ad plan meets your needs.',
      savingsYearly: 108,
      effort: 'low',
      type: 'cheaper'
    });
  }

  if (/spotify|apple music/.test(name)) {
    recs.push({
      id: `rec-${expense.id}-music-free`,
      title: 'Try the free tier with ads',
      description: 'Free tiers keep the same library if you can handle ads.',
      savingsYearly: yearly,
      effort: 'low',
      type: 'free'
    });
  }

  if (yearly > 500) {
    recs.push({
      id: `rec-${expense.id}-negotiate`,
      title: 'Negotiate your rate',
      description: 'Ask for loyalty discounts or retention offers.',
      savingsYearly: yearly * 0.1,
      effort: 'medium',
      type: 'negotiate'
    });
  }

  const duplicates = allExpenses.filter((other) =>
    other.id !== expense.id && similarity(other.name, expense.name) > 0.8
  );
  if (duplicates.length > 0) {
    recs.push({
      id: `rec-${expense.id}-duplicate`,
      title: 'Possible duplicate subscription',
      description: `Similar to: ${duplicates.map((dup) => dup.name).join(', ')}`,
      savingsYearly: yearly,
      effort: 'medium',
      type: 'cancel'
    });
  }

  return recs;
};
