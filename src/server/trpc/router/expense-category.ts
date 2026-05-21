import { router, protectedProcedure } from '@/server/trpc/trpc';
import { updateTransactionCategory } from '@/server/services/transaction.service';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = z.object({ id: z.string(), name: z.string().min(1).max(100) });
const removeSchema = z.object({ id: z.string() });

export type ExpenseCategoryRecord = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  usageCount: number;
};

export const expenseCategoryRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }): Promise<ExpenseCategoryRecord[]> => {
    // Returns ALL categories (including inactive) with usageCount from MonthlyExpenseSummary
    const categories = await ctx.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { monthlyExpenseSummaries: true } } },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      isActive: c.isActive,
      usageCount: c._count.monthlyExpenseSummaries,
    }));
  }),

  getAllActive: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
  }),

  create: protectedProcedure.input(createSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.expenseCategory.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An expense category with this name already exists',
      });
    }
    return ctx.prisma.expenseCategory.create({
      data: { name: input.name },
    });
  }),

  update: protectedProcedure.input(updateSchema).mutation(async ({ ctx, input }) => {
    // Check for duplicate names
    const existing = await ctx.prisma.expenseCategory.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' }, NOT: { id: input.id } },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An expense category with this name already exists',
      });
    }

    // Get the old category name before updating
    const oldCategory = await ctx.prisma.expenseCategory.findUniqueOrThrow({
      where: { id: input.id },
    });

    // Update the category
    const updated = await ctx.prisma.expenseCategory.update({
      where: { id: input.id },
      data: { name: input.name },
    });

    // Sync all transactions with the old category name to the new one
    await updateTransactionCategory(oldCategory.name, input.name);

    return updated;
  }),

  restore: protectedProcedure.input(removeSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.expenseCategory.update({
      where: { id: input.id },
      data: { isActive: true },
    });
  }),

  remove: protectedProcedure.input(removeSchema).mutation(async ({ ctx, input }) => {
    const usageCount = await ctx.prisma.monthlyExpenseSummary.count({
      where: { categoryId: input.id },
    });
    if (usageCount > 0) {
      await ctx.prisma.expenseCategory.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { softDeleted: true };
    }
    await ctx.prisma.expenseCategory.delete({ where: { id: input.id } });
    return { softDeleted: false };
  }),
});
