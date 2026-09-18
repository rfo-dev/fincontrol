import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { isSameMonth } from '../../context/FinanceContext';
import { formatCurrency, formatDate, formatInstallment } from '../../utils/formatters';
import AddExpenseForm from './AddExpenseForm';
import RecurringDeleteScopeModal, { RecurringDeleteScope } from '../shared/RecurringDeleteScopeModal';
import { Plus, CreditCard as CreditCardIcon, Trash, Calendar, RefreshCw, CreditCard as Edit, Check, Users, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Expense } from '../../types';
import ToggleSwitch from '../ui/ToggleSwitch';
import { useTranslation } from '../../i18n/LanguageProvider';

const ITEMS_PER_PAGE = 10;

type CreditCardSummaryRow = {
  id: string;
  description: string;
  category: string;
  date: Date | string;
  amount: number;
  isPaid: boolean;
  isRecurring: boolean;
  creditCardId: string;
  expenseCount: number;
  isCreditCardSummary: true;
};

type ListRow = Expense | CreditCardSummaryRow;

function isCreditCardSummary(row: ListRow): row is CreditCardSummaryRow {
  return 'isCreditCardSummary' in row && row.isCreditCardSummary === true;
}

const ExpensesList: React.FC = () => {
  const { t, months, translateCategory, dateLocale } = useTranslation();
  const { expenses, toggleExpensePaid, deleteExpense, creditCards, getAvailableMonths, getCreditCardExpensesSummary, markCreditCardAsPaid, getBringPreviousExpenses, setBringPreviousExpenses, getPreviousUnpaidExpenses, settlePreviousExpenses } = useFinance();
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPaid, setFilterPaid] = useState<boolean | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const availableMonths = getAvailableMonths();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [currentPage, setCurrentPage] = useState(1);

  const selectedDate = new Date(selectedYear, selectedMonth - 1);
  const previousExpenses = getPreviousUnpaidExpenses(selectedDate);
  const bringPreviousExpenses = getBringPreviousExpenses(selectedDate);

  const availableYears = [...new Set(availableMonths.map(date => date.getFullYear()))].sort((a, b) => b - a);

  const availableMonthsForYear = availableMonths
    .filter(date => date.getFullYear() === selectedYear)
    .map(date => date.getMonth() + 1)
    .filter((month, index, arr) => arr.indexOf(month) === index)
    .sort((a, b) => a - b);

  const creditCardSummaries = getCreditCardExpensesSummary();

  const getCardExpensesInMonth = (creditCardId: string) => {
    return expenses
      .filter(expense =>
        expense.creditCardId === creditCardId &&
        isSameMonth(new Date(expense.date), selectedDate)
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const regularExpenses = expenses.filter(expense => {
    if (expense.creditCardId) return false;

    const expenseDate = new Date(expense.date);
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        expense.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPaidFilter = filterPaid === null || expense.isPaid === filterPaid;

    const matchesMonth = expenseDate.getMonth() === selectedDate.getMonth() &&
                        expenseDate.getFullYear() === selectedDate.getFullYear();

    return matchesSearch && matchesPaidFilter && matchesMonth;
  });

  const filteredCreditCardSummaries: CreditCardSummaryRow[] = creditCardSummaries.filter(summary => {
    const card = creditCards.find(c => c.id === summary.creditCardId);
    if (!card) return false;

    const cardExpensesInMonth = getCardExpensesInMonth(summary.creditCardId);
    if (cardExpensesInMonth.length === 0) return false;

    const totalAmount = cardExpensesInMonth.reduce((sum, expense) => sum + expense.amount, 0);
    const allPaid = cardExpensesInMonth.every(expense => expense.isPaid);
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesPaidFilter = true;
    if (filterPaid === true) {
      matchesPaidFilter = allPaid;
    } else if (filterPaid === false) {
      matchesPaidFilter = !allPaid;
    }

    return matchesSearch && matchesPaidFilter && totalAmount > 0;
  }).map(summary => {
    const card = creditCards.find(c => c.id === summary.creditCardId);
    const cardExpensesInMonth = getCardExpensesInMonth(summary.creditCardId);

    const totalAmount = cardExpensesInMonth.reduce((sum, expense) => sum + expense.amount, 0);
    const allPaid = cardExpensesInMonth.every(expense => expense.isPaid);
    const oldestDate = cardExpensesInMonth.reduce((oldest, expense) => {
      const expenseDate = new Date(expense.date);
      const oldestAsDate = new Date(oldest);
      return expenseDate < oldestAsDate ? expense.date : oldest;
    }, cardExpensesInMonth[0]?.date || new Date());

    return {
      id: `card-${summary.creditCardId}`,
      description: t('expenses.invoiceName', { name: card?.name || t('common.cardFallback') }),
      category: 'Cartão de Crédito',
      date: oldestDate,
      amount: totalAmount,
      isPaid: allPaid,
      isRecurring: false,
      creditCardId: summary.creditCardId,
      expenseCount: cardExpensesInMonth.length,
      isCreditCardSummary: true as const,
    };
  });

  const allFilteredExpenses: ListRow[] = [
    ...regularExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    ...filteredCreditCardSummaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  ];

  const totalPages = Math.ceil(allFilteredExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = allFilteredExpenses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getCreditCardName = (creditCardId?: string) => {
    if (!creditCardId) return null;
    const card = creditCards.find(card => card.id === creditCardId);
    return card ? card.name : null;
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setIsAddingExpense(true);
  };

  const handleFormComplete = () => {
    setIsAddingExpense(false);
    setEditingExpense(null);
  };

  const handleDeleteClick = (expense: Expense) => {
    if (expense.isRecurring) {
      setExpenseToDelete(expense);
      return;
    }
    void deleteExpense(expense.id);
  };

  const handleConfirmDelete = async (scope: RecurringDeleteScope) => {
    if (!expenseToDelete) return;

    try {
      setIsDeleting(true);
      await deleteExpense(expenseToDelete.id, { deleteScope: scope });
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkCreditCardAsPaid = async (creditCardId: string, isPaid: boolean) => {
    try {
      await markCreditCardAsPaid(creditCardId, selectedDate, isPaid);
    } catch (error) {
      console.error('Error marking credit card as paid:', error);
    }
  };

  const toggleCardExpanded = (creditCardId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(creditCardId)) {
        next.delete(creditCardId);
      } else {
        next.add(creditCardId);
      }
      return next;
    });
  };

  const installmentTpl = t('formatters.installment');

  const renderExpenseActions = (expense: Expense, options?: { hidePaidToggle?: boolean }) => (
    <div className="flex justify-center gap-2">
      {!expense.isPaid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleEditClick(expense);
          }}
          className="fc-icon-btn bg-mint-soft text-mint hover:bg-mint hover:text-white"
          title={t('expenses.editTitle')}
        >
          <Edit size={16} />
        </button>
      )}

      {!options?.hidePaidToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleExpensePaid(expense.id);
          }}
          className={`fc-icon-btn ${
            expense.isPaid
              ? 'bg-mist text-ink/40 hover:bg-mist-line'
              : 'bg-income-soft text-income hover:bg-income hover:text-white'
          }`}
          title={expense.isPaid ? t('expenses.markUnpaid') : t('expenses.markPaid')}
        >
          <Check size={16} />
        </button>
      )}

      {!expense.isPaid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteClick(expense);
          }}
          className="fc-icon-btn bg-expense-soft text-expense hover:bg-expense hover:text-white"
          title={t('expenses.deleteTitle')}
        >
          <Trash size={16} />
        </button>
      )}
    </div>
  );

  const showPreviousRow = bringPreviousExpenses && previousExpenses.total > 0;
  const hasContent = paginatedExpenses.length > 0 || showPreviousRow;

  const renderPreviousRow = () => (
    <tr className="!bg-warn-soft/60 hover:!bg-warn-soft">
      <td>
        <div className="font-medium text-ink">
          {t('expenses.previousUnpaid')}
          <span className="fc-badge-warn ml-2">
            {t('expenses.entriesCount', { count: previousExpenses.count })}
          </span>
        </div>
      </td>
      <td>
        <div className="text-ink/70">{t('expenses.previousMonths')}</div>
      </td>
      <td>
        <div className="text-ink/50">{t('common.emDash')}</div>
      </td>
      <td>
        <div className="font-semibold text-expense">
          {formatCurrency(previousExpenses.total, dateLocale)}
        </div>
      </td>
      <td>
        <span className="fc-badge-danger">{t('expenses.unpaid')}</span>
      </td>
      <td className="text-center">
        <div className="flex justify-center">
          <button
            onClick={() => settlePreviousExpenses(selectedDate)}
            className="fc-icon-btn bg-income-soft text-income hover:bg-income hover:text-white"
            title={t('expenses.settlePrevious')}
          >
            <Check size={16} />
          </button>
        </div>
      </td>
    </tr>
  );

  const renderPreviousCard = () => (
    <div className="fc-card border-l-4 border-l-warn p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{t('expenses.previousUnpaid')}</p>
          <p className="mt-1 text-sm text-ink/55">
            {t('expenses.previousMonthsWithCount', { count: previousExpenses.count })}
          </p>
          <p className="mt-2 font-semibold text-expense">
            {formatCurrency(previousExpenses.total, dateLocale)}
          </p>
          <span className="fc-badge-danger mt-2">{t('expenses.unpaid')}</span>
        </div>
        <button
          onClick={() => settlePreviousExpenses(selectedDate)}
          className="fc-icon-btn shrink-0 bg-income-soft text-income hover:bg-income hover:text-white"
          title={t('expenses.settlePrevious')}
        >
          <Check size={16} />
        </button>
      </div>
    </div>
  );

  const renderPagination = () => (
    <div className="flex items-center justify-between border-t border-mist-line px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
          disabled={currentPage === 1}
          className="fc-btn-secondary text-sm"
        >
          {t('common.previous')}
        </button>
        <button
          onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
          disabled={currentPage === totalPages || totalPages === 0}
          className="fc-btn-secondary text-sm"
        >
          {t('common.next')}
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-ink/60">
          {t('common.showingResults', {
            from: allFilteredExpenses.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1,
            to: Math.min(currentPage * ITEMS_PER_PAGE, allFilteredExpenses.length),
            total: allFilteredExpenses.length,
          })}
        </p>
        <nav className="relative z-0 inline-flex -space-x-px rounded-xl" aria-label={t('common.pagination')}>
          <button
            onClick={() => setCurrentPage(page => Math.max(page - 1, 1))}
            disabled={currentPage === 1}
            className="fc-btn-secondary rounded-r-none text-sm"
          >
            {t('common.previous')}
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`relative inline-flex items-center border px-4 py-2.5 text-sm font-medium transition ${
                page === currentPage
                  ? 'z-10 border-ink bg-ink text-white'
                  : 'border-mist-line bg-white text-ink/60 hover:bg-mist'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(page => Math.min(page + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="fc-btn-secondary rounded-l-none text-sm"
          >
            {t('common.next')}
          </button>
        </nav>
      </div>
    </div>
  );

  const paidLabel = (isPaid: boolean) => (isPaid ? t('expenses.paid') : t('expenses.unpaid'));

  return (
    <div className="fc-page">
      {expenseToDelete && (
        <RecurringDeleteScopeModal
          type="expense"
          description={expenseToDelete.description}
          isSubmitting={isDeleting}
          onSelect={handleConfirmDelete}
          onCancel={() => !isDeleting && setExpenseToDelete(null)}
        />
      )}

      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('expenses.title')}</h2>
          <p className="fc-subtitle">
            {t('expenses.subtitle', { month: months[selectedMonth - 1], year: selectedYear })}
          </p>
        </div>

        <div className="fc-toolbar">
          <input
            type="text"
            placeholder={t('expenses.searchPlaceholder')}
            className="fc-input w-full sm:w-56"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Calendar size={18} className="shrink-0 text-mint" />
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
                setCurrentPage(1);
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
              onChange={(e) => {
                setSelectedMonth(parseInt(e.target.value));
                setCurrentPage(1);
              }}
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

          <div className="flex flex-wrap gap-2">
            <button
              className={`fc-chip ${filterPaid === null ? 'fc-chip-active' : 'fc-chip-idle'}`}
              onClick={() => setFilterPaid(null)}
            >
              {t('common.all')}
            </button>
            <button
              className={`fc-chip ${filterPaid === true ? 'fc-chip-active' : 'fc-chip-idle'}`}
              onClick={() => setFilterPaid(true)}
            >
              {t('expenses.filterPaid')}
            </button>
            <button
              className={`fc-chip ${filterPaid === false ? 'fc-chip-active' : 'fc-chip-idle'}`}
              onClick={() => setFilterPaid(false)}
            >
              {t('expenses.filterUnpaid')}
            </button>
          </div>

          <ToggleSwitch
            checked={bringPreviousExpenses}
            onChange={(checked) => setBringPreviousExpenses(selectedDate, checked)}
            label={t('expenses.bringPrevious')}
          />

          <button
            className="fc-btn-primary"
            onClick={() => {
              setEditingExpense(null);
              setIsAddingExpense(true);
            }}
          >
            <Plus size={18} />
            <span>{t('expenses.add')}</span>
          </button>
        </div>
      </div>

      {isAddingExpense && (
        <div className="fc-form-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">
              {editingExpense ? t('expenses.edit') : t('expenses.new')}
            </h3>
            <button
              onClick={handleFormComplete}
              className="fc-icon-btn text-ink/45 hover:bg-mist hover:text-ink"
              aria-label={t('common.close')}
            >
              <X size={18} />
            </button>
          </div>
          <AddExpenseForm
            onComplete={handleFormComplete}
            expense={editingExpense}
          />
        </div>
      )}

      {hasContent ? (
        <div className="fc-card overflow-hidden">
          <div className="fc-desktop-table">
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th scope="col">{t('common.description')}</th>
                    <th scope="col">{t('common.category')}</th>
                    <th scope="col">{t('common.date')}</th>
                    <th scope="col">{t('common.amount')}</th>
                    <th scope="col">{t('common.status')}</th>
                    <th scope="col" className="text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {showPreviousRow && renderPreviousRow()}
                  {paginatedExpenses.map((expense) => {
                    if (isCreditCardSummary(expense)) {
                      const isExpanded = expandedCards.has(expense.creditCardId);
                      const childExpenses = isExpanded
                        ? getCardExpensesInMonth(expense.creditCardId)
                        : [];

                      return (
                        <React.Fragment key={expense.id}>
                          <tr
                            className="!bg-mint-soft/40 cursor-pointer hover:!bg-mint-soft/70"
                            onClick={() => toggleCardExpanded(expense.creditCardId)}
                            title={isExpanded ? t('expenses.collapse') : t('expenses.expand')}
                          >
                            <td>
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown size={16} className="shrink-0 text-mint" />
                                ) : (
                                  <ChevronRight size={16} className="shrink-0 text-mint" />
                                )}
                                <div className="font-medium text-ink">
                                  {expense.description}
                                  <span className="ml-2 inline-flex items-center text-xs text-mint">
                                    <Users size={12} className="mr-1" />
                                    {t('expenses.expensesCount', { count: expense.expenseCount })}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-ink/80">{translateCategory(expense.category)}</div>
                            </td>
                            <td>
                              <div className="flex items-center text-ink/80">
                                <Calendar size={14} className="mr-1 text-ink/35" />
                                {formatDate(expense.date, dateLocale)}
                              </div>
                            </td>
                            <td>
                              <div className="font-semibold text-expense">
                                {formatCurrency(expense.amount, dateLocale)}
                              </div>
                            </td>
                            <td>
                              <span className={expense.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                                {paidLabel(expense.isPaid)}
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="flex justify-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkCreditCardAsPaid(expense.creditCardId, !expense.isPaid);
                                  }}
                                  className={`fc-icon-btn ${
                                    expense.isPaid
                                      ? 'bg-mist text-ink/40 hover:bg-mist-line'
                                      : 'bg-income-soft text-income hover:bg-income hover:text-white'
                                  }`}
                                  title={expense.isPaid ? t('expenses.markInvoiceUnpaid') : t('expenses.markInvoicePaid')}
                                >
                                  <Check size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {childExpenses.map((child) => (
                            <tr key={child.id} className="!bg-mist/40">
                              <td className="!pl-12">
                                <div className="flex items-center gap-2 text-ink/80">
                                  <span className="text-ink/25">└</span>
                                  {child.description}
                                  {child.isRecurring && (
                                    <span className="fc-badge-info">
                                      <RefreshCw size={12} />
                                      {formatInstallment(child.recurringIndex, child.recurringCount, installmentTpl) || t('common.recurring')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="text-ink/70">
                                  {translateCategory(child.category)}
                                  <div className="mt-1 flex items-center text-xs text-ink/45">
                                    <CreditCardIcon size={12} className="mr-1" />
                                    {getCreditCardName(child.creditCardId)}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center text-ink/70">
                                  <Calendar size={14} className="mr-1 text-ink/35" />
                                  {formatDate(child.date, dateLocale)}
                                </div>
                              </td>
                              <td>
                                <div className="font-semibold text-expense">
                                  {formatCurrency(child.amount, dateLocale)}
                                </div>
                              </td>
                              <td>
                                <span className={child.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                                  {paidLabel(child.isPaid)}
                                </span>
                              </td>
                              <td className="text-center">
                                {renderExpenseActions(child, { hidePaidToggle: true })}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    }

                    return (
                      <tr key={expense.id}>
                        <td>
                          <div className="flex items-center gap-2 font-medium text-ink">
                            {expense.description}
                            {expense.isRecurring && (
                              <span className="fc-badge-info">
                                <RefreshCw size={12} />
                                {formatInstallment(expense.recurringIndex, expense.recurringCount, installmentTpl) || t('common.recurring')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="text-ink/80">{translateCategory(expense.category)}</div>
                        </td>
                        <td>
                          <div className="flex items-center text-ink/80">
                            <Calendar size={14} className="mr-1 text-ink/35" />
                            {formatDate(expense.date, dateLocale)}
                          </div>
                        </td>
                        <td>
                          <div className="font-semibold text-expense">
                            {formatCurrency(expense.amount, dateLocale)}
                          </div>
                        </td>
                        <td>
                          <span className={expense.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                            {paidLabel(expense.isPaid)}
                          </span>
                        </td>
                        <td className="text-center">
                          {renderExpenseActions(expense)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="fc-mobile-list p-4">
            {showPreviousRow && renderPreviousCard()}

            {paginatedExpenses.map((expense) => {
              if (isCreditCardSummary(expense)) {
                const isExpanded = expandedCards.has(expense.creditCardId);
                const childExpenses = isExpanded
                  ? getCardExpensesInMonth(expense.creditCardId)
                  : [];

                return (
                  <div key={expense.id} className="space-y-2">
                    <div
                      className="fc-card cursor-pointer border-l-4 border-l-mint p-4"
                      onClick={() => toggleCardExpanded(expense.creditCardId)}
                      title={isExpanded ? t('expenses.collapse') : t('expenses.expand')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown size={16} className="shrink-0 text-mint" />
                            ) : (
                              <ChevronRight size={16} className="shrink-0 text-mint" />
                            )}
                            <p className="truncate font-medium text-ink">{expense.description}</p>
                          </div>
                          <p className="mt-1 text-sm text-ink/55">
                            {translateCategory(expense.category)} · {formatDate(expense.date, dateLocale)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-expense">
                              {formatCurrency(expense.amount, dateLocale)}
                            </span>
                            <span className={expense.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                              {paidLabel(expense.isPaid)}
                            </span>
                            <span className="fc-badge-info">
                              <Users size={12} />
                              {t('expenses.expensesCount', { count: expense.expenseCount })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkCreditCardAsPaid(expense.creditCardId, !expense.isPaid);
                          }}
                          className={`fc-icon-btn shrink-0 ${
                            expense.isPaid
                              ? 'bg-mist text-ink/40 hover:bg-mist-line'
                              : 'bg-income-soft text-income hover:bg-income hover:text-white'
                          }`}
                          title={expense.isPaid ? t('expenses.markInvoiceUnpaid') : t('expenses.markInvoicePaid')}
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>

                    {childExpenses.map((child) => (
                      <div key={child.id} className="fc-card ml-3 border-l-4 border-l-mist-line p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">{child.description}</p>
                            <p className="mt-1 text-sm text-ink/55">
                              {translateCategory(child.category)}
                              {getCreditCardName(child.creditCardId) && (
                                <> · {getCreditCardName(child.creditCardId)}</>
                              )}
                            </p>
                            <p className="mt-1 flex items-center text-xs text-ink/45">
                              <Calendar size={12} className="mr-1" />
                              {formatDate(child.date, dateLocale)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-expense">
                                {formatCurrency(child.amount, dateLocale)}
                              </span>
                              <span className={child.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                                {paidLabel(child.isPaid)}
                              </span>
                              {child.isRecurring && (
                                <span className="fc-badge-info">
                                  <RefreshCw size={12} />
                                  {formatInstallment(child.recurringIndex, child.recurringCount, installmentTpl) || t('common.recurring')}
                                </span>
                              )}
                            </div>
                          </div>
                          {renderExpenseActions(child, { hidePaidToggle: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              return (
                <div key={expense.id} className="fc-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{expense.description}</p>
                      <p className="mt-1 text-sm text-ink/55">
                        {translateCategory(expense.category)} · {formatDate(expense.date, dateLocale)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-expense">
                          {formatCurrency(expense.amount, dateLocale)}
                        </span>
                        <span className={expense.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                          {paidLabel(expense.isPaid)}
                        </span>
                        {expense.isRecurring && (
                          <span className="fc-badge-info">
                            <RefreshCw size={12} />
                            {formatInstallment(expense.recurringIndex, expense.recurringCount, installmentTpl) || t('common.recurring')}
                          </span>
                        )}
                      </div>
                    </div>
                    {renderExpenseActions(expense)}
                  </div>
                </div>
              );
            })}
          </div>

          {renderPagination()}
        </div>
      ) : (
        <div className="fc-empty">
          <p className="mb-4 text-ink/55">{t('expenses.empty')}</p>
          <button
            className="fc-btn-primary"
            onClick={() => setIsAddingExpense(true)}
          >
            <Plus size={18} />
            <span>{t('expenses.add')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExpensesList;
