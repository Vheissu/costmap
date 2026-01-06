export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | 'one_off';

export interface Expense {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  categoryId: string;
  notes?: string;
  status: 'active' | 'cancelled' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  savingsYearly: number;
  effort: 'low' | 'medium' | 'high';
  type: 'cheaper' | 'free' | 'bundle' | 'negotiate' | 'cancel';
  actionSteps?: string[];
}

export interface AppSettings {
  id: 'app-settings';
  includeOneOffs: boolean;
  groupByCategory: boolean;
}

export interface TreemapItem {
  id: string;
  label: string;
  value: number;
  color: string;
  categoryId: string;
  kind: 'expense' | 'category';
}

export interface TreemapNode extends TreemapItem {
  x: number;
  y: number;
  width: number;
  height: number;
}
