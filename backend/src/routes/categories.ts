import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { findOrCreateCategory } from '../services/categories.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const rows = await prisma.category.findMany({
      where: {
        userId: req.user!.id,
        ...(type ? { type } : {}),
      },
      orderBy: { name: 'asc' },
    });

    return res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
      }))
    );
  } catch (error) {
    console.error('List categories error:', error);
    return res.status(500).json({ error: 'Failed to list categories' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid category payload' });
    }

    const category = await findOrCreateCategory(
      req.user!.id,
      parsed.data.name,
      parsed.data.type
    );

    return res.status(201).json({
      id: category.id,
      name: category.name,
      type: category.type,
    });
  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({ error: 'Failed to create category' });
  }
});

export default router;
