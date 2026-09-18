import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, formatDate, formatInstallment, parseDateInput, toDateInputValue } from '../../utils/formatters';
import { Trash, Pencil, Calendar, Plus, X, Filter, RefreshCw } from 'lucide-react';
import { CreditCard, Expense } from '../../types';
import { calculateCreditCardDueDate } from '../../utils/creditCardDueDate';
import RecurringEditScopeModal, { RecurringEditScope } from '../shared/RecurringEditScopeModal';
import RecurringDeleteScopeModal, { RecurringDeleteScope } from '../shared/RecurringDeleteScopeModal';
import { useTranslation } from '../../i18n/LanguageProvider';

interface CreditCardExpensesListProps {
  creditCard: CreditCard;
  onClose: () => void;
}

const EXPENSE_CATEGORIES = [
  "Alimentação", "Moradia", "Transporte", "Entretenimento",
  "Utilidades", "Saúde", "Educação", "Compras",
  "Viagem", "Assinaturas", "Seguros", "Outros"
];

const CreditCardExpensesList: React.FC<CreditCardExpensesListProps> = ({ creditCard, onClose }) => {
  const { t, months, translateCategory, dateLocale } = useTranslation();
  const { expenses, deleteExpense, updateExpense, addExpense, fetchExpenses } = useFinance();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: EXPENSE_CATEGORIES[0],
    date: toDateInputValue()
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showRecurringScopeModal, setShowRecurringScopeModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const allCardExpenses = expenses.filter(expense => expense.creditCardId === creditCard.id);

  const cardExpenses = allCardExpenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getFullYear() === selectedYear &&
           (expenseDate.getMonth() + 1) === selectedMonth;
  });

  const availableYears = [...new Set(allCardExpenses.map(expense =>
    new Date(expense.date).getFullYear()
  ))].sort((a, b) => b - a);

  const availableMonths = [...new Set(allCardExpenses
    .filter(expense => new Date(expense.date).getFullYear() === selectedYear)
    .map(expense => new Date(expense.date).getMonth() + 1)
  )].sort((a, b) => a - b);

  const installmentTpl = t('formatters.installment');

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: toDateInputValue(expense.date)
    });
    setIsAddingNew(false);
    setError('');
  };

  const handleAddNew = () => {
    setEditingExpense(null);
    setIsAddingNew(true);

    const dueDate = calculateCreditCardDueDate(creditCard);

    setFormData({
      description: '',
      amount: '',
      category: EXPENSE_CATEGORIES[0],
      date: toDateInputValue(dueDate)
    });
    setError('');
  };

  const handleCancel = () => {
    setEditingExpense(null);
    setIsAddingNew(false);
    setFormData({
      description: '',
      amount: '',
      category: EXPENSE_CATEGORIES[0],
      date: toDateInputValue()
    });
    setError('');
  };

  const saveExpense = async (editScope: RecurringEditScope = 'single') => {
    const amount = parseFloat(formData.amount);

    if (editingExpense) {
      await updateExpense(editingExpense.id, {
        description: formData.description,
        amount,
        date: parseDateInput(formData.date),
        categoryName: formData.category,
        editScope,
      });
      return;
    }

    await addExpense({
      description: formData.description,
      amount,
      date: parseDateInput(formData.date),
      categoryName: formData.category,
      isPaid: false,
      isRecurring: false,
      creditCardId: creditCard.id
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.description || !formData.amount) {
      setError(t('common.requiredFields'));
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError(t('common.positiveAmount'));
      return;
    }

    if (editingExpense?.isRecurring) {
      setShowRecurringScopeModal(true);
      return;
    }

    try {
      setIsSubmitting(true);
      await saveExpense('single');
      await fetchExpenses();
      handleCancel();
    } catch (error: unknown) {
      console.error('Erro ao salvar despesa:', error);
      const message = error instanceof Error ? error.message : t('expenses.saveError');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecurringScopeSelect = async (scope: RecurringEditScope) => {
    try {
      setIsSubmitting(true);
      setShowRecurringScopeModal(false);
      await saveExpense(scope);
      await fetchExpenses();
      handleCancel();
    } catch (error: unknown) {
      console.error('Erro ao atualizar despesa recorrente:', error);
      const message = error instanceof Error ? error.message : t('expenses.saveError');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (expense: Expense) => {
    if (expense.isRecurring) {
      setExpenseToDelete(expense);
      return;
    }

    if (window.confirm(t('expenses.confirmDelete'))) {
      void confirmDeleteExpense(expense.id, 'single');
    }
  };

  const confirmDeleteExpense = async (
    expenseId: string,
    scope: RecurringDeleteScope
  ) => {
    try {
      setIsDeleting(true);
      await deleteExpense(expenseId, { deleteScope: scope });
      await fetchExpenses();
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir despesa:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmRecurringDelete = async (scope: RecurringDeleteScope) => {
    if (!expenseToDelete) return;
    await confirmDeleteExpense(expenseToDelete.id, scope);
  };

  const totalAmount = cardExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const closingMeta = creditCard.closing_day
    ? t('creditCards.closingMeta', { day: creditCard.closing_day })
    : '';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <>
      {showRecurringScopeModal && (
        <RecurringEditScopeModal
          type="expense"
          isSubmitting={isSubmitting}
          onSelect={handleRecurringScopeSelect}
          onCancel={() => setShowRecurringScopeModal(false)}
        />
      )}
      {expenseToDelete && (
        <RecurringDeleteScopeModal
          type="expense"
          description={expenseToDelete.description}
          isSubmitting={isDeleting}
          onSelect={handleConfirmRecurringDelete}
          onCancel={() => !isDeleting && setExpenseToDelete(null)}
        />
      )}
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="credit-card-expenses-title"
    >
      <div
        className="fc-card my-4 flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col overflow-hidden shadow-lift sm:my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-mist-line bg-white p-5 sm:p-6">
          <div className="min-w-0">
            <h3 id="credit-card-expenses-title" className="font-display text-xl font-semibold text-ink">
              {t('creditCards.expensesOfNamed', { name: creditCard.name })}
            </h3>
            <p className="mt-1 text-sm text-ink/55">
              {t('creditCards.headerMeta', {
                month: months[selectedMonth - 1],
                year: selectedYear,
                total: formatCurrency(totalAmount, dateLocale),
                closing: closingMeta,
                dueDay: creditCard.due_day,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="fc-icon-btn shrink-0 text-ink/45 hover:bg-mist hover:text-ink"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="mb-6 rounded-xl border border-mist-line bg-mist/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Filter size={18} className="text-mint" />
              <h4 className="font-medium text-ink">{t('creditCards.filters')}</h4>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="fc-label">
                  {t('common.year')}
                </label>
                <select
                  className="fc-input"
                  value={selectedYear}
                  onChange={(e) => {
                    const newYear = parseInt(e.target.value);
                    setSelectedYear(newYear);
                    const monthsInYear = [...new Set(allCardExpenses
                      .filter(expense => new Date(expense.date).getFullYear() === newYear)
                      .map(expense => new Date(expense.date).getMonth() + 1)
                    )].sort((a, b) => a - b);
                    if (monthsInYear.length > 0) {
                      setSelectedMonth(monthsInYear[0]);
                    }
                  }}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="fc-label">
                  {t('common.month')}
                </label>
                <select
                  className="fc-input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {months[month - 1]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 text-sm text-ink/50">
              {t('creditCards.showingCount', {
                filtered: cardExpenses.length,
                total: allCardExpenses.length,
              })}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-expense/20 bg-expense-soft px-3 py-3">
              <p className="text-sm text-expense">{error}</p>
            </div>
          )}

          {(isAddingNew || editingExpense) && (
            <div className="fc-form-panel !mb-6">
              <h4 className="mb-4 font-medium text-ink">
                {editingExpense ? t('expenses.edit') : t('creditCards.newExpense')}
              </h4>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="fc-label">
                      {t('common.descriptionRequired')}
                    </label>
                    <input
                      type="text"
                      className="fc-input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="fc-label">
                      {t('common.amountRequired')}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-sm text-ink/45">{t('common.currencySymbol')}</span>
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="fc-input pl-9"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="fc-label">
                      {t('common.categoryRequired')}
                    </label>
                    <select
                      className="fc-input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{translateCategory(cat)}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="fc-label">
                      {t('common.date')}
                    </label>
                    <input
                      type="date"
                      className="fc-input"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-ink/45">
                      {t('creditCards.suggestion', {
                        date: formatDate(calculateCreditCardDueDate(creditCard), dateLocale),
                      })}
                      {creditCard.closing_day && (
                        <span className="block text-xs">
                          {t('creditCards.basedOnClosing', { day: creditCard.closing_day })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="fc-btn-secondary"
                    disabled={isSubmitting}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="fc-btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? t('common.saving')
                      : editingExpense
                        ? t('common.update')
                        : t('common.add')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!isAddingNew && !editingExpense && (
            <div className="mb-4">
              <button
                onClick={handleAddNew}
                className="fc-btn-primary"
              >
                <Plus size={18} />
                {t('creditCards.newExpense')}
              </button>
            </div>
          )}

          {cardExpenses.length > 0 ? (
            <div className="fc-card overflow-hidden">
              <div className="border-b border-mist-line bg-mist/60 px-4 py-3 sm:px-6">
                <h5 className="font-medium text-ink">
                  {t('creditCards.monthExpensesHeader', {
                    month: months[selectedMonth - 1],
                    year: selectedYear,
                    count: cardExpenses.length,
                  })}
                </h5>
              </div>
              <div className="fc-table-wrap">
                <table className="fc-table">
                  <thead>
                    <tr>
                      <th>{t('common.description')}</th>
                      <th>{t('common.category')}</th>
                      <th>{t('common.date')}</th>
                      <th>{t('common.amount')}</th>
                      <th>{t('common.status')}</th>
                      <th className="text-center">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardExpenses.map((expense) => (
                      <tr key={expense.id}>
                        <td>
                          <div className="flex flex-wrap items-center gap-2 font-medium text-ink">
                            {expense.description}
                            {expense.isRecurring && (
                              <span className="fc-badge-info">
                                <RefreshCw size={12} />
                                {formatInstallment(expense.recurringIndex, expense.recurringCount, installmentTpl) || t('common.recurring')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{translateCategory(expense.category)}</td>
                        <td>
                          <div className="flex items-center text-ink/70">
                            <Calendar size={14} className="mr-1 text-ink/35" />
                            {formatDate(expense.date, dateLocale)}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-expense">
                            {formatCurrency(expense.amount, dateLocale)}
                          </div>
                        </td>
                        <td>
                          <span className={expense.isPaid ? 'fc-badge-success' : 'fc-badge-danger'}>
                            {expense.isPaid ? t('expenses.paid') : t('expenses.unpaid')}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-center gap-2">
                            {!expense.isPaid && (
                              <button
                                onClick={() => handleEdit(expense)}
                                className="fc-icon-btn bg-mint-soft text-mint hover:bg-mint hover:text-white"
                                title={t('expenses.editTitle')}
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {!expense.isPaid && (
                              <button
                                onClick={() => handleDelete(expense)}
                                className="fc-icon-btn bg-expense-soft text-expense hover:bg-expense hover:text-white"
                                title={t('expenses.deleteTitle')}
                              >
                                <Trash size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="fc-empty !py-10">
              <p className="mb-4 text-ink/55">
                {t('creditCards.emptyForMonth', {
                  month: months[selectedMonth - 1],
                  year: selectedYear,
                })}
              </p>
              {allCardExpenses.length > 0 && (
                <p className="mb-4 text-sm text-ink/40">
                  {t('creditCards.otherPeriods', { count: allCardExpenses.length })}
                </p>
              )}
              <button
                onClick={handleAddNew}
                className="fc-btn-primary"
              >
                <Plus size={18} />
                {t('creditCards.addForMonth', { month: months[selectedMonth - 1] })}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>,
    document.body
  );
};

export default CreditCardExpensesList;
