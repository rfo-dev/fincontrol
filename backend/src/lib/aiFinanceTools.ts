import { prisma } from './prisma.js';
import { findOrCreateCategory } from '../services/categories.js';
import { toNumber } from './mappers.js';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from './defaultCategories.js';

function normalizeCategoryKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveAllowedCategory(
  rawName: string,
  allowed: readonly string[]
): string {
  const input = String(rawName || '').trim();
  if (!input) {
    throw new Error(
      `Categoria obrigatória. Use exatamente uma destas: ${allowed.join(', ')}`
    );
  }

  const exact = allowed.find((name) => normalizeCategoryKey(name) === normalizeCategoryKey(input));
  if (exact) return exact;

  throw new Error(
    `Categoria "${input}" não existe no sistema. Use exatamente uma destas: ${allowed.join(', ')}`
  );
}

export const FINANCE_TOOLS = [
  {
    name: 'get_account_summary',
    description:
      'Retorna totais de receitas, despesas e saldo do usuário para um mês/ano. Use para perguntas sobre totais e resumo.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Ano (ex: 2026)' },
        month: { type: 'number', description: 'Mês 1-12' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'list_categories',
    description:
      'Lista as categorias oficiais de despesa e receita. SEMPRE use esta lista ao sugerir ou cadastrar. Não invente categorias.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['expense', 'income', 'all'],
          description: 'Filtrar por tipo. Padrão: all',
        },
      },
    },
  },
  {
    name: 'list_incomes',
    description: 'Lista receitas do usuário em um mês/ano.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number' },
        month: { type: 'number', description: 'Mês 1-12' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'list_expenses',
    description: 'Lista despesas do usuário em um mês/ano.',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number' },
        month: { type: 'number', description: 'Mês 1-12' },
      },
      required: ['year', 'month'],
    },
  },
  {
    name: 'list_credit_cards',
    description:
      'Lista cartões de crédito do usuário (nome, final/lastFour, limite, vencimento). Use para associar compras pelo final do cartão no comprovante.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_income',
    description:
      'Cria uma nova receita. categoryName DEVE ser uma categoria oficial de receita. Só confirme sucesso se a ferramenta retornar registered=true com id.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        amount: { type: 'number' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        categoryName: {
          type: 'string',
          enum: [...DEFAULT_INCOME_CATEGORIES],
          description: 'Categoria oficial de receita',
        },
        isReceived: { type: 'boolean' },
      },
      required: ['description', 'amount', 'date', 'categoryName'],
    },
  },
  {
    name: 'create_expense',
    description:
      'Cria uma nova despesa. categoryName DEVE ser uma categoria oficial de despesa (enum). Para cartão use creditCardLastFour ou creditCardName. Só use após confirmação do usuário. Só diga que cadastrou se retornar registered=true com id.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        amount: { type: 'number' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        categoryName: {
          type: 'string',
          enum: [...DEFAULT_EXPENSE_CATEGORIES],
          description: 'Categoria oficial de despesa',
        },
        isPaid: { type: 'boolean' },
        creditCardName: { type: 'string', description: 'Nome do cartão, se houver' },
        creditCardLastFour: {
          type: 'string',
          description: 'Últimos 4 dígitos do cartão no comprovante',
        },
      },
      required: ['description', 'amount', 'date', 'categoryName'],
    },
  },
  {
    name: 'mark_income_received',
    description: 'Marca uma receita como recebida ou não recebida pelo id.',
    parameters: {
      type: 'object',
      properties: {
        incomeId: { type: 'string' },
        isReceived: { type: 'boolean' },
      },
      required: ['incomeId', 'isReceived'],
    },
  },
  {
    name: 'mark_expense_paid',
    description: 'Marca uma despesa como paga ou não paga pelo id.',
    parameters: {
      type: 'object',
      properties: {
        expenseId: { type: 'string' },
        isPaid: { type: 'boolean' },
      },
      required: ['expenseId', 'isPaid'],
    },
  },
] as const;

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return NaN;

  // 3.721,46 (pt-BR) or 3,721.46 (en)
  if (raw.includes(',') && raw.includes('.')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      return Number(raw.replace(/\./g, '').replace(',', '.'));
    }
    return Number(raw.replace(/,/g, ''));
  }
  if (raw.includes(',')) return Number(raw.replace(',', '.'));
  return Number(raw);
}

