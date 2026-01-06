import { Database } from './services/db';
import { DEFAULT_CATEGORIES, store } from './store';
import '../components/app-shell';

export const bootstrap = async () => {
  const db = new Database();
  await db.init();

  const [expenses, categories, settings] = await Promise.all([
    db.listExpenses(),
    db.listCategories(),
    db.getSettings()
  ]);

  if (categories.length === 0) {
    await db.saveCategories(DEFAULT_CATEGORIES);
    store.setState({ categories: DEFAULT_CATEGORIES });
  } else {
    const defaultIds = new Set(DEFAULT_CATEGORIES.map((category) => category.id));
    const extras = categories.filter((category) => !defaultIds.has(category.id));
    const merged = [...DEFAULT_CATEGORIES, ...extras];
    await db.saveCategories(merged);
    store.setState({ categories: merged });
  }

  store.setState({ expenses });
  if (settings) {
    store.setState({
      includeOneOffs: settings.includeOneOffs,
      groupByCategory: settings.groupByCategory
    });
  }

  const root = document.querySelector('#app');
  if (!root) return;

  const shell = document.createElement('app-shell') as any;
  shell.database = db;
  root.innerHTML = '';
  root.appendChild(shell);
};
