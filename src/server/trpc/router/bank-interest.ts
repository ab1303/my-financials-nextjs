import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  getYearlyBankInterestSchema,
  updateBankInterestSchema,
} from '@/server/schema/bank-interest.schema';
import {
  bankInterestDetailsHandler,
  updateBankInterestDetailsHandler,
} from '@/server/controllers/bank-interest.controller';

export const bankInterestRouter = router({
  getYearlyBankInterestDetails: protectedProcedure
    .input(getYearlyBankInterestSchema)
    .query(({ input: { bankId, year } }) =>
      bankInterestDetailsHandler(bankId, year)
    ),
  updateBankInterestDetail: protectedProcedure
    .input(updateBankInterestSchema)
    .mutation(({ input: { bankInterestId, bankId, year, amount } }) =>
      updateBankInterestDetailsHandler(bankInterestId, bankId, year, amount)
    ),
});