function parseDateOnly(value: string): Date {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
  }

  throw new Error('Data inválida. Use YYYY-MM-DD ou DD/MM/YYYY.');
}

export async function runFinanceTool(
  userId: string,
  name: string,
  rawArgs: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'get_account_summary': {
      const year = Number(rawArgs.year);
      const month = Number(rawArgs.month);
      const { start, end } = monthRange(year, month);

      const [incomes, expenses] = await Promise.all([
        prisma.income.findMany({
          where: { userId, date: { gte: start, lt: end } },
        }),
        prisma.expense.findMany({
          where: { userId, date: { gte: start, lt: end } },
        }),
      ]);

      const incomeTotal = incomes.reduce((s, i) => s + toNumber(i.amount), 0);
      const incomeReceived = incomes
        .filter((i) => i.isReceived)
        .reduce((s, i) => s + toNumber(i.amount), 0);
      const expenseTotal = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
      const expensePaid = expenses
        .filter((e) => e.isPaid)
        .reduce((s, e) => s + toNumber(e.amount), 0);

      return {
        year,
        month,
        incomeTotal,
        incomeReceived,
        expenseTotal,
        expensePaid,
        balance: incomeTotal - expenseTotal,
      };
    }

    case 'list_categories': {
      const type = String(rawArgs.type || 'all');
      return {
        expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
        incomeCategories: [...DEFAULT_INCOME_CATEGORIES],
        note:
          type === 'expense'
            ? 'Use apenas expenseCategories'
            : type === 'income'
              ? 'Use apenas incomeCategories'
              : 'Use a lista correspondente ao tipo de lançamento',
        ...(type === 'expense'
          ? { categories: [...DEFAULT_EXPENSE_CATEGORIES] }
          : type === 'income'
            ? { categories: [...DEFAULT_INCOME_CATEGORIES] }
            : {}),
      };
    }

    case 'list_incomes': {
      const year = Number(rawArgs.year);
      const month = Number(rawArgs.month);
      const { start, end } = monthRange(year, month);
      const rows = await prisma.income.findMany({
        where: { userId, date: { gte: start, lt: end } },
        include: { category: true },
        orderBy: { date: 'asc' },
      });
      return rows.map((r) => ({
        id: r.id,
        description: r.description,
        amount: toNumber(r.amount),
        date: r.date.toISOString().slice(0, 10),
        category: r.category?.name || 'Outros',
        isReceived: r.isReceived,
        isRecurring: r.isRecurring,
        installment:
          r.recurringIndex && r.recurringCount
            ? `${r.recurringIndex} de ${r.recurringCount}`
            : null,
      }));
    }

    case 'list_expenses': {
      const year = Number(rawArgs.year);
      const month = Number(rawArgs.month);
      const { start, end } = monthRange(year, month);
      const rows = await prisma.expense.findMany({
        where: { userId, date: { gte: start, lt: end } },
        include: { category: true, creditCard: true },
        orderBy: { date: 'asc' },
      });
      return rows.map((r) => ({
        id: r.id,
        description: r.description,
        amount: toNumber(r.amount),
        date: r.date.toISOString().slice(0, 10),
        category: r.category?.name || 'Outros',
        isPaid: r.isPaid,
        creditCard: r.creditCard?.name || null,
        isRecurring: r.isRecurring,
        installment:
          r.recurringIndex && r.recurringCount
            ? `${r.recurringIndex} de ${r.recurringCount}`
            : null,
      }));
    }

    case 'list_credit_cards': {
      const rows = await prisma.creditCard.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        lastFour: r.lastFour,
        dueDay: r.dueDay,
        closingDay: r.closingDay,
        creditLimit: toNumber(r.creditLimit),
      }));
    }

    case 'create_income': {
      const description = String(rawArgs.description || '').trim();
      const amount = parseAmount(rawArgs.amount);
      const date = parseDateOnly(String(rawArgs.date));
      const categoryName = resolveAllowedCategory(
        String(rawArgs.categoryName || ''),
        DEFAULT_INCOME_CATEGORIES
      );
      const isReceived = Boolean(rawArgs.isReceived);

      if (!description || !(amount > 0)) {
        throw new Error('Descrição e valor positivo são obrigatórios.');
      }

      const category = await findOrCreateCategory(userId, categoryName, 'income');
      const row = await prisma.income.create({
        data: {
          description,
          amount,
          date,
          categoryId: category.id,
          userId,
          isReceived,
          isRecurring: false,
        },
        include: { category: true },
      });

      return {
        registered: true,
        id: row.id,
        description: row.description,
        amount: toNumber(row.amount),
        date: row.date.toISOString().slice(0, 10),
        category: row.category?.name || categoryName,
        isReceived: row.isReceived,
      };
    }

    case 'create_expense': {
      const description = String(rawArgs.description || '').trim();
      const amount = parseAmount(rawArgs.amount);
      const date = parseDateOnly(String(rawArgs.date));
      const categoryName = resolveAllowedCategory(
        String(rawArgs.categoryName || ''),
        DEFAULT_EXPENSE_CATEGORIES
      );
      const isPaid = Boolean(rawArgs.isPaid);
      const creditCardName = rawArgs.creditCardName
        ? String(rawArgs.creditCardName).trim()
        : null;
      const creditCardLastFour = rawArgs.creditCardLastFour
        ? String(rawArgs.creditCardLastFour).replace(/\D/g, '').slice(-4)
        : null;

      if (!description || !(amount > 0)) {
        throw new Error('Descrição e valor positivo são obrigatórios.');
      }

      let creditCardId: string | null = null;
      let matchedCardName: string | null = null;

      if (creditCardLastFour && creditCardLastFour.length === 4) {
        const card = await prisma.creditCard.findFirst({
          where: { userId, lastFour: creditCardLastFour },
        });
        if (!card) {
          throw new Error(
            `Nenhum cartão com final ${creditCardLastFour} encontrado. Liste os cartões e peça confirmação ao usuário.`
          );
        }
        creditCardId = card.id;
        matchedCardName = card.name;
      } else if (creditCardName) {
        const card = await prisma.creditCard.findFirst({
          where: {
            userId,
            name: { equals: creditCardName, mode: 'insensitive' },
          },
        });
        if (!card) throw new Error(`Cartão "${creditCardName}" não encontrado.`);
        creditCardId = card.id;
        matchedCardName = card.name;
      }

      const category = await findOrCreateCategory(userId, categoryName, 'expense');
      const row = await prisma.expense.create({
        data: {
          description,
          amount,
          date,
          categoryId: category.id,
          userId,
          isPaid,
          isRecurring: false,
          creditCardId,
        },
        include: { category: true, creditCard: true },
      });

      return {
        registered: true,
        id: row.id,
        description: row.description,
        amount: toNumber(row.amount),
        date: row.date.toISOString().slice(0, 10),
        category: row.category?.name || categoryName,
        isPaid: row.isPaid,
        creditCard: row.creditCard?.name || matchedCardName,
        creditCardLastFour: row.creditCard?.lastFour || creditCardLastFour,
      };
    }

    case 'mark_income_received': {
      const incomeId = String(rawArgs.incomeId);
      const isReceived = Boolean(rawArgs.isReceived);
      const existing = await prisma.income.findFirst({
        where: { id: incomeId, userId },
      });
      if (!existing) throw new Error('Receita não encontrada.');
      const row = await prisma.income.update({
        where: { id: existing.id },
        data: { isReceived },
      });
      return {
        id: row.id,
        description: row.description,
        isReceived: row.isReceived,
      };
    }

    case 'mark_expense_paid': {
      const expenseId = String(rawArgs.expenseId);
      const isPaid = Boolean(rawArgs.isPaid);
      const existing = await prisma.expense.findFirst({
        where: { id: expenseId, userId },
      });
      if (!existing) throw new Error('Despesa não encontrada.');
      const row = await prisma.expense.update({
        where: { id: existing.id },
        data: { isPaid },
      });
      return {
        id: row.id,
        description: row.description,
        isPaid: row.isPaid,
      };
    }

    default:
      throw new Error(`Ferramenta não permitida: ${name}`);
  }
}

