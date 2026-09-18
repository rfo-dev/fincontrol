import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest, requireAuth } from './auth.js';

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    console.error('requireAdmin error:', error);
    return res.status(500).json({ error: 'Failed to authorize admin' });
  }
}

export const adminAuth = [requireAuth, requireAdmin];
