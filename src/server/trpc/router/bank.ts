import {
  addBankDetailsHandler,
  allBankDetailsHandler,
  removeBankDetailsHandler,
} from '@/server/controllers/bank.controller';
import { createBankSchema, params } from '@/server/schema/bank.schema';
import { protectedProcedure,router } from '@/server/trpc/trpc';

export const bankRouter = router({
  saveBankDetails: protectedProcedure
    .input(createBankSchema)
    .mutation(({ input, ctx: { session } }) =>
      addBankDetailsHandler({ input, userId: session.user.id })
    ),
  getAllBanks: protectedProcedure.query(() => {
    return allBankDetailsHandler();
  }),
  removeBankDetails: protectedProcedure
    .input(params)
    .mutation(({ input }) => removeBankDetailsHandler({ params: input })),
});
