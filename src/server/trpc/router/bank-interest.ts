import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createBankInterestPaymentOuputSchema,
  createBankInterestPaymentSchema,
  updateBankInterestPaymentSchema,
  removeBankInterestPaymentSchema,
  getYearlyBankInterestSchema,
  updateBankInterestSchema,
} from '@/server/schema/bank-interest.schema';

import {
  bankInterestDetailsHandler,
  updateBankInterestDetailsHandler,
  createBankInterestPaymentHandler,
  updateBankInterestPaymentHandler,
  removeBankInterestPaymentHandler,
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
  addBankInterestPayment: protectedProcedure
    .input(createBankInterestPaymentSchema)
    .output(createBankInterestPaymentOuputSchema)
    .mutation(({ input: { bankInterestId, businessId, amount, datePaid } }) =>
      createBankInterestPaymentHandler(
        bankInterestId,
        businessId,
        amount,
        datePaid
      )
    ),
  updateBankInterestPayment: protectedProcedure
    .input(updateBankInterestPaymentSchema)
    .mutation(({ input: { bankInterestId, paymentId, payment } }) =>
      updateBankInterestPaymentHandler(bankInterestId, paymentId, payment)
    ),
  removeBankInterestPayment: protectedProcedure
    .input(removeBankInterestPaymentSchema)
    .mutation(({ input: { bankInterestId, paymentId } }) =>
      removeBankInterestPaymentHandler(bankInterestId, paymentId)
    ),
});
