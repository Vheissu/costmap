import { Database } from './services/db';
import { mergeWithDefaults, store } from './store';
import { setDatabase } from './actions';
import '../components/app-shell';

const loadFromDatabase = async (db: Database) => {
  await db.init();
  const [expenses, categories, settings] = await Promise.all([
    db.listExpenses(),
    db.listCategories(),
    db.getSettings()
  ]);

  const merged = mergeWithDefaults(categories);
  await db.saveCategories(merged);

  store.setState({ expenses, categories: merged });
  if (settings) {
    store.setState({
      includeOneOffs: settings.includeOneOffs,
      groupByCategory: settings.groupByCategory,
      ...(settings.currency ? { currency: settings.currency } : {}),
      ...(settings.period ? { period: settings.period } : {})
    });
  }
};

export const bootstrap = async () => {
  const db = new Database();
  try {
    await loadFromDatabase(db);
    setDatabase(db);
  } catch (error) {
    // Private browsing modes and locked-down browsers can refuse IndexedDB.
    // Keep the app usable in memory and tell the person.
    console.error('[doughmap] IndexedDB unavailable', error);
    setDatabase(null);
    store.setState({ persistent: false });
  }

  const root = document.querySelector('#app');
  if (!root) return;
  root.replaceChildren(document.createElement('app-shell'));
};
