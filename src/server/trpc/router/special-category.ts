import { router, protectedProcedure } from '@/server/trpc/trpc';

export type SpecialCategoryRecord = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isEditable: boolean;
  color?: string;
};

export const specialCategoryRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }): Promise<SpecialCategoryRecord[]> => {
    // Returns ALL special categories (including inactive)
    const categories = await ctx.prisma.specialCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      isEditable: c.isEditable,
      color: c.color || undefined,
    }));
  }),

  getAllActive: protectedProcedure.query(async ({ ctx }) => {
    // Returns only isActive=true special categories
    return ctx.prisma.specialCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, color: true },
    });
  }),
});
