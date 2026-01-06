import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FEF3F2',
          500: '#F97316',
          600: '#EA580C'
        },
        accent: {
          mint: '#6EE7B7',
          sky: '#7DD3FC',
          lavender: '#C4B5FD'
        },
        neutral: {
          cream: '#FAFAF9',
          charcoal: '#2D3748'
        }
      }
    }
  },
  plugins: []
} satisfies Config;
