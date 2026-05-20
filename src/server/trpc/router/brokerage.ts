import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBrokerageDetailsHandler,
  addBrokerageDetailsHandler,
  removeBrokerageDetailsHandler,
  updateBrokerageDetailsHandler,
} from '@/server/controllers/brokerage.controller';
import {
  createBrokerageSchema,
  updateBrokerageSchema,
  params,
} from '@/server/schema/brokerage.schema';

export const brokerageRouter = router({
  saveBrokerageDetails: protectedProcedure
    .input(createBrokerageSchema)
    .mutation(({ input }) => addBrokerageDetailsHandler({ input })),
  getAllBrokerages: protectedProcedure.query(() => {
    return allBrokerageDetailsHandler();
  }),
  updateBrokerageDetails: protectedProcedure
    .input(updateBrokerageSchema)
    .mutation(({ input }) => updateBrokerageDetailsHandler({ input })),
  removeBrokerageDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBrokerageDetailsHandler({ params: input })),
});
