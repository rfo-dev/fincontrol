import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '../lib/defaultCategories.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2, 'Nome completo é obrigatório'),
});

const preferencesSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(0).max(11),
  bringPreviousExpenses: z.boolean().optional(),
  bringPreviousIncomes: z.boolean().optional(),
});

export type MonthCarryoverPref = {
  expenses?: boolean;
  incomes?: boolean;
};

export type MonthCarryoverPrefs = Record<string, MonthCarryoverPref>;

export function monthPrefKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function asPrefs(value: unknown): MonthCarryoverPrefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as MonthCarryoverPrefs;
}

function signToken(user: { id: string; email: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });
}

function publicUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  monthCarryoverPrefs?: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    monthCarryoverPrefs: asPrefs(user.monthCarryoverPrefs),
  };
}

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Informe nome completo, email e senha (mín. 6 caracteres)' });
    }

    const { email, password, name } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name: name.trim(),
          role: 'user',
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

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/admin-login', async (req, res) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        monthCarryoverPrefs: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.patch('/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid preferences payload' });
    }

    const { year, month, bringPreviousExpenses, bringPreviousIncomes } = parsed.data;
    if (bringPreviousExpenses === undefined && bringPreviousIncomes === undefined) {
      return res.status(400).json({ error: 'No preference fields provided' });
    }

    const existing = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { monthCarryoverPrefs: true },
    });

    const prefs = asPrefs(existing?.monthCarryoverPrefs);
    const key = monthPrefKey(year, month);
    const current = prefs[key] || {};

    prefs[key] = {
      expenses:
        bringPreviousExpenses !== undefined ? bringPreviousExpenses : (current.expenses ?? false),
      incomes:
        bringPreviousIncomes !== undefined ? bringPreviousIncomes : (current.incomes ?? false),
    };

    // Keep storage lean: remove month entry when both are false
    if (!prefs[key].expenses && !prefs[key].incomes) {
      delete prefs[key];
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { monthCarryoverPrefs: prefs },
    });

    return res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Preferences error:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
