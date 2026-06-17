import { protectedProcedure } from '@/server/trpc/trpc';

export const getFilterOptionsQuery = protectedProcedure.query(async ({ ctx }) => {
  const [expenseCategories, incomeSources] = await Promise.all([
    ctx.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    ctx.prisma.incomeSource.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return {
    expenseCategories,
    incomeSourceLabels: incomeSources,
  };
});
