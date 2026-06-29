import {
  addBrokerageDetailsHandler,
  allBrokerageDetailsHandler,
  removeBrokerageDetailsHandler,
  updateBrokerageDetailsHandler,
} from '@/server/controllers/brokerage.controller';
import {
  createBrokerageSchema,
  params,
  updateBrokerageSchema,
} from '@/server/schema/brokerage.schema';
import { protectedProcedure, router } from '@/server/trpc/trpc';

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
