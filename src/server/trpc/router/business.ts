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

export const businessRouter = router({
  // Quick-create: name only — used by CreateBeneficiaryModal in the donation linking drawer
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1, 'Name is required') }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const existing = await getBusinessDetails({ userId, name: { equals: input.name, mode: 'insensitive' } });
      if (existing && existing.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A business with this name already exists.' });
      }
      const business = await addBusinessDetails({ name: input.name, userId });
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
});
