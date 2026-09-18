import { prisma } from '../lib/prisma.js';

export async function findOrCreateCategory(
  userId: string,
  name: string,
  type: 'income' | 'expense'
) {
  const existing = await prisma.category.findFirst({
    where: { userId, name, type },
  });

  if (existing) return existing;

  return prisma.category.create({
    data: { userId, name, type },
  });
}
