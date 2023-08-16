import { router, protectedProcedure } from '@/server/trpc/trpc';
import { addBankDetailsHandler } from '@/server/controllers/bank.controller';
import { createBankSchema } from '@/server/schema/bank.schema';

export const bankRouter = router({
  saveBankDetails: protectedProcedure
    .input(createBankSchema)
    .mutation((bankDetails) => addBankDetailsHandler(bankDetails)),
});
