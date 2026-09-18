import { CreditCard } from '../types';

/**
 * Calculates the due date for a credit card expense.
 *
 * Two billing cycle patterns:
 *
 * 1. closing_day <= due_day (same-month cycle, e.g. closing=10, due=17):
 *    - Before closing day  → due on due_day of CURRENT month
 *    - On/after closing day → due on due_day of NEXT month
 *
 * 2. closing_day > due_day (cross-month cycle, e.g. closing=30, due=10):
 *    The invoice closes at the end of one month and is due at the start of the next.
 *    - Before closing day  → due on due_day of NEXT month
 *    - On/after closing day → due on due_day of the month AFTER NEXT
 *
 * Examples:
 *   closing=10, due=17, today=Jul 1  → Jul 1 < 10 → due Jul 17
 *   closing=17, due=25, today=Jun 18 → Jun 18 >= 17 → due Jul 25
 *   closing=30, due=10, today=Jul 1  → Jul 1 < 30 (cross-month) → due Aug 10
 *   closing=30, due=10, today=Jul 31 → Jul 31 >= 30 (cross-month) → due Sep 10
 */
export function calculateCreditCardDueDate(
  creditCard: Pick<CreditCard, 'due_day' | 'closing_day'>,
  today: Date = new Date()
): Date {
  const dueDay = creditCard.due_day;
  const closingDay = creditCard.closing_day ?? creditCard.due_day;
  const crossMonth = closingDay > dueDay;

  // Base offset: 0 = current month, 1 = next month, etc.
  let monthOffset: number;

  if (today.getDate() < closingDay) {
    // Invoice hasn't closed yet
    monthOffset = crossMonth ? 1 : 0;
  } else {
    // Invoice already closed
    monthOffset = crossMonth ? 2 : 1;
  }

  const dueDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, dueDay);
  return dueDate;
}

/**
 * Calculates all future due dates for a recurring credit card expense.
 * Each subsequent occurrence is one month after the previous.
 */
export function calculateRecurringDueDates(
  creditCard: Pick<CreditCard, 'due_day' | 'closing_day'>,
  count: number,
  today: Date = new Date()
): Date[] {
  const firstDueDate = calculateCreditCardDueDate(creditCard, today);

  return Array.from({ length: count }, (_, i) => {
    const date = new Date(firstDueDate);
    date.setMonth(date.getMonth() + i);
    return date;
  });
}
