import React from 'react';
import { ExpensesByCategory } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { useTranslation } from '../../i18n/LanguageProvider';

interface CategoryChartProps {
  data: ExpensesByCategory[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: '#E11D48',
  Moradia: '#0F766E',
  Transporte: '#EA580C',
  Entretenimento: '#0D9488',
  Utilidades: '#059669',
  Saúde: '#BE123C',
  Educação: '#B45309',
  Compras: '#0891B2',
  Viagem: '#14B8A6',
  Assinaturas: '#65A30D',
  Seguros: '#1F433C',
  Outros: '#64748B',
};

const FALLBACK_PALETTE = [
  '#0F766E',
  '#059669',
  '#0D9488',
  '#0891B2',
  '#14B8A6',
  '#B45309',
  '#EA580C',
  '#E11D48',
  '#BE123C',
  '#65A30D',
  '#4D7C0F',
  '#155E75',
];

const hashCategory = (category: string): number => {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getCategoryColor = (category: string): string => {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  return FALLBACK_PALETTE[hashCategory(category) % FALLBACK_PALETTE.length];
};

const CategoryChart: React.FC<CategoryChartProps> = ({ data }) => {
  const { t, translateCategory, dateLocale } = useTranslation();

  if (!data || data.length === 0) {
    return (
      <div className="fc-empty h-full min-h-[200px] py-10">
        <p className="text-sm text-ink/55">{t('dashboard.noExpensesRecorded')}</p>
      </div>
    );
  }

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const sortedData = [...data].sort((a, b) => b.amount - a.amount);
  const maxAmount = sortedData[0]?.amount || 1;

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-end justify-between gap-3 rounded-2xl bg-gradient-to-br from-mist/80 to-white px-4 py-3 ring-1 ring-mist-line/60">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/40">
            {t('common.total')}
          </p>
          <p className="font-display text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(totalAmount, dateLocale)}
          </p>
        </div>
        <p className="pb-1 text-xs text-ink/45">
          {t('dashboard.categoryCount', { count: sortedData.length })}
        </p>
      </div>

      <ul className="flex max-h-[320px] flex-col gap-3.5 overflow-y-auto pr-1">
        {sortedData.map((item, index) => {
          const pct = totalAmount > 0 ? (item.amount / totalAmount) * 100 : 0;
          const widthPct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
          const color = getCategoryColor(item.category);

          return (
            <li key={`${item.category}-${index}`} className="group">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate text-sm font-medium text-ink/85">
                    {translateCategory(item.category)}
                  </span>
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {formatCurrency(item.amount, dateLocale)}
                  </span>
                  <span className="min-w-[2.5rem] text-right text-xs font-medium tabular-nums text-ink/40">
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>

              <div className="relative h-3 overflow-hidden rounded-full bg-mist/70 ring-1 ring-mist-line/50">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(widthPct, 2)}%`,
                    background: `linear-gradient(90deg, ${color}cc 0%, ${color} 55%, ${color}ee 100%)`,
                    boxShadow: `0 0 12px ${color}33`,
                  }}
                  title={`${translateCategory(item.category)}: ${formatCurrency(item.amount, dateLocale)} (${Math.round(pct)}%)`}
                >
                  <span className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CategoryChart;
