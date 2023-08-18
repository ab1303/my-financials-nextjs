import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  allBankDetailsHandler,
  addBankDetailsHandler,
  removeBankDetailsHandler,
} from '@/server/controllers/bank.controller';
import { createBankSchema, params } from '@/server/schema/bank.schema';

export const bankRouter = router({
  saveBankDetails: protectedProcedure
    .input(createBankSchema)
    .mutation((bankDetails) => addBankDetailsHandler(bankDetails)),
  getAllBanks: protectedProcedure.query(() => {
    return allBankDetailsHandler();
  }),
  removeBankDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBankDetailsHandler({ params: input })),
});
