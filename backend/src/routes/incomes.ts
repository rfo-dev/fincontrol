import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { mapIncome } from '../lib/mappers.js';
import { parseDateOnly } from '../lib/dates.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { findOrCreateCategory } from '../services/categories.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().or(z.date()),
  categoryName: z.string().min(1),
  isReceived: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.enum(['weekly', 'monthly', 'yearly']).optional().nullable(),
  recurringCount: z.number().int().positive().optional().nullable(),
  recurringIndex: z.number().int().positive().optional().nullable(),
});

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().or(z.date()).optional(),
  categoryName: z.string().min(1).optional(),
  isReceived: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.enum(['weekly', 'monthly', 'yearly']).optional().nullable(),
  recurringCount: z.number().int().positive().optional().nullable(),
  recurringIndex: z.number().int().positive().optional().nullable(),
  editScope: z.enum(['single', 'series']).optional().default('single'),
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.income.findMany({
      where: { userId: req.user!.id },
      include: { category: true },
      orderBy: { date: 'desc' },
    });
    return res.json(rows.map(mapIncome));
  } catch (error) {
    console.error('List incomes error:', error);
    return res.status(500).json({ error: 'Failed to list incomes' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid income payload' });
    }

    const {
      description,
      amount,
      date,
      categoryName,
      isReceived,
      isRecurring,
      recurringInterval,
      recurringCount,
      recurringIndex,
    } = parsed.data;
    const category = await findOrCreateCategory(req.user!.id, categoryName, 'income');

    const row = await prisma.income.create({
      data: {
        description,
        amount,
        date: parseDateOnly(date),
        categoryId: category.id,
        userId: req.user!.id,
        isReceived: isReceived ?? false,
        isRecurring: isRecurring ?? false,
        recurringInterval: recurringInterval ?? null,
        recurringCount: recurringCount ?? null,
        recurringIndex: recurringIndex ?? null,
      },
      include: { category: true },
    });

    return res.status(201).json(mapIncome(row));
  } catch (error) {
    console.error('Create income error:', error);
    return res.status(500).json({ error: 'Failed to create income' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid income payload' });
    }

    const existing = await prisma.income.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { category: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Income not found' });
    }

    const data: {
      description?: string;
      amount?: number;
      date?: Date;
      categoryId?: string;
      isReceived?: boolean;
      isRecurring?: boolean;
      recurringInterval?: string | null;
      recurringCount?: number | null;
      recurringIndex?: number | null;
    } = {};

    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
    if (parsed.data.date !== undefined) data.date = parseDateOnly(parsed.data.date);
    if (parsed.data.isReceived !== undefined) data.isReceived = parsed.data.isReceived;
    if (parsed.data.isRecurring !== undefined) data.isRecurring = parsed.data.isRecurring;
    if (parsed.data.recurringInterval !== undefined) {
      data.recurringInterval = parsed.data.recurringInterval;
    }
    if (parsed.data.recurringCount !== undefined) {
      data.recurringCount = parsed.data.recurringCount;
    }
    if (parsed.data.recurringIndex !== undefined) {
      data.recurringIndex = parsed.data.recurringIndex;
    }

    if (parsed.data.categoryName) {
      const category = await findOrCreateCategory(
        req.user!.id,
        parsed.data.categoryName,
        'income'
      );
      data.categoryId = category.id;
    }

    const row = await prisma.income.update({
      where: { id: existing.id },
      data,
      include: { category: true },
    });

    if (parsed.data.editScope === 'series' && existing.isRecurring) {
      const seriesData: {
        description?: string;
        amount?: number;
        categoryId?: string;
        isRecurring?: boolean;
        recurringInterval?: string | null;
        recurringCount?: number | null;
      } = {};

      if (data.description !== undefined) seriesData.description = data.description;
      if (data.amount !== undefined) seriesData.amount = data.amount;
      if (data.categoryId !== undefined) seriesData.categoryId = data.categoryId;
      if (data.isRecurring !== undefined) seriesData.isRecurring = data.isRecurring;
      if (data.recurringInterval !== undefined) {
        seriesData.recurringInterval = data.recurringInterval;
      }
      if (data.recurringCount !== undefined) seriesData.recurringCount = data.recurringCount;

      if (Object.keys(seriesData).length > 0) {
        await prisma.income.updateMany({
          where: {
            userId: req.user!.id,
            isRecurring: true,
            isReceived: false,
            description: existing.description,
            recurringInterval: existing.recurringInterval,
            id: { not: existing.id },
          },
          data: seriesData,
        });
      }
    }

    return res.json(mapIncome(row));
  } catch (error) {
    console.error('Update income error:', error);
    return res.status(500).json({ error: 'Failed to update income' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const scope = req.query.scope === 'series' ? 'series' : 'single';

    const existing = await prisma.income.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Income not found' });
    }

    if (scope === 'series' && existing.isRecurring) {
      await prisma.income.deleteMany({
        where: {
          userId: req.user!.id,
          isRecurring: true,
          isReceived: false,
          description: existing.description,
          recurringInterval: existing.recurringInterval,
        },
      });
    } else {
      await prisma.income.delete({ where: { id: existing.id } });
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Delete income error:', error);
    return res.status(500).json({ error: 'Failed to delete income' });
  }
});

const settlePreviousSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
});

router.post('/settle-previous', async (req: AuthRequest, res) => {
  try {
    const parsed = settlePreviousSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid settle-previous payload' });
    }

    const { year, month } = parsed.data;
    const monthStart = new Date(Date.UTC(year, month, 1));

    const result = await prisma.income.updateMany({
      where: {
        userId: req.user!.id,
        isReceived: false,
        date: { lt: monthStart },
      },
      data: { isReceived: true },
    });

    return res.json({ updated: result.count });
  } catch (error) {
    console.error('Settle previous incomes error:', error);
    return res.status(500).json({ error: 'Failed to settle previous incomes' });
  }
});

export default router;
