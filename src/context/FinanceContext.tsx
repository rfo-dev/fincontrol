import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Income, Expense, CreditCard, ExpensesByCategory, CreditCardSummary } from '../types';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { toApiDate, toLocalCalendarDate } from '../utils/formatters';

export const isSameMonth = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth();
};

export const isBeforeMonth = (date: Date, month: Date): boolean => {
  const d = new Date(date);
  return (
    d.getFullYear() < month.getFullYear() ||
    (d.getFullYear() === month.getFullYear() && d.getMonth() < month.getMonth())
  );
};

export interface CarryoverSummary {
  total: number;
  count: number;
}

interface FinanceContextType {
  incomes: Income[];
  expenses: Expense[];
  creditCards: CreditCard[];
  getBringPreviousExpenses: (month: Date) => boolean;
  getBringPreviousIncomes: (month: Date) => boolean;
  setBringPreviousExpenses: (month: Date, value: boolean) => Promise<void>;
  setBringPreviousIncomes: (month: Date, value: boolean) => Promise<void>;
  getPreviousUnpaidExpenses: (month: Date) => CarryoverSummary;
  getPreviousUnreceivedIncomes: (month: Date) => CarryoverSummary;
  settlePreviousExpenses: (month: Date) => Promise<void>;
  settlePreviousIncomes: (month: Date) => Promise<void>;
  addIncome: (income: Omit<Income, 'id' | 'category'> & { categoryName: string }) => Promise<void>;
  updateIncome: (id: string, income: Partial<Income> & { categoryName?: string; editScope?: 'single' | 'series' }) => Promise<void>;
  toggleIncomeReceived: (id: string) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'category'> & { categoryName: string }) => Promise<void>;
  addCreditCard: (creditCard: Omit<CreditCard, 'id'>) => Promise<void>;
  updateCreditCard: (id: string, creditCard: Partial<CreditCard>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense> & { categoryName?: string; editScope?: 'single' | 'series' }) => Promise<void>;
  deleteExpense: (id: string, options?: { deleteScope?: 'single' | 'series' }) => Promise<void>;
  deleteIncome: (id: string, options?: { deleteScope?: 'single' | 'series' }) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;
  toggleExpensePaid: (id: string) => Promise<void>;
  getUpcomingExpenses: () => Expense[];
  getExpensesByCategory: (month: Date) => ExpensesByCategory[];
  getTotalExpensesForMonth: (month: Date) => number;
  getTotalIncomeForMonth: (month: Date) => number;
  getCreditCardSummaries: (month?: Date) => CreditCardSummary[];
  getAvailableMonths: () => Date[];
  fetchExpenses: () => Promise<void>;
  fetchIncomes: () => Promise<void>;
  getCreditCardExpensesSummary: () => { creditCardId: string; totalAmount: number; count: number; cardName: string }[];
  markCreditCardAsPaid: (creditCardId: string, month: Date, isPaid?: boolean) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};

const normalizeIncome = (row: Income): Income => ({
  ...row,
  date: toLocalCalendarDate(row.date),
});

