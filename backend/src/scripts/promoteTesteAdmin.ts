import { prisma } from '../lib/prisma.js';

async function main() {
  const email = 'teste@fincontrol.local';
  const result = await prisma.user.updateMany({
    where: { email },
    data: { role: 'admin', isActive: true },
  });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true, role: true, name: true, isActive: true },
  });

  console.log({ updated: result.count, user });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
