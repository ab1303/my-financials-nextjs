import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  createCategoryGroup,
  deleteCategoryGroup,
  listCategoryGroups,
  updateCategoryGroup,
} from '@/server/services/category-groups/category-groups.service';
import { protectedProcedure, router } from '@/server/trpc/trpc';

const categoryGroupScopeEnum = z.enum(['INCOME', 'EXPENSE']);

export const categoryGroupRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listCategoryGroups({
      prisma: ctx.prisma,
      userId: ctx.session.user.id,
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        scope: categoryGroupScopeEnum,
        name: z.string().min(1).max(255),
        description: z.string().max(1000).nullable().optional(),
        memberIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCategoryGroup({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          scope: input.scope,
          name: input.name,
          description: input.description,
          memberIds: input.memberIds,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to create category group',
        });
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        groupId: z.string().min(1),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(1000).nullable().optional(),
        memberIds: z.array(z.string().min(1)).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateCategoryGroup({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          groupId: input.groupId,
          name: input.name,
          description: input.description,
          memberIds: input.memberIds,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('Unauthorized')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: err.message,
          });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to update category group',
        });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ groupId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteCategoryGroup({
          prisma: ctx.prisma,
          userId: ctx.session.user.id,
          groupId: input.groupId,
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('Unauthorized')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: err.message,
          });
        }
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: err instanceof Error ? err.message : 'Failed to delete category group',
        });
      }
    }),
});
