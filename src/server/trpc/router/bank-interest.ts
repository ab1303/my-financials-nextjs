import { getYearlyBankInterestPaymentSchema } from '@/server/schema/bank-interest.schema';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import { bankInterestDetailsHandler } from '@/server/controllers/bank-interest.controller';

export const bankInterestRouter = router({
  getYearlyBankInterestDetails: protectedProcedure
    .input(getYearlyBankInterestPaymentSchema)
    .query(({ input: { bankId, year } }) =>
      bankInterestDetailsHandler(bankId, year)
    ),
});
