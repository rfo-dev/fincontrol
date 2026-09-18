import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
} from '../lib/defaultCategories.js';

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || 'teste@fincontrol.local').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Administrador';

  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD must have at least 6 characters');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name || name,
        role: 'admin',
        isActive: true,
        passwordHash,
      },
    });
    console.log(`Admin updated: ${email}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'admin',
        isActive: true,
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
  });

  console.log(`Admin created: ${email}`);
}

seedAdmin()
  .catch((error) => {
    console.error('Seed admin failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
