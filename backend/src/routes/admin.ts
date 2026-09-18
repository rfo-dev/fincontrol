import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '../lib/defaultCategories.js';
import { AuthRequest } from '../middleware/auth.js';
import { adminAuth } from '../middleware/admin.js';

const router = Router();
router.use(...adminAuth);

function mapAdminUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['user', 'user_ai', 'admin']).optional().default('user'),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['user', 'user_ai', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6),
});

router.get('/users', async (_req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ role: 'desc' }, { name: 'asc' }, { email: 'asc' }],
    });

    return res.json(users.map(mapAdminUser));
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', async (req: AuthRequest, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Informe nome completo, email e senha (mín. 6 caracteres)',
      });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name.trim(),
          email,
          passwordHash,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.category.createMany({
        data: [
          ...DEFAULT_EXPENSE_CATEGORIES.map((catName) => ({
            name: catName,
            type: 'expense',
            userId: created.id,
          })),
          ...DEFAULT_INCOME_CATEGORIES.map((catName) => ({
            name: catName,
            type: 'income',
            userId: created.id,
          })),
        ],
      });

      return created;
    });

    return res.status(201).json(mapAdminUser(user));
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.get('/users/:id', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.json(mapAdminUser(user));
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res) => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos para atualização' });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (parsed.data.email && parsed.data.email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });
      if (emailTaken) {
        return res.status(409).json({ error: 'Este email já está em uso' });
      }
    }

    // Prevent admin from disabling or demoting themselves
    if (existing.id === req.user!.id) {
      if (parsed.data.isActive === false) {
        return res.status(400).json({ error: 'Você não pode desabilitar a própria conta' });
      }
      if (parsed.data.role === 'user') {
        return res.status(400).json({ error: 'Você não pode remover o próprio perfil admin' });
      }
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email.toLowerCase() } : {}),
        ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(mapAdminUser(user));
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/users/:id/reset-password', async (req: AuthRequest, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Senha inválida (mínimo 6 caracteres)' });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
