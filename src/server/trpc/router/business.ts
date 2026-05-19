import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBusinessDetailsHandler,
  addBusinessDetailsHandler,
  removeBusinessDetailsHandler,
  getBusinessesByTypeHandler,
} from '@/server/controllers/business.controller';
import { createBusinessSchema, params } from '@/server/schema/business.schema';
import { addBusinessDetails, getBusinessDetails } from '@/server/services/business.service';
import { prisma } from '@/server/db/client';

export const businessRouter = router({
  // Quick-create: name only — used by CreateBeneficiaryModal in the donation linking drawer
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, 'Name is required'),
      type: z.enum(['PHILANTHROPY', 'BROKERAGE']).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const resolvedType = input.type ?? 'PHILANTHROPY';
      const isGlobalType = resolvedType === 'BROKERAGE';

      // Global types (BROKERAGE) are shared — check for name collision across all users.
      // User-specific types (PHILANTHROPY) are scoped per user.
      const existing = await getBusinessDetails(
        isGlobalType
          ? { userId: null, name: { equals: input.name, mode: 'insensitive' }, type: resolvedType }
          : { userId, name: { equals: input.name, mode: 'insensitive' } }
      );
      if (existing && existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A business with this name already exists.' });
      }
      const business = await addBusinessDetails({
        name: input.name,
        type: resolvedType,
        ...(isGlobalType ? { userId: null } : { userId }),
      });
      return { id: business.id, name: business.name };
    }),

  saveBusinessDetails: protectedProcedure
    .input(createBusinessSchema)
    .mutation(({ input, ctx: { session } }) =>
      addBusinessDetailsHandler({ input, userId: session.user.id }),
    ),
  getAllBusinesses: protectedProcedure.query(({ ctx: { session } }) => {
    return allBusinessDetailsHandler(session.user.id);
  }),
  getBusinessesByType: protectedProcedure
    .input(z.object({ type: z.string().optional() }).optional())
    .query(({ input, ctx: { session } }) => {
      return getBusinessesByTypeHandler(session.user.id, input?.type);
    }),
  removeBusinessDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBusinessDetailsHandler({ params: input })),

  getBrokeragesWithAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return await prisma.business.findMany({
      where: {
        type: 'BROKERAGE',
        OR: [
          { userId: null },
          { userId: userId },
        ],
      },
      select: {
        id: true,
        name: true,
        userId: true,
        financialAccounts: {
          where: { userId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }),
});
