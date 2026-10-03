import type { Expense, Recommendation } from '../../types';
import { toYearly } from './yearly';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const bigrams = (value: string) => {
  const joined = normalize(value);
  const pairs: string[] = [];
  for (let i = 0; i < joined.length - 1; i += 1) {
    pairs.push(joined.slice(i, i + 2));
  }
  return pairs;
};

export const similarity = (a: string, b: string) => {
  if (normalize(a) === normalize(b)) return 1;
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

const STREAMING =
  /netflix|disney|hulu|hbo|\bmax\b|prime video|apple tv|paramount|peacock|stan\b|binge|kayo|crunchyroll|britbox|foxtel|youtube tv|now tv|crave/;
const AD_TIERS = /netflix|disney|hulu|hbo|\bmax\b|paramount|peacock|stan\b|prime video/;
const MUSIC = /spotify|apple music|youtube music|tidal|deezer|amazon music/;
const PHONE = /phone|mobile|cell|sim\b|telstra|optus|vodafone|verizon|t-mobile|at&t/;
const INTERNET = /internet|broadband|nbn|fibre|fiber|wifi|comcast|xfinity/;
const ENERGY = /electric|power|energy|\bgas\b|agl|origin/;
const INSURANCE = /insurance|insure|cover\b/;
const GYM = /gym|fitness|f45|crossfit|pilates|yoga|anytime/;

const VARIABLE_SPEND = new Set(['food', 'fuel', 'shopping', 'entertainment']);
const NEGOTIABLE = new Set(['utilities', 'subscriptions', 'health', 'other']);

const isActive = (expense: Expense) => expense.status === 'active';

export const generateRecommendations = (expense: Expense, allExpenses: Expense[]): Recommendation[] => {
  const yearly = toYearly(expense.amount, expense.frequency);
  if (expense.status !== 'active' || yearly <= 0) return [];

  const recs: Recommendation[] = [];
  const name = expense.name.toLowerCase();
  const add = (rec: Omit<Recommendation, 'id'> & { key: string }) => {
    const { key, ...rest } = rec;
    recs.push({
      ...rest,
      id: `rec-${expense.id}-${key}`,
      savingsYearly: Math.max(0, Math.min(yearly, rest.savingsYearly))
    });
  };

  const others = allExpenses.filter((other) => other.id !== expense.id && isActive(other));

  const duplicates = others.filter((other) => similarity(other.name, expense.name) > 0.8);
  if (duplicates.length > 0) {
    add({
      key: 'duplicate',
      title: 'Possible duplicate',
      description: `Looks a lot like ${duplicates.map((dup) => dup.name).join(', ')}. If you're paying twice, cancel one.`,
      savingsYearly: yearly,
      effort: 'low',
      type: 'cancel'
    });
  }

  if (STREAMING.test(name)) {
    const streaming = others.filter((other) => STREAMING.test(other.name.toLowerCase()));
    if (streaming.length >= 2) {
      add({
        key: 'rotate',
        title: 'Rotate your streaming services',
        description: `You pay for ${streaming.length + 1} streaming services. Keep one or two at a time and switch when you've watched what you wanted.`,
        savingsYearly: yearly * 0.5,
        effort: 'low',
        type: 'cancel'
      });
    }
  }

  if (AD_TIERS.test(name)) {
    add({
      key: 'ad-tier',
      title: 'Try the ad-supported plan',
      description: 'Most streaming services now have a cheaper plan with ads. It is often around 40% less.',
      savingsYearly: yearly * 0.4,
      effort: 'low',
      type: 'cheaper'
    });
  }

  if (MUSIC.test(name)) {
    add({
      key: 'music-free',
      title: 'Use the free tier, or a family plan',
      description: 'Free tiers keep the same catalogue with ads. If others in your home pay too, a shared family plan costs less per person.',
      savingsYearly: yearly,
      effort: 'low',
      type: 'free'
    });
  }

  if (PHONE.test(name)) {
    add({
      key: 'phone',
      title: 'Move to a SIM-only or budget carrier plan',
      description: 'Budget carriers usually run on the same networks for much less, especially once your phone is paid off.',
      savingsYearly: yearly * 0.3,
      effort: 'medium',
      type: 'cheaper'
    });
  } else if (INTERNET.test(name) || ENERGY.test(name)) {
    add({
      key: 'switch-provider',
      title: 'Compare providers',
      description: 'Check what new customers pay elsewhere, then ask your provider to match it or switch.',
      savingsYearly: yearly * 0.15,
      effort: 'medium',
      type: 'negotiate'
    });
  } else if (INSURANCE.test(name)) {
    add({
      key: 'insurance',
      title: 'Get quotes before it renews',
      description: 'Insurers often raise prices on renewal. Two or three quotes give you leverage to ask for a better rate.',
      savingsYearly: yearly * 0.15,
      effort: 'medium',
      type: 'negotiate'
    });
  } else if (GYM.test(name)) {
    add({
      key: 'gym',
      title: 'Ask about off-peak or a membership freeze',
      description: 'Off-peak memberships are often much cheaper, and most gyms let you pause during busy months.',
      savingsYearly: yearly * 0.25,
      effort: 'low',
      type: 'cheaper'
    });
  } else if (yearly > 300 && NEGOTIABLE.has(expense.categoryId)) {
    add({
      key: 'negotiate',
      title: 'Ask for a better rate',
      description: 'Call and ask for a loyalty discount or retention offer. Mentioning a cheaper competitor helps.',
      savingsYearly: yearly * 0.1,
      effort: 'medium',
      type: 'negotiate'
    });
  }

  if (expense.frequency === 'monthly' && expense.categoryId === 'subscriptions' && !MUSIC.test(name)) {
    add({
      key: 'annual',
      title: 'Pay yearly instead of monthly',
      description: 'Annual billing is often discounted by about two months. Only worth it if you are sure you will keep it.',
      savingsYearly: yearly * (2 / 12),
      effort: 'low',
      type: 'annual'
    });
  }

  if (VARIABLE_SPEND.has(expense.categoryId) && yearly > 1000) {
    add({
      key: 'cap',
      title: 'Set a spending cap',
      description: 'Pick a weekly limit a little below what you spend now and track against it.',
      savingsYearly: yearly * 0.1,
      effort: 'medium',
      type: 'cheaper'
    });
  }

  return recs.sort((a, b) => b.savingsYearly - a.savingsYearly);
};

/** The single best saving per expense, across everything active. */
export const topSavings = (expenses: Expense[], limit = 3) =>
  expenses
    .filter(isActive)
    .map((expense) => ({ expense, rec: generateRecommendations(expense, expenses)[0] }))
    .filter((entry): entry is { expense: Expense; rec: Recommendation } => Boolean(entry.rec))
    .sort((a, b) => b.rec.savingsYearly - a.rec.savingsYearly)
    .slice(0, limit);
