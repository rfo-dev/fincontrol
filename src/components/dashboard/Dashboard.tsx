import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { BarChart3, Calendar, CreditCard, ArrowUpCircle, ArrowDownCircle, Check, X, History } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import CategoryChart from './CategoryChart';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useTranslation } from '../../i18n/LanguageProvider';

const Dashboard: React.FC = () => {
  const { t, months, translateCategory, dateLocale } = useTranslation();
  const {
    incomes,
    getExpensesByCategory,
    getUpcomingExpenses,
    expenses,
    getCreditCardSummaries,
    getAvailableMonths,
    getBringPreviousExpenses,
    getBringPreviousIncomes,
    setBringPreviousExpenses,
    setBringPreviousIncomes,
    getPreviousUnpaidExpenses,
    getPreviousUnreceivedIncomes,
    settlePreviousExpenses,
    settlePreviousIncomes,
  } = useFinance();

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const availableMonths = getAvailableMonths();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const selectedDate = new Date(selectedYear, selectedMonth - 1);
  const bringPreviousExpenses = getBringPreviousExpenses(selectedDate);
  const bringPreviousIncomes = getBringPreviousIncomes(selectedDate);

  const availableYears = [...new Set(availableMonths.map(date => date.getFullYear()))].sort((a, b) => b - a);

  const availableMonthsForYear = availableMonths
    .filter(date => date.getFullYear() === selectedYear)
    .map(date => date.getMonth() + 1)
    .filter((month, index, arr) => arr.indexOf(month) === index)
    .sort((a, b) => a - b);

  const upcomingExpenses = getUpcomingExpenses();
  const expensesByCategory = getExpensesByCategory(selectedDate);
  const creditCardSummaries = getCreditCardSummaries(selectedDate);

  const previousExpenses = getPreviousUnpaidExpenses(selectedDate);
  const previousIncomes = getPreviousUnreceivedIncomes(selectedDate);

  const pendingIncome = incomes
    .filter(income => {
      const incomeDate = new Date(income.date);
      return incomeDate.getMonth() === selectedDate.getMonth() &&
             incomeDate.getFullYear() === selectedDate.getFullYear() &&
             !income.isReceived;
    })
    .reduce((sum, income) => sum + income.amount, 0);

  const unpaidExpensesAmount = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === selectedDate.getMonth() &&
             expenseDate.getFullYear() === selectedDate.getFullYear() &&
             !expense.isPaid;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const previousExpensesTotal = bringPreviousExpenses ? previousExpenses.total : 0;
  const previousIncomesTotal = bringPreviousIncomes ? previousIncomes.total : 0;

  const totalPendingIncome = pendingIncome + previousIncomesTotal;
  const totalUnpaidExpenses = unpaidExpensesAmount + previousExpensesTotal;
  const balance = totalPendingIncome - totalUnpaidExpenses;

  const paidExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === selectedDate.getMonth() &&
             expenseDate.getFullYear() === selectedDate.getFullYear() &&
             expense.isPaid;
    }).length;

  const unpaidExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === selectedDate.getMonth() &&
             expenseDate.getFullYear() === selectedDate.getFullYear() &&
             !expense.isPaid;
    }).length;

  const formatMonthYear = (year: number, month: number) => {
    return t('dashboard.monthYear', { month: months[month - 1], year });
  };

  const paidRatio = paidExpenses
    ? (paidExpenses / (paidExpenses + unpaidExpenses) * 100)
    : 0;

  const monthYearLabel = formatMonthYear(selectedYear, selectedMonth);

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('dashboard.title')}</h2>
          <p className="fc-subtitle">
            {t('dashboard.subtitle', { monthYear: monthYearLabel })}
          </p>
        </div>

        <div className="fc-toolbar">
          <ToggleSwitch
            checked={bringPreviousExpenses}
            onChange={(checked) => setBringPreviousExpenses(selectedDate, checked)}
            label={t('dashboard.bringPreviousExpenses')}
          />

          <ToggleSwitch
            checked={bringPreviousIncomes}
            onChange={(checked) => setBringPreviousIncomes(selectedDate, checked)}
            label={t('dashboard.bringPreviousIncomes')}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Calendar size={18} className="text-mint shrink-0" />
            <select
              className="fc-input w-auto min-w-[5.5rem]"
              value={selectedYear}
              onChange={(e) => {
                const newYear = parseInt(e.target.value);
                setSelectedYear(newYear);

                const monthsInYear = availableMonths
                  .filter(date => date.getFullYear() === newYear)
                  .map(date => date.getMonth() + 1);

                if (!monthsInYear.includes(selectedMonth)) {
                  setSelectedMonth(monthsInYear[0] || currentMonth);
                }
              }}
            >
              {availableYears.length > 0 ? availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              )) : (
                <option value={currentYear}>{currentYear}</option>
              )}
            </select>

            <select
              className="fc-input w-auto min-w-[8.5rem]"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {availableMonthsForYear.length > 0 ? availableMonthsForYear.map((month) => (
                <option key={month} value={month}>
                  {months[month - 1]}
                </option>
              )) : (
                <option value={currentMonth}>{months[currentMonth - 1]}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="fc-stat border-l-4 border-l-income">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-sans text-sm font-medium text-ink/60">{t('dashboard.pendingIncome')}</h3>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-income-soft text-income">
              <ArrowUpCircle size={18} />
            </span>
          </div>
          <p className="font-display text-2xl font-bold text-ink">{formatCurrency(totalPendingIncome, dateLocale)}</p>
          <p className="mt-2 text-sm text-ink/45">{monthYearLabel}</p>
        </div>

        <div className="fc-stat border-l-4 border-l-expense">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-sans text-sm font-medium text-ink/60">{t('dashboard.unpaidExpenses')}</h3>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-expense-soft text-expense">
              <ArrowDownCircle size={18} />
            </span>
          </div>
          <p className="font-display text-2xl font-bold text-ink">{formatCurrency(totalUnpaidExpenses, dateLocale)}</p>
          <p className="mt-2 text-sm text-ink/45">{monthYearLabel}</p>
        </div>

        <div className="fc-stat border-l-4 border-l-mint">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-sans text-sm font-medium text-ink/60">{t('dashboard.balance')}</h3>
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                balance >= 0 ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense'
              }`}
            >
              {balance >= 0 ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
            </span>
          </div>
          <p className="font-display text-2xl font-bold text-ink">{formatCurrency(balance, dateLocale)}</p>
          <p className="mt-2 text-sm text-ink/45">{t('dashboard.balanceHint')}</p>
        </div>

        <div className="fc-stat border-l-4 border-l-warn">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-sans text-sm font-medium text-ink/60">{t('dashboard.expenseStatus')}</h3>
            <div className="flex items-center gap-1">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-income-soft text-income">
                <Check size={16} />
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-expense-soft text-expense">
                <X size={16} />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 flex-1 rounded-full bg-mist">
              <div
                className="h-2.5 rounded-full bg-income"
                style={{ width: `${paidRatio}%` }}
              />
            </div>
            <span className="text-sm font-medium text-ink/50">
              {paidExpenses}/{paidExpenses + unpaidExpenses}
            </span>
          </div>
          <div className="mt-2 flex justify-between text-sm text-ink/45">
            <span>{t('dashboard.paidCount', { count: paidExpenses })}</span>
            <span>{t('dashboard.pendingCount', { count: unpaidExpenses })}</span>
          </div>
        </div>
      </div>

      {(bringPreviousExpenses || bringPreviousIncomes) && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {bringPreviousExpenses && (
            <div className="fc-card border-l-4 border-l-warn p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-sans text-sm font-medium text-ink/60">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-warn-soft text-warn">
                      <History size={16} />
                    </span>
                    {t('dashboard.previousUnpaidExpenses')}
                  </h3>
                  <p className="mt-3 font-display text-2xl font-bold text-ink">
                    {formatCurrency(previousExpenses.total, dateLocale)}
                  </p>
                  <p className="mt-2 text-sm text-ink/45">
                    {t('dashboard.previousEntries', { count: previousExpenses.count })}
                  </p>
                </div>
                {previousExpenses.total > 0 && (
                  <button
                    onClick={() => settlePreviousExpenses(selectedDate)}
                    className="fc-icon-btn bg-income-soft text-income hover:bg-income hover:text-white"
                    title={t('dashboard.settlePreviousExpenses')}
                  >
                    <Check size={18} />
                  </button>
                )}
              </div>
            </div>
          )}

          {bringPreviousIncomes && (
            <div className="fc-card border-l-4 border-l-mint p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-sans text-sm font-medium text-ink/60">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-mint-soft text-mint">
                      <History size={16} />
                    </span>
                    {t('dashboard.previousUnreceivedIncomes')}
                  </h3>
                  <p className="mt-3 font-display text-2xl font-bold text-ink">
                    {formatCurrency(previousIncomes.total, dateLocale)}
                  </p>
                  <p className="mt-2 text-sm text-ink/45">
                    {t('dashboard.previousEntries', { count: previousIncomes.count })}
                  </p>
                </div>
                {previousIncomes.total > 0 && (
                  <button
                    onClick={() => settlePreviousIncomes(selectedDate)}
                    className="fc-icon-btn bg-income-soft text-income hover:bg-income hover:text-white"
                    title={t('dashboard.settlePreviousIncomes')}
                  >
                    <Check size={18} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="fc-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-ink">{t('dashboard.expensesByCategory')}</h3>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-mint-soft text-mint">
              <BarChart3 size={18} />
            </span>
          </div>

          {expensesByCategory.length > 0 ? (
            <div className="h-[300px]">
              <CategoryChart data={expensesByCategory} />
            </div>
          ) : (
            <div className="fc-empty h-[300px] py-0">
              <p className="text-sm text-ink/50">
                {t('dashboard.noExpensesInMonth', { monthYear: monthYearLabel })}
              </p>
            </div>
          )}
        </div>

        <div className="fc-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-ink">{t('dashboard.upcomingExpenses')}</h3>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-warn-soft text-warn">
              <Calendar size={18} />
            </span>
          </div>

          {upcomingExpenses.length > 0 ? (
            <ul className="divide-y divide-mist-line">
              {upcomingExpenses.map(expense => (
                <li key={expense.id} className="py-3">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium text-ink">{expense.description}</p>
                    <p className="shrink-0 font-semibold text-expense">{formatCurrency(expense.amount, dateLocale)}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap justify-between gap-1">
                    <p className="text-sm text-ink/45">
                      {expense.creditCardId ? (
                        <span className="inline-flex items-center">
                          <CreditCard size={14} className="mr-1 text-mint" />
                          {translateCategory(expense.category)}
                        </span>
                      ) : (
                        translateCategory(expense.category)
                      )}
                    </p>
                    <p className="text-sm text-ink/45">
                      {t('dashboard.dueDate', { date: formatDate(expense.date, dateLocale) })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="fc-empty h-[200px] py-0">
              <p className="text-sm text-ink/50">{t('dashboard.noUpcomingExpenses')}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-4 font-display text-lg font-semibold text-ink">
          {t('dashboard.creditCardsSummary')}
        </h3>

        {creditCardSummaries.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {creditCardSummaries.map(card => {
              const monthlyExpenses = card.expenses.reduce((sum, expense) => sum + expense.amount, 0);
              const availableCredit = card.credit_limit - card.totalExpenses;
              const usedPercentage = (card.totalExpenses / card.credit_limit) * 100;

              return (
                <div
                  key={card.id}
                  className="fc-card overflow-hidden p-5 text-white transition duration-300 hover:-translate-y-0.5 hover:shadow-lift"
                  style={{ backgroundColor: card.color || '#0b1f1c' }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="font-display font-semibold">{card.name}</h4>
                    <CreditCard size={20} className="opacity-80" />
                  </div>

                  <div className="space-y-3 font-sans">
                    <div>
                      <p className="text-sm text-white/70">{t('dashboard.totalLimit')}</p>
                      <p className="text-lg font-bold">{formatCurrency(card.credit_limit, dateLocale)}</p>
                    </div>

                    <div>
                      <p className="text-sm text-white/70">{t('dashboard.currentInvoice')}</p>
                      <p className="text-lg font-bold">{formatCurrency(monthlyExpenses, dateLocale)}</p>
                    </div>

                    <div>
                      <p className="text-sm text-white/70">{t('dashboard.availableLimit')}</p>
                      <p className="text-lg font-bold">{formatCurrency(availableCredit, dateLocale)}</p>
                    </div>

                    <div className="pt-2">
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{t('dashboard.usedLimit')}</span>
                        <span>{Math.round(usedPercentage)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/20">
                        <div
                          className="h-2 rounded-full bg-white"
                          style={{ width: `${usedPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between pt-2 text-sm text-white/70">
                      <span>{t('dashboard.dueDay', { day: card.due_day })}</span>
                      <span>{t('dashboard.expensesCount', { count: card.expenses.length })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="fc-empty py-10">
            <p className="text-sm text-ink/50">{t('dashboard.noCreditCards')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