export const HARD_SYSTEM_GUARDRAILS = `Você é o assistente financeiro do FinControl.
REGRAS OBRIGATÓRIAS:
1. Responda APENAS sobre as contas financeiras do usuário autenticado (receitas, despesas, cartões, totais, status pago/recebido).
2. NÃO busque informações na internet. NÃO invente dados externos.
3. NÃO responda assuntos fora das finanças pessoais do usuário (política, clima, programação geral, notícias, etc.). Se perguntarem algo fora do escopo, recuse educadamente e ofereça ajuda sobre as contas.
4. Use somente as ferramentas disponíveis para consultar ou alterar dados.
5. Nunca peça ou revele chaves de API, senhas ou dados de outros usuários.
6. Datas no formato YYYY-MM-DD nas ferramentas. Na resposta ao usuário, use DD/MM/YYYY. Valores em reais (R$ 1.234,56).
7. Formatação das respostas (chat estreito — obrigatório):
   - NUNCA use tabelas Markdown (| colunas |).
   - NUNCA junte vários itens na mesma linha.
   - Use quebras de linha reais entre título, cada item e o total.
   - Para listar lançamentos, use este padrão (um item por bloco):
     • **Descrição** — R$ X,XX
       Data · Categoria · Status
   - Destaque o total em linha própria com **Total: R$ X,XX**.
   - Seja conciso, em português, sem emojis excessivos.
8. Categorias (obrigatório):
   - Categorias de despesa permitidas: Alimentação, Moradia, Transporte, Entretenimento, Utilidades, Saúde, Educação, Compras, Viagem, Assinaturas, Seguros, Outros.
   - Categorias de receita permitidas: Salário, Freelance, Investimentos, Aluguel, Presentes, Reembolsos, Negócios, Outros.
   - NUNCA invente categorias (ex.: "Pagamento de Dívida", "Financeiro", "Contas e Serviços").
   - Ao perguntar categoria, ofereça APENAS opções da lista oficial (chame list_categories se precisar).
   - Se o usuário pedir uma categoria inexistente, diga que ela não existe e peça para escolher uma da lista.
9. Cadastro / confirmação (anti-alucinação):
   - NUNCA diga que cadastrou, criou ou atualizou algo sem ter chamado a ferramenta correspondente e recebido registered=true (ou id) no resultado.
   - Se a ferramenta retornar error, informe o erro e NÃO diga que cadastrou.
   - Só chame create_expense/create_income após o usuário confirmar os dados.
10. Comprovantes / cupons / faturas anexados (imagem ou PDF):
   - Leia o anexo e extraia: estabelecimento/descrição, valor total, data, final do cartão (4 dígitos), parcelas se houver.
   - Chame list_credit_cards para tentar associar pelo lastFour.
   - Mostre um resumo e pergunte o que faltar, incluindo categoria da lista oficial.
   - Ao cadastrar no cartão, use creditCardLastFour (ou creditCardName).
   - Se o final do cartão não existir, peça outro cartão ou cadastro sem cartão.
   - Compra à vista / débito / dinheiro: cadastre sem cartão, isPaid conforme o caso.`;
