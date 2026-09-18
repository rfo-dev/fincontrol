import React from 'react';
import { ExpensesByCategory } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface CategoryChartProps {
  data: ExpensesByCategory[];
}

// Cores estáveis alinhadas à paleta teal/ink (sem roxo)
const CATEGORY_COLORS: Record<string, string> = {
  "Alimentação": "#E11D48",
  "Moradia": "#0F766E",
  "Transporte": "#EA580C",
  "Entretenimento": "#0D9488",
  "Utilidades": "#059669",
  "Saúde": "#BE123C",
  "Educação": "#B45309",
  "Compras": "#0891B2",
  "Viagem": "#14B8A6",
  "Assinaturas": "#65A30D",
  "Seguros": "#1F433C",
  "Outros": "#64748B",
};

const FALLBACK_PALETTE = [
  "#0F766E",
  "#059669",
  "#0D9488",
  "#0891B2",
  "#14B8A6",
  "#B45309",
  "#EA580C",
  "#E11D48",
  "#BE123C",
  "#65A30D",
  "#4D7C0F",
  "#155E75",
  "#14302B",
  "#1F433C",
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
  if (CATEGORY_COLORS[category]) {
    return CATEGORY_COLORS[category];
  }

  return FALLBACK_PALETTE[hashCategory(category) % FALLBACK_PALETTE.length];
};

const CategoryChart: React.FC<CategoryChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="fc-empty h-full min-h-[200px] py-10">
        <p className="text-sm text-ink/55">Nenhuma despesa registrada</p>
      </div>
    );
  }

  // Calcula valor total
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  
  // Ordena dados por valor (decrescente)
  const sortedData = [...data].sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex h-full flex-col gap-6 md:flex-row md:items-center md:gap-8">
      {/* Visualização do gráfico */}
      <div className="relative w-full md:w-1/2">
        <div className="relative mx-auto h-48 w-48 sm:h-52 sm:w-52">
          <svg className="h-full w-full drop-shadow-sm" viewBox="0 0 100 100">
            {renderPieChart(sortedData, totalAmount)}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full">
            <span className="text-xs font-medium uppercase tracking-wider text-ink/45">Total</span>
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Legenda */}
      <div className="flex w-full flex-col justify-center md:w-1/2 md:mt-0">
        <ul className="max-h-[250px] space-y-2.5 overflow-y-auto pr-1">
          {sortedData.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 rounded-xl border border-mist-line/70 bg-mist/40 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div 
                  className="h-3 w-3 shrink-0 rounded-md" 
                  style={{ backgroundColor: getCategoryColor(item.category) }}
                ></div>
                <span className="truncate text-sm text-ink/80">
                  {item.category}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-sm font-semibold text-ink">{formatCurrency(item.amount)}</span>
                <span className="text-xs text-ink/45">
                  {Math.round((item.amount / totalAmount) * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Função auxiliar para renderizar segmentos do gráfico
const renderPieChart = (data: ExpensesByCategory[], totalAmount: number) => {
  let currentAngle = 0;
  
  return data.map((item, index) => {
    const percentage = (item.amount / totalAmount);
    const degrees = percentage * 360;
    
    // Calcula coordenadas do arco SVG
    const startAngle = currentAngle;
    const endAngle = currentAngle + degrees;
    currentAngle = endAngle;
    
    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
    
    // Cria o caminho do arco
    const largeArcFlag = degrees > 180 ? 1 : 0;
    const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
    
    return (
      <path 
        key={index}
        d={pathData}
        fill={getCategoryColor(item.category)}
        stroke="#fff"
        strokeWidth="1"
      >
        <title>{item.category}: {formatCurrency(item.amount)} ({Math.round(percentage * 100)}%)</title>
      </path>
    );
  });
};

export default CategoryChart;
