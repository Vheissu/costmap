# Doughmap

Doughmap shows what your bills and subscriptions really cost. Add each one with how much and how often you pay, and it draws a map where every expense gets a block sized by its yearly cost.

Try it live: [https://doughmap.com](https://doughmap.com/)

Everything stays in your browser (IndexedDB). There is no account and no server.

## What it does

- Converts weekly, fortnightly, monthly, quarterly and yearly costs to a common period. Switch the view between per year, per month and per week.
- Draws a squarified treemap, either one tile per expense or grouped by category.
- Lists every expense with search and sort.
- Lets you mark an expense as cancelled. It drops off the map and its yearly cost is counted as money saved.
- Suggests ways to pay less (duplicates, streaming overlap, ad tiers, annual billing, switching providers and similar) and ranks them by estimated saving.
- Supports custom categories and any currency.
- Imports and exports JSON backups (add to or replace your data), exports CSV for spreadsheets, and can delete everything.

Keyboard: `N` adds an expense, `/` searches, `Esc` closes the detail panel.

## Getting started

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Checks:

```bash
npm run typecheck
npm run test
```

## Project structure

- `src/app/` - bootstrap, store, user actions (persistence, undo), formatting, sample data.
- `src/app/services/` - IndexedDB, period conversion, treemap layout, savings suggestions, backup parsing and CSV.
- `src/components/` - Web Components: app shell, treemap, expense list, expense form, detail drawer, toast.
- `src/styles/main.css` - Tailwind entry and the colour tokens for light and dark mode.

Built with Web Components (no framework), TypeScript, Tailwind CSS and Vite.
