/**
 * Formata um número como moeda conforme o idioma da UI.
 * pt-BR → BRL (R$); en → USD ($).
 */
export const formatCurrency = (
  amount: number,
  locale: string = 'pt-BR'
): string => {
  const isEn = locale.toLowerCase().startsWith('en');
  return new Intl.NumberFormat(isEn ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: isEn ? 'USD' : 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

type CalendarParts = { year: number; month: number; day: number };

/**
 * Extrai ano/mês/dia de uma data de calendário sem aplicar fuso horário.
 * Aceita "YYYY-MM-DD", ISO ("...T00:00:00.000Z") ou Date.
 */
export function getCalendarParts(value: Date | string): CalendarParts {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
  }

  // Datas vindas de colunas DATE (meia-noite UTC) devem usar componentes UTC
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUtcMidnight) {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/** Converte valor de <input type="date"> (YYYY-MM-DD) em Date local ao meio-dia */
export function parseDateInput(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date();
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );
}

/** Normaliza qualquer data da API/formulário para Date local (meio-dia) */
export function toLocalCalendarDate(value: Date | string): Date {
  const { year, month, day } = getCalendarParts(value);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Valor para <input type="date"> */
export function toDateInputValue(value: Date | string = new Date()): string {
  const { year, month, day } = getCalendarParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Formata data para exibição (dd/mm/aaaa ou locale) sem deslocar o dia */
export function formatDate(
  value: Date | string,
  locale: string = 'pt-BR'
): string {
  const { year, month, day } = getCalendarParts(value);
  if (locale.startsWith('en')) {
    return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
  }
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** Serializa para a API como YYYY-MM-DD */
export function toApiDate(value: Date | string): string {
  return toDateInputValue(value);
}

/** Formata parcela recorrente, ex: "2 de 5" / "2 of 5" */
export function formatInstallment(
  index?: number | null,
  count?: number | null,
  template: string = '{{index}} de {{count}}'
): string | null {
  if (!index || !count || count < 1 || index < 1) return null;
  return template
    .replace('{{index}}', String(index))
    .replace('{{count}}', String(count));
}
