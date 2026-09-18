import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { CreditCard } from 'lucide-react';
import { CreditCard as CreditCardType } from '../../types';
import { useTranslation } from '../../i18n/LanguageProvider';

const CARD_COLORS = [
  '#0F766E',
  '#14302B',
  '#059669',
  '#0B1F1C',
  '#B45309',
  '#E11D48',
  '#1D4ED8',
  '#7C3AED',
  '#334155',
  '#0EA5E9',
  '#64748B',
  '#000000',
];

interface AddCreditCardFormProps {
  onComplete: () => void;
  creditCard?: CreditCardType;
}

const AddCreditCardForm: React.FC<AddCreditCardFormProps> = ({ onComplete, creditCard }) => {
  const { t } = useTranslation();
  const { addCreditCard, updateCreditCard } = useFinance();

  const [name, setName] = useState(creditCard?.name || '');
  const [lastFour, setLastFour] = useState(creditCard?.last_four || '');
  const [due_day, setDueDay] = useState(creditCard?.due_day?.toString() || '1');
  const [closing_day, setClosingDay] = useState(creditCard?.closing_day?.toString() || '');
  const [credit_limit, setCreditLimit] = useState(creditCard?.credit_limit?.toString() || '');
  const [color, setColor] = useState(creditCard?.color || CARD_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !due_day) {
      setError(t('common.requiredFields'));
      return;
    }

    if (lastFour && !/^\d{4}$/.test(lastFour)) {
      setError(t('creditCards.errorLastFour'));
      return;
    }

    const dueDayNum = parseInt(due_day);
    if (dueDayNum < 1 || dueDayNum > 31) {
      setError(t('creditCards.errorDueDay'));
      return;
    }

    if (closing_day) {
      const closingDayNum = parseInt(closing_day);
      if (closingDayNum < 1 || closingDayNum > 31) {
        setError(t('creditCards.errorClosingDay'));
        return;
      }
    }

    try {
      setIsSubmitting(true);

      const cardData = {
        name,
        last_four: lastFour || null,
        due_day: dueDayNum,
        closing_day: closing_day ? parseInt(closing_day) : null,
        credit_limit: credit_limit ? parseFloat(credit_limit) : 0,
        color,
      };

      if (creditCard?.id) {
        await updateCreditCard(creditCard.id, cardData);
      } else {
        await addCreditCard(cardData);
      }

      onComplete();
    } catch (err: unknown) {
      console.error('Erro ao adicionar cartão:', err);
      const message = err instanceof Error ? err.message : t('creditCards.saveError');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-expense/20 bg-expense-soft px-3 py-3">
          <p className="text-sm text-expense">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="fc-label">
            {t('creditCards.nameRequired')}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CreditCard size={16} className="text-ink/35" />
            </div>
            <input
              type="text"
              id="name"
              className="fc-input pl-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('creditCards.namePlaceholder')}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="last_four" className="fc-label">
            {t('creditCards.lastFour')}
          </label>
          <input
            type="text"
            id="last_four"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            className="fc-input"
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
          />
          <p className="mt-1 text-xs text-ink/45">
            {t('creditCards.lastFourHint')}
          </p>
        </div>

        <div>
          <label htmlFor="due_day" className="fc-label">
            {t('creditCards.dueDayRequired')}
          </label>
          <input
            type="number"
            id="due_day"
            min="1"
            max="31"
            className="fc-input"
            value={due_day}
            onChange={(e) => setDueDay(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-ink/45">
            {t('creditCards.dueDayHint')}
          </p>
        </div>

        <div>
          <label htmlFor="closing_day" className="fc-label">
            {t('creditCards.closingDayLabel')}
          </label>
          <input
            type="number"
            id="closing_day"
            min="1"
            max="31"
            className="fc-input"
            value={closing_day}
            onChange={(e) => setClosingDay(e.target.value)}
            placeholder={t('common.optional')}
          />
          <p className="mt-1 text-xs text-ink/45">
            {t('creditCards.closingDayHint')}
          </p>
        </div>

        <div>
          <label htmlFor="credit_limit" className="fc-label">
            {t('creditCards.creditLimitOptional')}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-sm text-ink/45">{t('common.currencySymbol')}</span>
            </div>
            <input
              type="number"
              id="credit_limit"
              min="0"
              step="0.01"
              className="fc-input pl-9"
              value={credit_limit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="fc-label">{t('creditCards.cardColor')}</label>
          <div className="flex flex-wrap gap-2">
            {CARD_COLORS.map((cardColor) => (
              <button
                key={cardColor}
                type="button"
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  color === cardColor ? 'scale-110 ring-2 ring-mint ring-offset-2' : ''
                }`}
                style={{ backgroundColor: cardColor }}
                onClick={() => setColor(cardColor)}
                aria-label={t('creditCards.selectColor', { color: cardColor })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
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
          {isSubmitting ? t('common.saving') : creditCard?.id ? t('creditCards.update') : t('creditCards.add')}
        </button>
      </div>
    </form>
  );
};

export default AddCreditCardForm;
