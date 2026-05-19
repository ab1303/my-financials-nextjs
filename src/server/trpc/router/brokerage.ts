import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBrokerageDetailsHandler,
  addBrokerageDetailsHandler,
  removeBrokerageDetailsHandler,
} from '@/server/controllers/brokerage.controller';
import {
  createBrokerageSchema,
  params,
} from '@/server/schema/brokerage.schema';

export const brokerageRouter = router({
  saveBrokerageDetails: protectedProcedure
    .input(createBrokerageSchema)
    .mutation(({ input }) => addBrokerageDetailsHandler({ input })),
  getAllBrokerages: protectedProcedure.query(() => {
    return allBrokerageDetailsHandler();
  }),
  removeBrokerageDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBrokerageDetailsHandler({ params: input })),
});
