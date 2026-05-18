import { router, protectedProcedure } from '@/server/trpc/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

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
    // Includes usageCount from IncomeRecord count
    const sources = await ctx.prisma.incomeSource.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { incomeRecords: true } } },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || undefined,
      isActive: s.isActive,
      usageCount: s._count.incomeRecords,
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
    // Count usage
    const usageCount = await ctx.prisma.incomeRecord.count({
      where: { incomeSourceId: input.id },
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
