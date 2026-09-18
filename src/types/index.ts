export interface Income {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: string;
  categoryName?: string;
  isReceived: boolean;
  isRecurring?: boolean;
  recurringInterval?: 'weekly' | 'monthly' | 'yearly';
  recurringCount?: number;
  recurringIndex?: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: string;
  categoryName?: string;
  isPaid: boolean;
  isRecurring: boolean;
  recurringInterval?: 'weekly' | 'monthly' | 'yearly';
  recurringCount?: number;
  recurringIndex?: number;
  creditCardId?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  last_four?: string | null;
  due_day: number;
  closing_day?: number | null;
  credit_limit: number;
  color: string;
}

export interface ExpensesByCategory {
  category: string;
  amount: number;
}

export interface ExpensesThisMonth {
  total: number;
  paid: number;
  pending: number;
}

export interface CreditCardSummary extends CreditCard {
  totalExpenses: number;
  expenses: Expense[];
}
