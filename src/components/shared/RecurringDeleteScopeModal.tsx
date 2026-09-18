import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash, X } from 'lucide-react';

export type RecurringDeleteScope = 'single' | 'series';

interface RecurringDeleteScopeModalProps {
  type: 'income' | 'expense';
  description?: string;
  isSubmitting?: boolean;
  onSelect: (scope: RecurringDeleteScope) => void;
  onCancel: () => void;
}

const RecurringDeleteScopeModal: React.FC<RecurringDeleteScopeModalProps> = ({
  type,
  description,
  isSubmitting = false,
  onSelect,
  onCancel,
}) => {
  const label = type === 'income' ? 'receita' : 'despesa';
  const seriesHint =
    type === 'income'
      ? 'Remove somente as receitas ainda não recebidas da série.'
      : 'Remove somente as despesas ainda não pagas da série.';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isSubmitting, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={() => !isSubmitting && onCancel()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-delete-scope-title"
    >
      <div
        className="fc-card w-full max-w-md overflow-hidden shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-mist-line p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-expense-soft text-expense">
              <Trash size={18} />
            </div>
            <div>
              <h3 id="recurring-delete-scope-title" className="font-display text-lg font-semibold text-ink">
                Excluir {label} recorrente
              </h3>
              <p className="mt-1 text-sm text-ink/55">
                {description
                  ? `Deseja excluir somente "${description}" ou todas as recorrentes da série?`
                  : `Deseja excluir somente esta ${label} ou todas as recorrentes da série?`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="fc-icon-btn shrink-0 text-ink/45 hover:bg-mist hover:text-ink"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <button
            type="button"
            className="w-full rounded-xl border border-mist-line bg-white px-4 py-3 text-left transition hover:border-expense/30 hover:bg-mist/60 disabled:opacity-60"
            onClick={() => onSelect('single')}
            disabled={isSubmitting}
          >
            <div className="font-medium text-ink">Somente esta {label}</div>
            <div className="mt-1 text-sm text-ink/50">
              Remove apenas o registro selecionado.
            </div>
          </button>

          <button
            type="button"
            className="w-full rounded-xl border border-expense/25 bg-expense-soft/50 px-4 py-3 text-left transition hover:border-expense/40 hover:bg-expense-soft disabled:opacity-60"
            onClick={() => onSelect('series')}
            disabled={isSubmitting}
          >
            <div className="font-medium text-ink">Todas as recorrentes</div>
            <div className="mt-1 text-sm text-ink/55">{seriesHint}</div>
          </button>

          <button
            type="button"
            className="fc-btn-secondary w-full"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RecurringDeleteScopeModal;
