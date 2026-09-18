import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Plus, Trash, CreditCard } from 'lucide-react';
import { CreditCard as CreditCardType } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { calculateCreditCardDueDate } from '../../utils/creditCardDueDate';
import { useTranslation } from '../../i18n/LanguageProvider';

const EXPENSE_CATEGORIES = [
  "Alimentação", "Moradia", "Transporte", "Entretenimento",
  "Utilidades", "Saúde", "Educação", "Compras",
  "Viagem", "Assinaturas", "Seguros", "Outros"
];

interface ExpenseItem {
  id: string;
  description: string;
  amount: string;
  category: string;
}

interface AddCreditCardExpensesFormProps {
  creditCard: CreditCardType;
  onComplete: () => void;
}

const AddCreditCardExpensesForm: React.FC<AddCreditCardExpensesFormProps> = ({
  creditCard,
  onComplete
}) => {
  const { t, translateCategory, dateLocale } = useTranslation();
  const { addExpense, fetchExpenses } = useFinance();

  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: '1', description: '', amount: '', category: EXPENSE_CATEGORIES[0] }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addExpenseRow = () => {
    const newId = (expenses.length + 1).toString();
    setExpenses([...expenses, {
      id: newId,
      description: '',
      amount: '',
      category: EXPENSE_CATEGORIES[0]
    }]);
  };

  const removeExpenseRow = (id: string) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter(expense => expense.id !== id));
    }
  };

  const updateExpense = (id: string, field: keyof ExpenseItem, value: string) => {
    setExpenses(expenses.map(expense =>
      expense.id === id ? { ...expense, [field]: value } : expense
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validExpenses = expenses.filter(expense =>
      expense.description.trim() && expense.amount.trim()
    );

    if (validExpenses.length === 0) {
      setError(t('creditCards.atLeastOne'));
      return;
    }

    const invalidAmounts = validExpenses.some(expense =>
      isNaN(parseFloat(expense.amount)) || parseFloat(expense.amount) <= 0
    );

    if (invalidAmounts) {
      setError(t('common.positiveAmounts'));
      return;
    }

    try {
      setIsSubmitting(true);

      const dueDate = calculateCreditCardDueDate(creditCard);

      const promises = validExpenses.map(expense =>
        addExpense({
          description: expense.description,
          amount: parseFloat(expense.amount),
          date: dueDate,
          categoryName: expense.category,
          isPaid: false,
          isRecurring: false,
          creditCardId: creditCard.id
        })
      );

      await Promise.all(promises);
      await fetchExpenses();
      onComplete();
    } catch (error: any) {
      console.error('Erro ao adicionar despesas:', error);
      setError(error.message || t('creditCards.saveExpensesError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = expenses
    .filter(expense => expense.amount.trim())
    .reduce((sum, expense) => {
      const amount = parseFloat(expense.amount);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

  const calculatedDueDate = calculateCreditCardDueDate(creditCard);
  const formattedDueDate = formatDate(calculatedDueDate, dateLocale);
  const validCount = expenses.filter(e => e.description && e.amount).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-expense/20 bg-expense-soft px-3 py-3">
          <p className="text-sm text-expense">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-mist-line bg-mist/60 p-4">
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="flex items-center font-medium text-ink">
            <CreditCard className="mr-2 text-mint" size={18} />
            {creditCard.name}
          </h4>
          <div className="text-sm text-ink/55">
            {creditCard.closing_day && (
              <span>{t('creditCards.closingOnly', { day: creditCard.closing_day })}</span>
            )}
            {t('creditCards.dueOnly', { day: creditCard.due_day })}
          </div>
        </div>
        <div className="text-sm text-ink/60">
          {t('creditCards.scheduledFor', { date: formattedDueDate })}
          {creditCard.closing_day && (
            <span className="mt-1 block text-xs text-ink/45">
              {t('creditCards.basedOnClosingDue', {
                closingDay: creditCard.closing_day,
                dueDay: creditCard.due_day,
              })}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium text-ink">{t('creditCards.expensesOfCard')}</h4>
          <button
            type="button"
            onClick={addExpenseRow}
            className="fc-btn-ghost !px-2 !py-1.5 text-sm text-mint hover:text-ink"
          >
            <Plus size={16} />
            {t('expenses.add')}
          </button>
        </div>

        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="grid grid-cols-1 gap-4 rounded-xl border border-mist-line bg-white p-4 md:grid-cols-4"
          >
            <div>
              <label className="fc-label">
                {t('common.descriptionRequired')}
              </label>
              <input
                type="text"
                className="fc-input"
                value={expense.description}
                onChange={(e) => updateExpense(expense.id, 'description', e.target.value)}
                placeholder={t('creditCards.descriptionPlaceholder')}
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
                  value={expense.amount}
                  onChange={(e) => updateExpense(expense.id, 'amount', e.target.value)}
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
                value={expense.category}
                onChange={(e) => updateExpense(expense.id, 'category', e.target.value)}
                required
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{translateCategory(cat)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              {expenses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExpenseRow(expense.id)}
                  className="fc-icon-btn bg-expense-soft text-expense hover:bg-expense hover:text-white"
                  title={t('creditCards.removeExpense')}
                >
                  <Trash size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalAmount > 0 && (
        <div className="rounded-xl border border-mint/20 bg-mint-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-ink">{t('creditCards.expensesTotal')}</span>
            <span className="font-display text-xl font-bold text-mint">
              {formatCurrency(totalAmount, dateLocale)}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-mist-line pt-4">
        <button
          type="button"
          className="fc-btn-secondary"
          onClick={onComplete}
          disabled={isSubmitting}
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="fc-btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? t('common.saving') : t('creditCards.addCount', { count: validCount })}
        </button>
      </div>
    </form>
  );
};

export default AddCreditCardExpensesForm;
