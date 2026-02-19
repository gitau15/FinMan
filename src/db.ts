import Dexie, { type Table } from 'dexie';

export interface Transaction {
  id?: number;
  mpesaId: string;
  amount: number;
  date: Date;
  type: 'send' | 'receive' | 'paybill' | 'buygoods' | 'withdraw' | 'other';
  merchant: string;
  cost: number;
  balance: number;
  rawText: string;
  categoryId?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  budgetLimit: number;
}

export class MpesaDatabase extends Dexie {
  transactions!: Table<Transaction>;
  categories!: Table<Category>;

  constructor() {
    super('MpesaBudgeterDB');
    this.version(1).stores({
      transactions: '++id, mpesaId, date, type, merchant, categoryId',
      categories: 'id, name'
    });
  }
}

export const db = new MpesaDatabase();

// Default categories
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Drinks', color: '#ef4444', budgetLimit: 5000 },
  { id: 'transport', name: 'Transport', color: '#3b82f6', budgetLimit: 3000 },
  { id: 'bills', name: 'Bills & Utilities', color: '#f59e0b', budgetLimit: 10000 },
  { id: 'shopping', name: 'Shopping', color: '#8b5cf6', budgetLimit: 5000 },
  { id: 'other', name: 'Other', color: '#6b7280', budgetLimit: 2000 },
];

export async function initializeCategories() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
}
