import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { protectedProcedure,router } from '@/server/trpc/trpc';

const createSchema = z.object({ name: z.string().min(1).max(100) });
const updateSchema = z.object({ id: z.string(), name: z.string().min(1).max(100) });
const removeSchema = z.object({ id: z.string() });

export type IncomeSourceRecord = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  usageCount: number;
};

export const incomeSourceRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }): Promise<IncomeSourceRecord[]> => {
    // Returns ALL income sources (including inactive) for management UI
    // usageCount = number of this user's CREDIT transactions whose category matches the source name
    const userId = ctx.session.user.id;
    const sources = await ctx.prisma.incomeSource.findMany({
      orderBy: { name: 'asc' },
    });
    const usageCounts = await ctx.prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, type: 'CREDIT', status: 'CONFIRMED' },
      _count: { category: true },
    });
    const countByName = new Map(usageCounts.map((r) => [r.category.toLowerCase(), r._count.category]));
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || undefined,
      isActive: s.isActive,
      usageCount: countByName.get(s.name.toLowerCase()) ?? 0,
    }));
  }),

  getAllActive: protectedProcedure.query(async ({ ctx }) => {
    // Returns only isActive=true sources — used by income entry form dropdowns
    return ctx.prisma.incomeSource.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
  }),

  create: protectedProcedure.input(createSchema).mutation(async ({ ctx, input }) => {
    // Check for duplicate name (case-insensitive)
    const existing = await ctx.prisma.incomeSource.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An income source with this name already exists',
      });
    }
    return ctx.prisma.incomeSource.create({
      data: { name: input.name },
    });
  }),

  update: protectedProcedure.input(updateSchema).mutation(async ({ ctx, input }) => {
    // Check for duplicate name (case-insensitive), excluding this record
    const existing = await ctx.prisma.incomeSource.findFirst({
      where: { name: { equals: input.name, mode: 'insensitive' }, NOT: { id: input.id } },
    });
    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An income source with this name already exists',
      });
    }
    return ctx.prisma.incomeSource.update({
      where: { id: input.id },
      data: { name: input.name },
    });
  }),

  restore: protectedProcedure.input(removeSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.incomeSource.update({
      where: { id: input.id },
      data: { isActive: true },
    });
  }),

  remove: protectedProcedure.input(removeSchema).mutation(async ({ ctx, input }) => {
    // Resolve source name first to avoid inline async in query and fix race condition
    const source = await ctx.prisma.incomeSource.findUnique({
      where: { id: input.id },
      select: { name: true },
    });
    if (!source) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Income source not found' });
    }

    // Count this user's CREDIT transactions using this source name
    const usageCount = await ctx.prisma.transaction.count({
      where: {
        userId: ctx.session.user.id,
        type: 'CREDIT',
        status: 'CONFIRMED',
        category: { equals: source.name, mode: 'insensitive' },
      },
    });
    if (usageCount > 0) {
      // Soft-delete: set isActive = false
      await ctx.prisma.incomeSource.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return { softDeleted: true };
    }
    // Hard delete
    await ctx.prisma.incomeSource.delete({ where: { id: input.id } });
    return { softDeleted: false };
  }),
});
