import type { Config } from 'tailwindcss';

// Colours are CSS custom properties (see src/styles/main.css) so light and
// dark mode swap in one place.
export default {
  content: ['./index.html', './src/**/*.{ts,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Public Sans Variable"', '"Public Sans"', 'ui-sans-serif', 'sans-serif']
      },
      colors: {
        paper: 'var(--paper)',
        raised: 'var(--paper-raised)',
        sunk: 'var(--paper-sunk)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        red: 'var(--red-ink)',
        save: 'var(--save-ink)',
        'save-wash': 'var(--save-wash)',
        warn: 'var(--warn-ink)',
        'warn-wash': 'var(--warn-wash)',
        'on-ink': 'var(--on-ink)'
      },
      boxShadow: {
        sheet: 'var(--sheet-shadow)'
      }
    }
  },
  plugins: []
} satisfies Config;
