import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBusinessDetailsHandler,
  addBusinessDetailsHandler,
  removeBusinessDetailsHandler,
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
  removeBusinessDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBusinessDetailsHandler({ params: input })),
});