const normalizeExpense = (row: Expense): Expense => ({
  ...row,
  date: toLocalCalendarDate(row.date),
});

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const { user, updateMonthPreferences } = useAuthStore();

  const getBringPreviousExpenses = (month: Date): boolean => {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    return user?.monthCarryoverPrefs?.[key]?.expenses ?? false;
  };

  const getBringPreviousIncomes = (month: Date): boolean => {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    return user?.monthCarryoverPrefs?.[key]?.incomes ?? false;
  };

  const setBringPreviousExpenses = async (month: Date, value: boolean) => {
    await updateMonthPreferences(month, { bringPreviousExpenses: value });
  };

  const setBringPreviousIncomes = async (month: Date, value: boolean) => {
    await updateMonthPreferences(month, { bringPreviousIncomes: value });
  };

  const getPreviousUnpaidExpenses = (month: Date): CarryoverSummary => {
    const items = expenses.filter(
      (expense) => !expense.isPaid && isBeforeMonth(new Date(expense.date), month)
    );
    return {
      total: items.reduce((sum, expense) => sum + expense.amount, 0),
      count: items.length,
    };
  };

  const getPreviousUnreceivedIncomes = (month: Date): CarryoverSummary => {
    const items = incomes.filter(
      (income) => !income.isReceived && isBeforeMonth(new Date(income.date), month)
    );
    return {
      total: items.reduce((sum, income) => sum + income.amount, 0),
      count: items.length,
    };
  };

  const settlePreviousExpenses = async (month: Date) => {
    if (!user) throw new Error('User must be authenticated');
    await api<{ updated: number }>('/api/expenses/settle-previous', {
      method: 'POST',
      body: JSON.stringify({
        year: month.getFullYear(),
        month: month.getMonth(),
      }),
    });
    await fetchExpenses();
  };

  const settlePreviousIncomes = async (month: Date) => {
    if (!user) throw new Error('User must be authenticated');
    await api<{ updated: number }>('/api/incomes/settle-previous', {
      method: 'POST',
      body: JSON.stringify({
        year: month.getFullYear(),
        month: month.getMonth(),
      }),
    });
    await fetchIncomes();
  };

  const fetchExpenses = async () => {
    if (!user) return;
    const data = await api<Expense[]>('/api/expenses');
    setExpenses(data.map(normalizeExpense));
  };

  const fetchIncomes = async () => {
    if (!user) return;
    const data = await api<Income[]>('/api/incomes');
    setIncomes(data.map(normalizeIncome));
  };

  const fetchCreditCards = async () => {
    if (!user) return;
    const data = await api<CreditCard[]>('/api/credit-cards');
    setCreditCards(data);
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setIncomes([]);
      setExpenses([]);
      setCreditCards([]);
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      await Promise.all([fetchIncomes(), fetchExpenses(), fetchCreditCards()]);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const addIncome = async (income: Omit<Income, 'id' | 'category'> & { categoryName: string }) => {
    if (!user) {
      throw new Error('User must be authenticated to add income');
    }

    try {
      const data = await api<Income>('/api/incomes', {
        method: 'POST',
        body: JSON.stringify({
          description: income.description,
          amount: income.amount,
          date: toApiDate(income.date),
          categoryName: income.categoryName,
          isReceived: income.isReceived || false,
          isRecurring: income.isRecurring || false,
          recurringInterval: income.recurringInterval,
          recurringCount: income.recurringCount,
          recurringIndex: income.recurringIndex,
        }),
      });
      setIncomes((prev) => [...prev, normalizeIncome(data)]);
    } catch (error) {
      console.error('Error adding income:', error);
      throw error;
    }
  };

  const updateIncome = async (
    id: string,
    updatedFields: Partial<Income> & { categoryName?: string; editScope?: 'single' | 'series' }
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to update income');
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updatedFields.description !== undefined) payload.description = updatedFields.description;
      if (updatedFields.amount !== undefined) payload.amount = updatedFields.amount;
      if (updatedFields.date !== undefined) payload.date = toApiDate(updatedFields.date);
      if (updatedFields.isReceived !== undefined) payload.isReceived = updatedFields.isReceived;
      if (updatedFields.isRecurring !== undefined) payload.isRecurring = updatedFields.isRecurring;
      if (updatedFields.recurringInterval !== undefined) {
        payload.recurringInterval = updatedFields.recurringInterval;
      }
      if (updatedFields.categoryName !== undefined) payload.categoryName = updatedFields.categoryName;
      if (updatedFields.editScope !== undefined) payload.editScope = updatedFields.editScope;

      const data = await api<Income>(`/api/incomes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (updatedFields.editScope === 'series') {
        await fetchIncomes();
      } else {
        setIncomes((prev) =>
          prev.map((income) => (income.id === id ? { ...income, ...normalizeIncome(data) } : income))
        );
      }
    } catch (error) {
      console.error('Error updating income:', error);
      throw error;
    }
  };

  const deleteIncome = async (
    id: string,
    options?: { deleteScope?: 'single' | 'series' }
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to delete income');
    }

    try {
      const scope = options?.deleteScope === 'series' ? 'series' : 'single';
      await api<void>(`/api/incomes/${id}?scope=${scope}`, { method: 'DELETE' });

      if (scope === 'series') {
        await fetchIncomes();
      } else {
        setIncomes((prev) => prev.filter((income) => income.id !== id));
      }
    } catch (error) {
      console.error('Error deleting income:', error);
      throw error;
    }
  };

  const toggleIncomeReceived = async (id: string) => {
    if (!user) {
      throw new Error('User must be authenticated to toggle income received status');
    }

    const income = incomes.find((i) => i.id === id);
    if (!income) return;

    try {
      const data = await api<Income>(`/api/incomes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isReceived: !income.isReceived }),
      });

      setIncomes((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...normalizeIncome(data) } : i))
      );
    } catch (error) {
      console.error('Error toggling income received status:', error);
      throw error;
    }
  };

  const addExpense = async (expense: Omit<Expense, 'id' | 'category'> & { categoryName: string }) => {
    if (!user) {
      throw new Error('User must be authenticated to add expense');
    }

    try {
      const data = await api<Expense>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description: expense.description,
          amount: expense.amount,
          date: toApiDate(expense.date),
          categoryName: expense.categoryName,
          isPaid: expense.isPaid,
          isRecurring: expense.isRecurring,
          recurringInterval: expense.recurringInterval,
          recurringCount: expense.recurringCount,
          recurringIndex: expense.recurringIndex,
          creditCardId: expense.creditCardId,
        }),
      });
      setExpenses((prev) => [...prev, normalizeExpense(data)]);
    } catch (error) {
      console.error('Error adding expense:', error);
      throw error;
    }
  };

  const updateExpense = async (
    id: string,
    updatedFields: Partial<Expense> & { categoryName?: string; editScope?: 'single' | 'series' }
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to update expense');
    }

    try {
      const payload: Record<string, unknown> = {};
      if (updatedFields.description !== undefined) payload.description = updatedFields.description;
      if (updatedFields.amount !== undefined) payload.amount = updatedFields.amount;
      if (updatedFields.date !== undefined) payload.date = toApiDate(updatedFields.date);
      if (updatedFields.isPaid !== undefined) payload.isPaid = updatedFields.isPaid;
      if (updatedFields.isRecurring !== undefined) payload.isRecurring = updatedFields.isRecurring;
      if (updatedFields.recurringInterval !== undefined) {
        payload.recurringInterval = updatedFields.recurringInterval;
      }
      if (updatedFields.creditCardId !== undefined) payload.creditCardId = updatedFields.creditCardId;
      if (updatedFields.categoryName !== undefined) payload.categoryName = updatedFields.categoryName;
      if (updatedFields.editScope !== undefined) payload.editScope = updatedFields.editScope;

      const data = await api<Expense>(`/api/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      if (updatedFields.editScope === 'series') {
        await fetchExpenses();
      } else {
        setExpenses((prev) =>
          prev.map((expense) =>
            expense.id === id ? { ...expense, ...normalizeExpense(data) } : expense
          )
        );
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      throw error;
    }
  };

  const deleteExpense = async (
    id: string,
    options?: { deleteScope?: 'single' | 'series' }
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to delete expense');
    }

    try {
      const scope = options?.deleteScope === 'series' ? 'series' : 'single';
      await api<void>(`/api/expenses/${id}?scope=${scope}`, { method: 'DELETE' });

      if (scope === 'series') {
        await fetchExpenses();
      } else {
        setExpenses((prev) => prev.filter((expense) => expense.id !== id));
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  };

  const toggleExpensePaid = async (id: string) => {
    if (!user) {
      throw new Error('User must be authenticated to toggle expense status');
    }

    const expense = expenses.find((e) => e.id === id);
    if (!expense) return;

    try {
      const data = await api<Expense>(`/api/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPaid: !expense.isPaid }),
      });

      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...normalizeExpense(data) } : e))
      );
    } catch (error) {
      console.error('Error toggling expense paid status:', error);
      throw error;
    }
  };

  const addCreditCard = async (creditCard: Omit<CreditCard, 'id'>) => {
    if (!user) {
      throw new Error('User must be authenticated to add credit card');
    }

    try {
      const data = await api<CreditCard>('/api/credit-cards', {
        method: 'POST',
        body: JSON.stringify(creditCard),
      });
      setCreditCards((prev) => [...prev, data]);
    } catch (error) {
      console.error('Error adding credit card:', error);
      throw error;
    }
  };

  const updateCreditCard = async (id: string, updatedFields: Partial<CreditCard>) => {
    if (!user) {
      throw new Error('User must be authenticated to update credit card');
    }

    try {
      const data = await api<CreditCard>(`/api/credit-cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updatedFields),
      });
      setCreditCards((prev) =>
        prev.map((card) => (card.id === id ? { ...card, ...data } : card))
      );
    } catch (error) {
      console.error('Error updating credit card:', error);
      throw error;
    }
  };

  const deleteCreditCard = async (id: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete credit card');
    }

    try {
      await api<void>(`/api/credit-cards/${id}`, { method: 'DELETE' });
      setCreditCards((prev) => prev.filter((card) => card.id !== id));
      setExpenses((prev) =>
        prev.map((expense) =>
          expense.creditCardId === id ? { ...expense, creditCardId: undefined } : expense
        )
      );
    } catch (error) {
      console.error('Error deleting credit card:', error);
      throw error;
    }
  };

  const getUpcomingExpenses = (): Expense[] => {
    const now = new Date();
    return expenses
      .filter((expense) => !expense.isPaid && new Date(expense.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  };

  const getExpensesByCategory = (month: Date): ExpensesByCategory[] => {
    const expensesByCategory: Record<string, number> = {};

    expenses
      .filter((expense) => isSameMonth(new Date(expense.date), month))
      .forEach((expense) => {
        const categoryKey = expense.category || 'Outros';
        if (!expensesByCategory[categoryKey]) {
          expensesByCategory[categoryKey] = 0;
        }
        expensesByCategory[categoryKey] += expense.amount;
      });

    return Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount,
    }));
  };

  const getTotalExpensesForMonth = (month: Date): number => {
    return expenses
      .filter((expense) => isSameMonth(new Date(expense.date), month) && !expense.isPaid)
      .reduce((total, expense) => total + expense.amount, 0);
  };

  const getTotalIncomeForMonth = (month: Date): number => {
    return incomes
      .filter((income) => isSameMonth(new Date(income.date), month))
      .reduce((total, income) => total + income.amount, 0);
  };

  const getCreditCardSummaries = (month?: Date): CreditCardSummary[] => {
    return creditCards.map((card) => {
      const allCardExpenses = expenses.filter(
        (expense) => expense.creditCardId === card.id && !expense.isPaid
      );

      const totalExpenses = allCardExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const displayExpenses = month
        ? allCardExpenses.filter((expense) => isSameMonth(new Date(expense.date), month))
        : allCardExpenses;

      return {
        ...card,
        totalExpenses,
        expenses: displayExpenses,
      };
    });
  };

  const markCreditCardAsPaid = async (creditCardId: string, month: Date, isPaid = true) => {
    if (!user) {
      throw new Error('User must be authenticated to mark credit card as paid');
    }

    try {
      await api<{ updated: number }>(`/api/credit-cards/${creditCardId}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({
          year: month.getFullYear(),
          month: month.getMonth(),
          isPaid,
        }),
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error marking credit card as paid:', error);
      throw error;
    }
  };

  const getCreditCardExpensesSummary = () => {
    const summary: Record<string, { totalAmount: number; count: number; cardName: string }> = {};

    expenses
      .filter((expense) => expense.creditCardId)
      .forEach((expense) => {
        const cardId = expense.creditCardId!;
        const card = creditCards.find((c) => c.id === cardId);

        if (!summary[cardId]) {
          summary[cardId] = {
            totalAmount: 0,
            count: 0,
            cardName: card?.name || 'Cartão Desconhecido',
          };
        }

        summary[cardId].totalAmount += expense.amount;
        summary[cardId].count += 1;
      });

    return Object.entries(summary).map(([creditCardId, data]) => ({
      creditCardId,
      ...data,
    }));
  };

  const getAvailableMonths = (): Date[] => {
    const months = new Set<string>();

    [...expenses, ...incomes].forEach((item) => {
      const date = new Date(item.date);
      months.add(`${date.getFullYear()}-${date.getMonth()}`);
    });

    return Array.from(months)
      .map((monthStr) => {
        const [year, month] = monthStr.split('-').map(Number);
        return new Date(year, month);
      })
      .sort((a, b) => a.getTime() - b.getTime());
  };

  const value = {
    incomes,
    expenses,
    creditCards,
    getBringPreviousExpenses,
    getBringPreviousIncomes,
    setBringPreviousExpenses,
    setBringPreviousIncomes,
    getPreviousUnpaidExpenses,
    getPreviousUnreceivedIncomes,
    settlePreviousExpenses,
    settlePreviousIncomes,
    addIncome,
    updateIncome,
    toggleIncomeReceived,
    addExpense,
    addCreditCard,
    updateCreditCard,
    updateExpense,
    deleteExpense,
    deleteIncome,
    deleteCreditCard,
    toggleExpensePaid,
    getUpcomingExpenses,
    getExpensesByCategory,
    getTotalExpensesForMonth,
    getTotalIncomeForMonth,
    getCreditCardSummaries,
    getAvailableMonths,
    fetchExpenses,
    fetchIncomes,
    getCreditCardExpensesSummary,
    markCreditCardAsPaid,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};
