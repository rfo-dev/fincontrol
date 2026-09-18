import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { mapCreditCard } from '../lib/mappers.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const lastFourSchema = z
  .string()
  .regex(/^\d{4}$/, 'Final must be exactly 4 digits')
  .optional()
  .nullable();

const createSchema = z.object({
  name: z.string().min(1),
  last_four: lastFourSchema,
  due_day: z.number().int().min(1).max(31),
  closing_day: z.number().int().min(1).max(31).optional().nullable(),
  credit_limit: z.number().nonnegative().optional().nullable(),
  color: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial();

const markPaidSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
  isPaid: z.boolean().optional().default(true),
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const rows = await prisma.creditCard.findMany({
      where: { userId: req.user!.id },
      orderBy: { name: 'asc' },
    });
    return res.json(rows.map(mapCreditCard));
  } catch (error) {
    console.error('List credit cards error:', error);
    return res.status(500).json({ error: 'Failed to list credit cards' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid credit card payload' });
    }

    const row = await prisma.creditCard.create({
      data: {
        name: parsed.data.name,
        lastFour: parsed.data.last_four ?? null,
        dueDay: parsed.data.due_day,
        closingDay: parsed.data.closing_day ?? null,
        creditLimit: parsed.data.credit_limit ?? null,
        color: parsed.data.color ?? '#3B82F6',
        userId: req.user!.id,
      },
    });

    return res.status(201).json(mapCreditCard(row));
  } catch (error) {
    console.error('Create credit card error:', error);
    return res.status(500).json({ error: 'Failed to create credit card' });
  }
});

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid credit card payload' });
    }

    const existing = await prisma.creditCard.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    const data: {
      name?: string;
      lastFour?: string | null;
      dueDay?: number;
      closingDay?: number | null;
      creditLimit?: number | null;
      color?: string | null;
    } = {};

    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.last_four !== undefined) data.lastFour = parsed.data.last_four;
    if (parsed.data.due_day !== undefined) data.dueDay = parsed.data.due_day;
    if (parsed.data.closing_day !== undefined) data.closingDay = parsed.data.closing_day;
    if (parsed.data.credit_limit !== undefined) data.creditLimit = parsed.data.credit_limit;
    if (parsed.data.color !== undefined) data.color = parsed.data.color;

    const row = await prisma.creditCard.update({
      where: { id: existing.id },
      data,
    });

    return res.json(mapCreditCard(row));
  } catch (error) {
    console.error('Update credit card error:', error);
    return res.status(500).json({ error: 'Failed to update credit card' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.creditCard.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    await prisma.creditCard.delete({ where: { id: existing.id } });
    return res.status(204).send();
  } catch (error) {
    console.error('Delete credit card error:', error);
    return res.status(500).json({ error: 'Failed to delete credit card' });
  }
});

router.post('/:id/mark-paid', async (req: AuthRequest, res) => {
  try {
    const parsed = markPaidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid mark-paid payload' });
    }

    const card = await prisma.creditCard.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!card) {
      return res.status(404).json({ error: 'Credit card not found' });
    }

    const { year, month, isPaid } = parsed.data;
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));

    const result = await prisma.expense.updateMany({
      where: {
        userId: req.user!.id,
        creditCardId: card.id,
        isPaid: !isPaid,
        date: {
          gte: start,
          lt: end,
        },
      },
      data: { isPaid },
    });

    return res.json({ updated: result.count });
  } catch (error) {
    console.error('Mark credit card paid error:', error);
    return res.status(500).json({ error: 'Failed to mark credit card as paid' });
  }
});

export default router;
