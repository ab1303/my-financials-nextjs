import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBusinessDetailsHandler,
  addBusinessDetailsHandler,
  removeBusinessDetailsHandler,
  getBusinessesByTypeHandler,
} from '@/server/controllers/business.controller';
import { createBusinessSchema, params } from '@/server/schema/business.schema';

export const businessRouter = router({
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
