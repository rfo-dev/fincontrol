import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { CreditCard, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { calculateCreditCardDueDate, calculateRecurringDueDates } from '../../utils/creditCardDueDate';
import { formatDate, parseDateInput, toDateInputValue } from '../../utils/formatters';
import RecurringEditScopeModal, { RecurringEditScope } from '../shared/RecurringEditScopeModal';
import ToggleSwitch from '../ui/ToggleSwitch';

const EXPENSE_CATEGORIES = [
  "Alimentação", "Moradia", "Transporte", "Entretenimento",
  "Utilidades", "Saúde", "Educação", "Compras",
  "Viagem", "Assinaturas", "Seguros", "Outros"
];

interface AddExpenseFormProps {
  onComplete: () => void;
  expense?: {
    id: string;
    description: string;
    amount: number;
    date: Date;
    category: string;
    isPaid: boolean;
    isRecurring: boolean;
    recurringInterval?: 'weekly' | 'monthly' | 'yearly';
    creditCardId?: string;
  };
}

const AddExpenseForm: React.FC<AddExpenseFormProps> = ({ onComplete, expense }) => {
  const { addExpense, updateExpense, creditCards, fetchExpenses } = useFinance();

  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(expense?.amount.toString() || '');
  const [date, setDate] = useState(expense?.date ? toDateInputValue(expense.date) : toDateInputValue());
  const [category, setCategory] = useState(expense?.category || EXPENSE_CATEGORIES[0]);
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring || false);
  const [recurringInterval, setRecurringInterval] = useState<'weekly' | 'monthly' | 'yearly'>(expense?.recurringInterval || 'monthly');
  const [recurringCount, setRecurringCount] = useState(1);
  const [creditCardId, setCreditCardId] = useState<string | undefined>(expense?.creditCardId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showRecurringScopeModal, setShowRecurringScopeModal] = useState(false);

  const saveExpense = async (editScope: RecurringEditScope = 'single') => {
    if (expense?.id) {
      await updateExpense(expense.id, {
        description,
        amount: parseFloat(amount),
        date: parseDateInput(date),
        categoryName: category,
        isPaid: expense.isPaid,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : undefined,
        creditCardId,
        editScope,
      });
      return;
    }

    const baseDate = parseDateInput(date);

    if (isRecurring && recurringCount > 1) {
      const promises = [];
      const selectedCard = creditCardId ? creditCards.find(card => card.id === creditCardId) : null;

      if (selectedCard) {
        const dueDates = calculateRecurringDueDates(selectedCard, recurringCount);

        for (let i = 0; i < recurringCount; i++) {
          promises.push(addExpense({
            description,
            amount: parseFloat(amount),
            date: dueDates[i],
            categoryName: category,
            isPaid: false,
            isRecurring: true,
            recurringInterval,
            recurringCount,
            recurringIndex: i + 1,
            creditCardId: creditCardId || undefined
          }));
        }
      } else {
        for (let i = 0; i < recurringCount; i++) {
          const recurringDate = new Date(baseDate);
          if (i > 0) {
            switch (recurringInterval) {
              case 'weekly':
                recurringDate.setDate(recurringDate.getDate() + (i * 7));
                break;
              case 'monthly':
                recurringDate.setMonth(recurringDate.getMonth() + i);
                break;
              case 'yearly':
                recurringDate.setFullYear(recurringDate.getFullYear() + i);
                break;
            }
          }
          promises.push(addExpense({
            description,
            amount: parseFloat(amount),
            date: recurringDate,
            categoryName: category,
            isPaid: false,
            isRecurring: true,
            recurringInterval,
            recurringCount,
            recurringIndex: i + 1,
            creditCardId: undefined
          }));
        }
      }

      await Promise.all(promises);
      await fetchExpenses();
      return;
    }

    let expenseDate = parseDateInput(date);

    if (creditCardId) {
      const selectedCard = creditCards.find(card => card.id === creditCardId);
      if (selectedCard) {
        expenseDate = calculateCreditCardDueDate(selectedCard);
      }
    }

    await addExpense({
      description,
      amount: parseFloat(amount),
      date: expenseDate,
      categoryName: category,
      isPaid: false,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      recurringCount: isRecurring ? recurringCount : undefined,
      recurringIndex: isRecurring ? 1 : undefined,
      creditCardId
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!description || !amount || !category) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (expense?.id && expense.isRecurring) {
      setShowRecurringScopeModal(true);
      return;
    }

    try {
      setIsSubmitting(true);
      await saveExpense('single');
      onComplete();
    } catch (error: unknown) {
      console.error('Erro ao adicionar despesa:', error);
      const message = error instanceof Error ? error.message : 'Erro ao salvar a despesa. Por favor, tente novamente.';
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
      onComplete();
    } catch (error: unknown) {
      console.error('Erro ao atualizar despesa recorrente:', error);
      const message = error instanceof Error ? error.message : 'Erro ao salvar a despesa. Por favor, tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisplayDueDate = (): string | null => {
    if (!creditCardId) return null;
    const selectedCard = creditCards.find(card => card.id === creditCardId);
    if (!selectedCard) return null;

    const dueDate = calculateCreditCardDueDate(selectedCard);
    return formatDate(dueDate);
  };

  return (
    <>
      {showRecurringScopeModal && (
        <RecurringEditScopeModal
          type="expense"
          isSubmitting={isSubmitting}
          onSelect={handleRecurringScopeSelect}
          onCancel={() => setShowRecurringScopeModal(false)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-expense/20 bg-expense-soft px-3 py-3">
            <p className="text-sm text-expense">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="description" className="fc-label">
              Descrição*
            </label>
            <input
              type="text"
              id="description"
              className="fc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="amount" className="fc-label">
              Valor*
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-sm text-ink/45">R$</span>
              </div>
              <input
                type="number"
                id="amount"
                min="0.01"
                step="0.01"
                className="fc-input pl-9"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="creditCard" className="fc-label">
              Cartão de Crédito
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CreditCard size={16} className="text-ink/35" />
              </div>
              <select
                id="creditCard"
                className="fc-input pl-10"
                value={creditCardId || ''}
                onChange={(e) => setCreditCardId(e.target.value || undefined)}
              >
                <option value="">Nenhum</option>
                {creditCards.map((card) => (
                  <option key={card.id} value={card.id}>{card.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="date" className="fc-label">
              Data
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CalendarIcon size={16} className="text-ink/35" />
              </div>
              <input
                type="date"
                id="date"
                className="fc-input pl-10 disabled:bg-mist disabled:text-ink/50"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!!creditCardId}
              />
            </div>
            {creditCardId && (
              <p className="mt-1 text-xs text-ink/45">
                Vencimento calculado: {getDisplayDueDate()} (baseado no fechamento e vencimento do cartão)
              </p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="fc-label">
              Categoria*
            </label>
            <select
              id="category"
              className="fc-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {!expense?.id && (
          <>
            <ToggleSwitch
              id="isRecurring"
              checked={isRecurring}
              onChange={setIsRecurring}
              label={
                <span className="flex items-center gap-1.5">
                  <RefreshCw size={16} className="text-mint" />
                  Esta é uma despesa recorrente
                </span>
              }
              className="w-fit"
            />

            {isRecurring && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="recurringInterval" className="fc-label">
                    Intervalo de Recorrência
                  </label>
                  <select
                    id="recurringInterval"
                    className="fc-input"
                    value={recurringInterval}
                    onChange={(e) => setRecurringInterval(e.target.value as 'weekly' | 'monthly' | 'yearly')}
                  >
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="recurringCount" className="fc-label">
                    Quantidade de Recorrências
                  </label>
                  <input
                    type="number"
                    id="recurringCount"
                    min="1"
                    max="60"
                    className="fc-input"
                    value={recurringCount}
                    onChange={(e) => setRecurringCount(parseInt(e.target.value))}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            className="fc-btn-secondary"
            onClick={onComplete}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="fc-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : expense?.id ? 'Atualizar Despesa' : 'Adicionar Despesa'}
          </button>
        </div>
      </form>
    </>
  );
};

export default AddExpenseForm;
