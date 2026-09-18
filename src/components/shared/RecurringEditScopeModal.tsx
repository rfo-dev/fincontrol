import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';

export type RecurringEditScope = 'single' | 'series';

interface RecurringEditScopeModalProps {
  type: 'income' | 'expense';
  isSubmitting?: boolean;
  onSelect: (scope: RecurringEditScope) => void;
  onCancel: () => void;
}

const RecurringEditScopeModal: React.FC<RecurringEditScopeModalProps> = ({
  type,
  isSubmitting = false,
  onSelect,
  onCancel,
}) => {
  const label = type === 'income' ? 'receita' : 'despesa';
  const seriesHint =
    type === 'income'
      ? 'Apenas receitas ainda não recebidas da série serão atualizadas.'
      : 'Apenas despesas ainda não pagas da série serão atualizadas.';

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
      aria-labelledby="recurring-edit-scope-title"
    >
      <div
        className="fc-card w-full max-w-md overflow-hidden shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-mist-line p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-mint">
              <RefreshCw size={18} />
            </div>
            <div>
              <h3 id="recurring-edit-scope-title" className="font-display text-lg font-semibold text-ink">
                Editar {label} recorrente
              </h3>
              <p className="mt-1 text-sm text-ink/55">
                Deseja aplicar as alterações somente nesta {label} ou em todas as recorrentes?
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
            className="w-full rounded-xl border border-mist-line bg-white px-4 py-3 text-left transition hover:border-mint/40 hover:bg-mist/60 disabled:opacity-60"
            onClick={() => onSelect('single')}
            disabled={isSubmitting}
          >
            <div className="font-medium text-ink">Somente esta {label}</div>
            <div className="mt-1 text-sm text-ink/50">
              Atualiza apenas o registro que você está editando.
            </div>
          </button>

          <button
            type="button"
            className="w-full rounded-xl border border-mint/30 bg-mint-soft/40 px-4 py-3 text-left transition hover:border-mint/50 hover:bg-mint-soft/70 disabled:opacity-60"
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

export default RecurringEditScopeModal;
