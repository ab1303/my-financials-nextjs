import { z } from 'zod';
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
  initializeBankInterestYearHandler,
  updateBankInterestDetailsHandler,
  createSingleBankInterestLiabilityHandler,
  createBankInterestPaymentHandler,
  updateBankInterestPaymentHandler,
  removeBankInterestPaymentHandler,
} from '@/server/controllers/bank-interest.controller';
import {
  getYearlyCleansingData,
  getUnlinkedInterestTransactions,
  getUnlinkedCleansingDebitTransactions,
} from '@/server/services/bank-interest/interest-cleansing.service';

export const bankInterestRouter = router({
  initializeBankInterestYear: protectedProcedure
    .input(z.object({ bankId: z.string(), calendarYearId: z.string() }))
    .mutation(({ input }) =>
      initializeBankInterestYearHandler(input.bankId, input.calendarYearId)
    ),
  getYearlyBankInterestDetails: protectedProcedure
    .input(getYearlyBankInterestSchema)
    .query(({ input: { bankId, calendarYearId } }) =>
      bankInterestDetailsHandler(bankId, calendarYearId)
    ),
  updateBankInterestDetail: protectedProcedure
    .input(updateBankInterestSchema)
    .mutation(({ input: { bankInterestId, bankId, calendarYearId, amount } }) =>
      updateBankInterestDetailsHandler(
        bankInterestId,
        bankId,
        calendarYearId,
        amount
      )
    ),
  createSingleBankInterestLiability: protectedProcedure
    .input(z.object({
      bankId: z.string(),
      calendarYearId: z.string(),
      month: z.number().min(1).max(12),
      year: z.number().positive(),
      amountDue: z.number().nonnegative(),
    }))
    .mutation(({ input: { bankId, calendarYearId, month, year, amountDue } }) =>
      createSingleBankInterestLiabilityHandler(
        bankId,
        calendarYearId,
        month,
        year,
        amountDue
      )
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
  getInterestCleansingData: protectedProcedure
    .input(z.object({ bankId: z.string(), calendarYearId: z.string() }))
    .query(({ ctx, input }) =>
      getYearlyCleansingData(
        input.bankId,
        input.calendarYearId,
        ctx.session.user.id,
      ),
    ),
  getUnlinkedInterestTransactions: protectedProcedure
    .input(z.object({ bankId: z.string(), dateFrom: z.string(), dateTo: z.string() }))
    .query(({ ctx, input }) =>
      getUnlinkedInterestTransactions(
        input.bankId,
        new Date(input.dateFrom),
        new Date(input.dateTo),
        ctx.session.user.id,
      ),
    ),
  getUnlinkedCleansingDebitTransactions: protectedProcedure
    .input(z.object({ bankId: z.string() }))
    .query(({ ctx, input }) =>
      getUnlinkedCleansingDebitTransactions(
        ctx.session.user.id,
        input.bankId,
      ),
    ),
});
