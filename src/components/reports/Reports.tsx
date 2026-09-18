import React, { useState, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getMonth, getYear } from 'date-fns';
import { formatCurrency } from '../../utils/formatters';
import { useTranslation } from '../../i18n/LanguageProvider';

const Reports: React.FC = () => {
  const { t, months, translateCategory, dateLocale } = useTranslation();
  const { expenses, incomes } = useFinance();

  const dataByMonth = useMemo(() => {
    const monthlyMap: Record<string, { income: number; expense: number }> = {};

    expenses.forEach((e) => {
      const date = new Date(e.date);
      const key = `${getYear(date)}-${getMonth(date)}`;
      if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 };
      monthlyMap[key].expense += e.amount;
    });

    incomes.forEach((i) => {
      const date = new Date(i.date);
      const key = `${getYear(date)}-${getMonth(date)}`;
      if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 };
      monthlyMap[key].income += i.amount;
    });

    return Object.entries(monthlyMap).map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        name: months[month],
        ...value,
        year,
        month: month + 1
      };
    }).sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }, [expenses, incomes, months]);

  const availableYears = useMemo(() => {
    const allYears = new Set([
      ...expenses.map(e => getYear(new Date(e.date))),
      ...incomes.map(i => getYear(new Date(i.date)))
    ]);
    return Array.from(allYears).sort();
  }, [expenses, incomes]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const filteredData = dataByMonth.filter(item => item.year === selectedYear);

  const balance = useMemo(() => {
    const income = incomes
      .filter(i => getMonth(new Date(i.date)) + 1 === selectedMonth && getYear(new Date(i.date)) === selectedYear)
      .reduce((acc, i) => acc + i.amount, 0);

    const expense = expenses
      .filter(e => getMonth(new Date(e.date)) + 1 === selectedMonth && getYear(new Date(e.date)) === selectedYear)
      .reduce((acc, e) => acc + e.amount, 0);

    return { income, expense, balance: income - expense };
  }, [selectedMonth, selectedYear, expenses, incomes]);

  const receitasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    incomes
      .filter(i => getMonth(new Date(i.date)) + 1 === selectedMonth && getYear(new Date(i.date)) === selectedYear)
      .forEach(i => {
        map[i.category] = (map[i.category] || 0) + i.amount;
      });
    return Object.entries(map).map(([categoria, valor]) => ({ categoria, valor }));
  }, [selectedMonth, selectedYear, incomes]);

  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    expenses
      .filter(e => getMonth(new Date(e.date)) + 1 === selectedMonth && getYear(new Date(e.date)) === selectedYear)
      .forEach(e => {
        map[e.category] = (map[e.category] || 0) + e.amount;
      });
    return Object.entries(map).map(([categoria, valor]) => ({ categoria, valor }));
  }, [selectedMonth, selectedYear, expenses]);

  return (
    <div className="fc-page">
      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('reports.chartTitle')}</h2>
          <p className="fc-subtitle">{t('reports.chartSubtitle')}</p>
        </div>

        <div className="fc-toolbar">
          <div className="w-full sm:w-40">
            <label htmlFor="reports-year" className="fc-label">{t('common.year')}</label>
            <select
              id="reports-year"
              className="fc-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="fc-card mb-8 p-4 sm:p-6">
        <div className="h-[260px] w-full sm:h-[300px] lg:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D7E2DC" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#1F433C', fontSize: 12 }}
                axisLine={{ stroke: '#D7E2DC' }}
                tickLine={{ stroke: '#D7E2DC' }}
              />
              <YAxis
                tick={{ fill: '#1F433C', fontSize: 12 }}
                axisLine={{ stroke: '#D7E2DC' }}
                tickLine={{ stroke: '#D7E2DC' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #D7E2DC',
                  borderRadius: '12px',
                  color: '#0B1F1C',
                  boxShadow: '0 1px 2px rgba(11, 31, 28, 0.04), 0 12px 32px rgba(11, 31, 28, 0.06)',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#059669" strokeWidth={2.5} name={t('reports.incomeSeries')} dot={{ r: 3, fill: '#059669' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="expense" stroke="#E11D48" strokeWidth={2.5} name={t('reports.expenseSeries')} dot={{ r: 3, fill: '#E11D48' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="fc-page-header">
        <div>
          <h2 className="fc-title">{t('reports.balanceTitle')}</h2>
          <p className="fc-subtitle">{t('reports.balanceSubtitle')}</p>
        </div>

        <div className="fc-toolbar">
          <div className="w-full sm:w-48">
            <label htmlFor="reports-month" className="fc-label">{t('common.month')}</label>
            <select
              id="reports-month"
              className="fc-input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map((nome, idx) => (
                <option key={idx} value={idx + 1}>{nome}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="fc-card mx-auto max-w-3xl p-5 sm:p-6">
        <h3 className="mb-5 text-center font-display text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {t('reports.balanceHeading', { month: months[selectedMonth - 1], year: selectedYear })}
        </h3>

        <div className="grid grid-cols-1 gap-6 border-y border-mist-line py-5 sm:grid-cols-2 sm:gap-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="fc-badge-success">{t('reports.asset')}</span>
            </div>
            <div className="space-y-2">
              {receitasPorCategoria.map((item) => (
                <div key={item.categoria} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-ink/70">{translateCategory(item.categoria)}</span>
                  <span className="shrink-0 font-medium text-income">
                    {formatCurrency(item.valor, dateLocale)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-mist-line pt-3 text-sm font-bold text-income">
              {t('common.totalColon')} {formatCurrency(balance.income, dateLocale)}
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="fc-badge-danger">{t('reports.liability')}</span>
            </div>
            <div className="space-y-2">
              {despesasPorCategoria.map((item) => (
                <div key={item.categoria} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-ink/70">{translateCategory(item.categoria)}</span>
                  <span className="shrink-0 font-medium text-expense">
                    {formatCurrency(item.valor, dateLocale)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-mist-line pt-3 text-sm font-bold text-expense">
              {t('common.totalColon')} {formatCurrency(balance.expense, dateLocale)}
            </p>
          </div>
        </div>

        <div className="mt-2 border-t border-mist-line pt-4 text-right">
          <p className="text-sm font-medium text-ink/60">{t('reports.netResult')}</p>
          <p className={`mt-1 font-display text-2xl font-bold tracking-tight ${balance.balance >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(balance.balance, dateLocale)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
