import React, { useState } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrency, formatDate, formatInstallment } from '../../utils/formatters';
import AddIncomeForm from './AddIncomeForm';
import RecurringDeleteScopeModal, { RecurringDeleteScope } from '../shared/RecurringDeleteScopeModal';
import { Calendar, Plus, Trash, CreditCard as Edit, Check, Filter, RefreshCw, X } from 'lucide-react';
import { Income } from '../../types';
import ToggleSwitch from '../ui/ToggleSwitch';

const IncomeList: React.FC = () => {
  const { incomes, deleteIncome, toggleIncomeReceived, getAvailableMonths, getBringPreviousIncomes, setBringPreviousIncomes, getPreviousUnreceivedIncomes, settlePreviousIncomes } = useFinance();
  const [isAddingIncome, setIsAddingIncome] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<Income | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReceived, setFilterReceived] = useState<boolean | null>(null);

  // Get current date for default values
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Get available months and years
  const availableMonths = getAvailableMonths();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  // Create selected date object for calculations
  const selectedDate = new Date(selectedYear, selectedMonth - 1);
  const previousIncomes = getPreviousUnreceivedIncomes(selectedDate);
  const bringPreviousIncomes = getBringPreviousIncomes(selectedDate);

  // Get available years from data
  const availableYears = [...new Set(availableMonths.map(date => date.getFullYear()))].sort((a, b) => b - a);

  // Get available months for selected year
  const availableMonthsForYear = availableMonths
    .filter(date => date.getFullYear() === selectedYear)
    .map(date => date.getMonth() + 1)
    .filter((month, index, arr) => arr.indexOf(month) === index)
    .sort((a, b) => a - b);

  // Filter incomes based on search term, received status, and selected month
  const filteredIncomes = incomes.filter(income => {
    const incomeDate = new Date(income.date);
    const matchesSearch = income.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         income.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesReceivedFilter = filterReceived === null || income.isReceived === filterReceived;

    const matchesMonth = incomeDate.getMonth() === selectedDate.getMonth() &&
                        incomeDate.getFullYear() === selectedDate.getFullYear();

    return matchesSearch && matchesReceivedFilter && matchesMonth;
  }).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleEditClick = (income: Income) => {
    setEditingIncome(income);
    setIsAddingIncome(true);
  };

  const handleFormComplete = () => {
    setIsAddingIncome(false);
    setEditingIncome(null);
  };

  const handleDeleteClick = (income: Income) => {
    if (income.isRecurring) {
      setIncomeToDelete(income);
      return;
    }
    void deleteIncome(income.id);
  };

  const handleConfirmDelete = async (scope: RecurringDeleteScope) => {
    if (!incomeToDelete) return;

    try {
      setIsDeleting(true);
      await deleteIncome(incomeToDelete.id, { deleteScope: scope });
      setIncomeToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir receita:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const formatMonthYear = (year: number, month: number) => {
    return `${monthNames[month - 1]} ${year}`;
  };

  const showPreviousRow = bringPreviousIncomes && previousIncomes.total > 0;
  const hasRows = filteredIncomes.length > 0 || showPreviousRow;

  const renderActions = (income: Income) => (
    <div className="flex justify-center gap-2">
      {!income.isReceived && (
        <button
          onClick={() => handleEditClick(income)}
          className="fc-icon-btn bg-mint-soft text-mint hover:bg-mint hover:text-white"
          title="Editar receita"
        >
          <Edit size={16} />
        </button>
      )}
      <button
        onClick={() => toggleIncomeReceived(income.id)}
        className={`fc-icon-btn ${
          income.isReceived
            ? 'bg-mist text-ink/45 hover:bg-mist-line hover:text-ink'
            : 'bg-income-soft text-income hover:bg-income hover:text-white'
        }`}
        title={income.isReceived ? 'Marcar como não recebida' : 'Marcar como recebida'}
      >
        <Check size={16} />
      </button>
      {!income.isReceived && (
        <button
          onClick={() => handleDeleteClick(income)}
          className="fc-icon-btn bg-expense-soft text-expense hover:bg-expense hover:text-white"
          title="Excluir receita"
        >
          <Trash size={16} />
        </button>
      )}
    </div>
  );

  return (
    <div className="fc-page">
      {incomeToDelete && (
        <RecurringDeleteScopeModal
          type="income"
          description={incomeToDelete.description}
          isSubmitting={isDeleting}
          onSelect={handleConfirmDelete}
          onCancel={() => !isDeleting && setIncomeToDelete(null)}
        />
      )}

      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">Receitas</h2>
          <p className="fc-subtitle">
            Acompanhe recebimentos de {formatMonthYear(selectedYear, selectedMonth)}
          </p>
        </div>

        <button
          className="fc-btn-income"
          onClick={() => {
            setEditingIncome(null);
            setIsAddingIncome(true);
          }}
        >
          <Plus size={18} />
          <span>Adicionar Receita</span>
        </button>
      </div>

      <div className="fc-card mb-6 p-4 sm:p-5">
        <div className="fc-toolbar">
          <div className="w-full sm:w-64">
            <label htmlFor="income-search" className="fc-label">Buscar</label>
            <input
              id="income-search"
              type="text"
              placeholder="Buscar receita..."
              className="fc-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <div className="w-full sm:w-28">
              <label htmlFor="income-year" className="fc-label">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="text-ink/40" />
                  Ano
                </span>
              </label>
              <select
                id="income-year"
                className="fc-input"
                value={selectedYear}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value);
                  setSelectedYear(newYear);

                  // Check if current month exists in new year, otherwise set to first available month
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
            </div>

            <div className="w-full sm:w-40">
              <label htmlFor="income-month" className="fc-label">Mês</label>
              <select
                id="income-month"
                className="fc-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {availableMonthsForYear.length > 0 ? availableMonthsForYear.map((month) => (
                  <option key={month} value={month}>
                    {monthNames[month - 1]}
                  </option>
                )) : (
                  <option value={currentMonth}>{monthNames[currentMonth - 1]}</option>
                )}
              </select>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <div className="fc-label inline-flex items-center gap-1.5">
              <Filter size={14} className="text-ink/40" />
              Status
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={filterReceived === null ? 'fc-chip fc-chip-active' : 'fc-chip fc-chip-idle'}
                onClick={() => setFilterReceived(null)}
              >
                Todas
              </button>
              <button
                type="button"
                className={
                  filterReceived === true
                    ? 'fc-chip border-income bg-income text-white'
                    : 'fc-chip fc-chip-idle'
                }
                onClick={() => setFilterReceived(true)}
              >
                Recebidas
              </button>
              <button
                type="button"
                className={
                  filterReceived === false
                    ? 'fc-chip border-expense bg-expense text-white'
                    : 'fc-chip fc-chip-idle'
                }
                onClick={() => setFilterReceived(false)}
              >
                Não Recebidas
              </button>
            </div>
          </div>

          <ToggleSwitch
            checked={bringPreviousIncomes}
            onChange={(checked) => setBringPreviousIncomes(selectedDate, checked)}
            label="Trazer receitas anteriores"
            className="self-end"
          />
        </div>
      </div>

      {isAddingIncome && (
        <div className="fc-form-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">
              {editingIncome ? 'Editar Receita' : 'Nova Receita'}
            </h3>
            <button
              onClick={handleFormComplete}
              className="fc-icon-btn text-ink/45 hover:bg-mist hover:text-ink"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          <AddIncomeForm
            onComplete={handleFormComplete}
            income={editingIncome || undefined}
          />
        </div>
      )}

      {hasRows ? (
        <>
          {/* Mobile cards */}
          <div className="fc-mobile-list">
            {showPreviousRow && (
              <div className="fc-card border-l-4 border-l-warn p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-ink">
                    Receitas anteriores não recebidas
                  </div>
                  <span className="fc-badge-warn">
                    {previousIncomes.count} lançamentos
                  </span>
                </div>
                <div className="mb-3 text-sm text-ink/55">Meses anteriores</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-semibold text-income">
                      {formatCurrency(previousIncomes.total)}
                    </div>
                    <span className="fc-badge-danger mt-1">Não Recebida</span>
                  </div>
                  <button
                    onClick={() => settlePreviousIncomes(selectedDate)}
                    className="fc-icon-btn bg-income-soft text-income hover:bg-income hover:text-white"
                    title="Dar baixa nas receitas anteriores"
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>
            )}

            {filteredIncomes.map((income) => (
              <div key={income.id} className="fc-card p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-ink flex flex-wrap items-center gap-2">
                      {income.description}
                      {income.isRecurring && (
                        <span className="fc-badge-info">
                          <RefreshCw size={12} />
                          {formatInstallment(income.recurringIndex, income.recurringCount) || 'Recorrente'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-ink/55">{income.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-semibold text-income">
                      {formatCurrency(income.amount)}
                    </div>
                    <span className={`mt-1 inline-flex ${income.isReceived ? 'fc-badge-success' : 'fc-badge-danger'}`}>
                      {income.isReceived ? 'Recebida' : 'Não Recebida'}
                    </span>
                  </div>
                </div>
                <div className="mb-3 flex items-center text-sm text-ink/55">
                  <Calendar size={14} className="mr-1.5 text-ink/35" />
                  {formatDate(income.date)}
                </div>
                {renderActions(income)}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="fc-desktop-table">
            <div className="fc-card overflow-hidden">
              <div className="fc-table-wrap">
                <table className="fc-table">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Categoria</th>
                      <th>Data</th>
                      <th>Valor</th>
                      <th>Status</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showPreviousRow && (
                      <tr className="!bg-warn-soft/40 hover:!bg-warn-soft/60">
                        <td>
                          <div className="flex flex-wrap items-center gap-2 font-medium text-ink">
                            Receitas anteriores não recebidas
                            <span className="fc-badge-warn">
                              {previousIncomes.count} lançamentos
                            </span>
                          </div>
                        </td>
                        <td className="text-warn">Meses anteriores</td>
                        <td className="text-warn">—</td>
                        <td>
                          <div className="font-medium text-income">
                            {formatCurrency(previousIncomes.total)}
                          </div>
                        </td>
                        <td>
                          <span className="fc-badge-danger">Não Recebida</span>
                        </td>
                        <td>
                          <div className="flex justify-center">
                            <button
                              onClick={() => settlePreviousIncomes(selectedDate)}
                              className="fc-icon-btn bg-income-soft text-income hover:bg-income hover:text-white"
                              title="Dar baixa nas receitas anteriores"
                            >
                              <Check size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    {filteredIncomes.map((income) => (
                      <tr key={income.id}>
                        <td>
                          <div className="flex flex-wrap items-center gap-2 font-medium text-ink">
                            {income.description}
                            {income.isRecurring && (
                              <span className="fc-badge-info">
                                <RefreshCw size={12} />
                                {formatInstallment(income.recurringIndex, income.recurringCount) || 'Recorrente'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{income.category}</td>
                        <td>
                          <div className="flex items-center text-ink/70">
                            <Calendar size={14} className="mr-1 text-ink/35" />
                            {formatDate(income.date)}
                          </div>
                        </td>
                        <td>
                          <div className="font-medium text-income">
                            {formatCurrency(income.amount)}
                          </div>
                        </td>
                        <td>
                          <span className={income.isReceived ? 'fc-badge-success' : 'fc-badge-danger'}>
                            {income.isReceived ? 'Recebida' : 'Não Recebida'}
                          </span>
                        </td>
                        <td>
                          {renderActions(income)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="fc-empty">
          <p className="mb-4 text-ink/55">Nenhuma receita encontrada</p>
          <button
            className="fc-btn-income"
            onClick={() => setIsAddingIncome(true)}
          >
            <Plus size={18} />
            <span>Adicionar Receita</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default IncomeList;
