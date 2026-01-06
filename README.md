# Doughmap

Doughmap is a client-side web app for tracking recurring expenses and visualizing yearly impact in a colorful treemap-style mosaic. It is built with Web Components (no framework), TypeScript, Tailwind CSS, and IndexedDB for local-only persistence.

Try it live: [https://doughmap.com](https://doughmap.com/)

## Getting Started

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Run unit tests:

```bash
npm run test
```

## Project Structure

- `src/app/` - bootstrap, store, and service modules (IndexedDB, yearly conversion, treemap layout, recommendations).
- `src/components/` - Web Components for the app shell, forms, treemap view, and detail drawer.
- `src/components/ui/` - reusable UI primitives (button, modal, toast).
- `src/styles/` - Tailwind entry and custom styles.
