import { Decimal } from '@prisma/client/runtime/library';
import { formatDateOnly } from './dates.js';

export function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}

export function mapIncome(row: {
  id: string;
  description: string;
  amount: Decimal;
  date: Date;
  isReceived: boolean;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringCount: number | null;
  recurringIndex: number | null;
  category?: { name: string } | null;
}) {
  return {
    id: row.id,
    description: row.description,
    amount: toNumber(row.amount),
    date: formatDateOnly(row.date),
    isReceived: row.isReceived,
    isRecurring: row.isRecurring,
    recurringInterval: row.recurringInterval ?? undefined,
    recurringCount: row.recurringCount ?? undefined,
    recurringIndex: row.recurringIndex ?? undefined,
    category: row.category?.name || 'Outros',
  };
}

export function mapExpense(row: {
  id: string;
  description: string;
  amount: Decimal;
  date: Date;
  isPaid: boolean;
  isRecurring: boolean;
  recurringInterval: string | null;
  recurringCount: number | null;
  recurringIndex: number | null;
  creditCardId: string | null;
  category?: { name: string } | null;
}) {
  return {
    id: row.id,
    description: row.description,
    amount: toNumber(row.amount),
    date: formatDateOnly(row.date),
    isPaid: row.isPaid,
    isRecurring: row.isRecurring,
    recurringInterval: row.recurringInterval ?? undefined,
    recurringCount: row.recurringCount ?? undefined,
    recurringIndex: row.recurringIndex ?? undefined,
    creditCardId: row.creditCardId ?? undefined,
    category: row.category?.name || 'Outros',
  };
}

export function mapCreditCard(row: {
  id: string;
  name: string;
  lastFour: string | null;
  dueDay: number;
  closingDay: number | null;
  creditLimit: Decimal | null;
  color: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    last_four: row.lastFour ?? null,
    due_day: row.dueDay,
    closing_day: row.closingDay,
    credit_limit: toNumber(row.creditLimit),
    color: row.color || '#3B82F6',
  };
}
