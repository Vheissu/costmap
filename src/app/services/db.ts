import type { AppSettings, Category, Expense } from '../../types';

const DB_NAME = 'costmap';
const DB_VERSION = 1;
const SETTINGS_ID: AppSettings['id'] = 'app-settings';

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

export class Database {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };

    this.db = await requestToPromise(request);
  }

  private getStore(storeName: 'expenses' | 'categories' | 'settings', mode: IDBTransactionMode) {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async listExpenses(): Promise<Expense[]> {
    const store = this.getStore('expenses', 'readonly');
    return await requestToPromise(store.getAll());
  }

  async getExpense(id: string): Promise<Expense | null> {
    const store = this.getStore('expenses', 'readonly');
    const result = await requestToPromise(store.get(id));
    return result ?? null;
  }

  async saveExpense(expense: Expense): Promise<void> {
    const transaction = this.getStore('expenses', 'readwrite').transaction;
    transaction.objectStore('expenses').put(expense);
    await transactionDone(transaction);
  }

  async deleteExpense(id: string): Promise<void> {
    const transaction = this.getStore('expenses', 'readwrite').transaction;
    transaction.objectStore('expenses').delete(id);
    await transactionDone(transaction);
  }

  async listCategories(): Promise<Category[]> {
    const store = this.getStore('categories', 'readonly');
    return await requestToPromise(store.getAll());
  }

  async getSettings(): Promise<AppSettings | null> {
    const store = this.getStore('settings', 'readonly');
    const result = await requestToPromise(store.get(SETTINGS_ID));
    return result ?? null;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const transaction = this.getStore('settings', 'readwrite').transaction;
    transaction.objectStore('settings').put(settings);
    await transactionDone(transaction);
  }

  async replaceAll(expenses: Expense[], categories: Category[], settings?: AppSettings): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['expenses', 'categories', 'settings'], 'readwrite');
    transaction.objectStore('expenses').clear();
    transaction.objectStore('categories').clear();
    transaction.objectStore('settings').clear();

    expenses.forEach((expense) => transaction.objectStore('expenses').put(expense));
    categories.forEach((category) => transaction.objectStore('categories').put(category));
    if (settings) {
      transaction.objectStore('settings').put(settings);
    }

    await transactionDone(transaction);
  }

  async saveCategory(category: Category): Promise<void> {
    const transaction = this.getStore('categories', 'readwrite').transaction;
    transaction.objectStore('categories').put(category);
    await transactionDone(transaction);
  }

  async saveCategories(categories: Category[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction('categories', 'readwrite');
    const store = transaction.objectStore('categories');
    categories.forEach((category) => store.put(category));
    await transactionDone(transaction);
  }
}
