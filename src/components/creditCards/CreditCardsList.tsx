import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency } from '../../utils/formatters';
import AddCreditCardForm from './AddCreditCardForm';
import AddCreditCardExpensesForm from './AddCreditCardExpensesForm';
import CreditCardExpensesList from './CreditCardExpensesList';
import { Plus, CreditCard as CreditCardIcon, Trash, Calendar, Pencil, X, AlertTriangle } from 'lucide-react';
import { CreditCard } from '../../types';

const CreditCardsList: React.FC = () => {
  const { creditCards, getCreditCardSummaries, deleteCreditCard } = useFinance();
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [addingExpensesToCard, setAddingExpensesToCard] = useState<CreditCard | null>(null);
  const [viewingExpensesCard, setViewingExpensesCard] = useState<CreditCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const creditCardSummaries = getCreditCardSummaries();

  const handleEditClick = (card: CreditCard) => {
    setEditingCard(card);
    setIsAddingCard(true);
  };

  const handleFormComplete = () => {
    setIsAddingCard(false);
    setEditingCard(null);
    setAddingExpensesToCard(null);
    setViewingExpensesCard(null);
  };

  const handleConfirmDelete = async () => {
    if (!cardToDelete) return;

    try {
      setIsDeleting(true);
      await deleteCreditCard(cardToDelete.id);
      setCardToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir cartão:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">Cartões de Crédito</h2>
          <p className="fc-subtitle">Gerencie cartões, faturas e despesas vinculadas</p>
        </div>

        <button
          className="fc-btn-primary"
          onClick={() => {
            setEditingCard(null);
            setIsAddingCard(true);
          }}
        >
          <Plus size={18} />
          <span>Adicionar Cartão</span>
        </button>
      </div>

      {isAddingCard && (
        <div className="fc-form-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">
              {editingCard ? 'Editar Cartão de Crédito' : 'Adicionar Novo Cartão'}
            </h3>
            <button
              onClick={handleFormComplete}
              className="fc-icon-btn text-ink/45 hover:bg-mist hover:text-ink"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <AddCreditCardForm
            onComplete={handleFormComplete}
            creditCard={editingCard || undefined}
          />
        </div>
      )}

      {addingExpensesToCard && (
        <div className="fc-form-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">
              Adicionar Despesas ao Cartão
            </h3>
            <button
              onClick={handleFormComplete}
              className="fc-icon-btn text-ink/45 hover:bg-mist hover:text-ink"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <AddCreditCardExpensesForm
            creditCard={addingExpensesToCard}
            onComplete={handleFormComplete}
          />
        </div>
      )}

      {viewingExpensesCard && (
        <CreditCardExpensesList
          creditCard={viewingExpensesCard}
          onClose={() => setViewingExpensesCard(null)}
        />
      )}

      {cardToDelete && (
        <DeleteCreditCardModal
          card={cardToDelete}
          isDeleting={isDeleting}
          onCancel={() => !isDeleting && setCardToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {creditCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {creditCardSummaries.map((card) => {
            const availableBalance = (card.credit_limit || 0) - card.totalExpenses;
            const expenseCount = card.expenses.length;

            return (
              <div key={card.id} className="fc-card overflow-hidden">
                <div
                  className="p-5 text-white"
                  style={{ backgroundColor: card.color || '#0b1f1c' }}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-lg font-semibold">{card.name}</h3>
                      {card.last_four && (
                        <p className="mt-1 font-mono text-sm tracking-widest text-white/80">
                          •••• {card.last_four}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditClick(card)}
                        className="fc-icon-btn bg-white/15 text-white hover:bg-white/25"
                        title="Editar cartão"
                      >
                        <Pencil size={16} />
                      </button>
                      <CreditCardIcon size={22} className="opacity-90" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/65">Saldo disponível</div>
                      <div className={`mt-1 font-display text-xl font-bold ${availableBalance < 0 ? 'text-rose-200' : ''}`}>
                        {formatCurrency(availableBalance)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/65">Total gasto</div>
                      <div className="mt-1 font-display text-xl font-bold">
                        {formatCurrency(card.totalExpenses)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/15 pt-3 text-sm text-white/85">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>Vencimento: dia {card.due_day}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>
                        Fechamento:{' '}
                        {card.closing_day ? `dia ${card.closing_day}` : 'não informado'}
                      </span>
                    </div>
                  </div>

                  {card.credit_limit > 0 && (
                    <p className="mt-2 text-xs text-white/60">
                      Limite: {formatCurrency(card.credit_limit)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-ink/55">
                    {expenseCount === 0
                      ? 'Nenhuma despesa vinculada'
                      : `${expenseCount} despesa${expenseCount > 1 ? 's' : ''} vinculada${expenseCount > 1 ? 's' : ''}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setAddingExpensesToCard(card)}
                      className="fc-btn-secondary !px-3 !py-1.5 text-xs"
                      title="Adicionar despesas"
                    >
                      <Plus size={14} />
                      Despesas
                    </button>
                    <button
                      onClick={() => setViewingExpensesCard(card)}
                      className="fc-btn-secondary !px-3 !py-1.5 text-xs"
                      title="Gerenciar despesas"
                    >
                      <Pencil size={14} />
                      Gerenciar
                    </button>
                    <button
                      onClick={() => setCardToDelete(card)}
                      className="fc-icon-btn bg-expense-soft text-expense hover:bg-expense hover:text-white"
                      title="Excluir cartão"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="fc-empty">
          <CreditCardIcon size={36} className="mb-3 text-mint" />
          <p className="mb-4 text-ink/55">Nenhum cartão adicionado ainda</p>
          <button
            className="fc-btn-primary"
            onClick={() => setIsAddingCard(true)}
          >
            <Plus size={18} />
            <span>Adicionar Cartão</span>
          </button>
        </div>
      )}
    </div>
  );
};

interface DeleteCreditCardModalProps {
  card: CreditCard;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteCreditCardModal: React.FC<DeleteCreditCardModalProps> = ({
  card,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDeleting, onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-credit-card-title"
    >
      <div
        className="fc-card w-full max-w-md overflow-hidden shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-expense-soft text-expense">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <h3 id="delete-credit-card-title" className="font-display text-lg font-semibold text-ink">
                Excluir cartão {card.name}?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">
                Ao excluir este cartão, as despesas vinculadas permanecerão no sistema,
                porém não estarão mais vinculadas a nenhum cartão.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="fc-btn-secondary"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-expense px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-expense/90 disabled:opacity-60"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              <Trash size={16} />
              {isDeleting ? 'Excluindo...' : 'Excluir cartão'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreditCardsList;
