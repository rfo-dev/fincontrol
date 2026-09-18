import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { Income } from '../../types';
import { parseDateInput, toDateInputValue } from '../../utils/formatters';
import RecurringEditScopeModal, { RecurringEditScope } from '../shared/RecurringEditScopeModal';
import ToggleSwitch from '../ui/ToggleSwitch';

const INCOME_CATEGORIES = [
  'Salário', 'Freelance', 'Investimentos', 'Aluguel',
  'Presentes', 'Reembolsos', 'Negócios', 'Outros',
];

interface AddIncomeFormProps {
  onComplete: () => void;
  income?: Income;
}

const AddIncomeForm: React.FC<AddIncomeFormProps> = ({ onComplete, income }) => {
  const { addIncome, updateIncome, fetchIncomes } = useFinance();

  const [description, setDescription] = useState(income?.description || '');
  const [amount, setAmount] = useState(income?.amount.toString() || '');
  const [date, setDate] = useState(
    income?.date ? toDateInputValue(income.date) : toDateInputValue()
  );
  const [category, setCategory] = useState(income?.category || INCOME_CATEGORIES[0]);
  const [isReceived, setIsReceived] = useState(income?.isReceived || false);
  const [isRecurring, setIsRecurring] = useState(income?.isRecurring || false);
  const [recurringInterval, setRecurringInterval] = useState<'weekly' | 'monthly' | 'yearly'>(
    income?.recurringInterval || 'monthly'
  );
  const [recurringCount, setRecurringCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showRecurringScopeModal, setShowRecurringScopeModal] = useState(false);

  const saveIncome = async (editScope: RecurringEditScope = 'single') => {
    if (income?.id) {
      await updateIncome(income.id, {
        description,
        amount: parseFloat(amount),
        date: parseDateInput(date),
        categoryName: category,
        isReceived,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : undefined,
        editScope,
      });
      return;
    }

    if (isRecurring && recurringCount > 1) {
      const baseDate = parseDateInput(date);
      const promises = [];

      for (let i = 0; i < recurringCount; i++) {
        const recurringDate = new Date(baseDate);
        if (i > 0) {
          switch (recurringInterval) {
            case 'weekly':
              recurringDate.setDate(recurringDate.getDate() + i * 7);
              break;
            case 'monthly':
              recurringDate.setMonth(recurringDate.getMonth() + i);
              break;
            case 'yearly':
              recurringDate.setFullYear(recurringDate.getFullYear() + i);
              break;
          }
        }

        promises.push(
          addIncome({
            description,
            amount: parseFloat(amount),
            date: recurringDate,
            categoryName: category,
            isReceived: false,
            isRecurring: true,
            recurringInterval,
            recurringCount,
            recurringIndex: i + 1,
          })
        );
      }

      await Promise.all(promises);
      await fetchIncomes();
      return;
    }

    await addIncome({
      description,
      amount: parseFloat(amount),
      date: parseDateInput(date),
      categoryName: category,
      isReceived,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      recurringCount: isRecurring ? recurringCount : undefined,
      recurringIndex: isRecurring ? 1 : undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!description || !amount || !date || !category) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    if (income?.id && income.isRecurring) {
      setShowRecurringScopeModal(true);
      return;
    }

    try {
      setIsSubmitting(true);
      await saveIncome('single');
      onComplete();
    } catch (err: unknown) {
      console.error('Erro ao adicionar receita:', err);
      const message = err instanceof Error ? err.message : 'Erro ao salvar a receita. Por favor, tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecurringScopeSelect = async (scope: RecurringEditScope) => {
    try {
      setIsSubmitting(true);
      setShowRecurringScopeModal(false);
      await saveIncome(scope);
      onComplete();
    } catch (err: unknown) {
      console.error('Erro ao atualizar receita recorrente:', err);
      const message = err instanceof Error ? err.message : 'Erro ao salvar a receita. Por favor, tente novamente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {showRecurringScopeModal && (
        <RecurringEditScopeModal
          type="income"
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
            <label htmlFor="date" className="fc-label">
              Data*
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <CalendarIcon size={16} className="text-ink/40" />
              </div>
              <input
                type="date"
                id="date"
                className="fc-input pl-10"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
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
              {INCOME_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <ToggleSwitch
          id="isReceived"
          checked={isReceived}
          onChange={setIsReceived}
          disabled={isRecurring && !income?.id && recurringCount > 1}
          label="Receita já foi recebida"
          className="w-fit"
        />

        {!income?.id && (
          <>
            <ToggleSwitch
              id="isRecurring"
              checked={isRecurring}
              onChange={setIsRecurring}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw size={16} className="text-income" />
                  Esta é uma receita recorrente
                </span>
              }
              className="w-fit"
            />

            {isRecurring && (
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-mist-line bg-mist/40 p-4 md:grid-cols-2">
                <div>
                  <label htmlFor="recurringInterval" className="fc-label">
                    Intervalo de Recorrência
                  </label>
                  <select
                    id="recurringInterval"
                    className="fc-input"
                    value={recurringInterval}
                    onChange={(e) =>
                      setRecurringInterval(e.target.value as 'weekly' | 'monthly' | 'yearly')
                    }
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
                    onChange={(e) => setRecurringCount(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col-reverse justify-end gap-3 pt-2 sm:flex-row">
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
            className="fc-btn-income"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : income?.id ? 'Atualizar Receita' : 'Adicionar Receita'}
          </button>
        </div>
      </form>
    </>
  );
};

export default AddIncomeForm;
