import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createBankAccountSchema,
  deleteBankAccountSchema,
} from '@/server/schema/bank-account.schema';
import {
  createBankAccountHandler,
  deleteBankAccountHandler,
  listBankAccountsHandler,
  updateTrackingHandler,
} from '@/server/controllers/bank-account.controller';

export const bankAccountRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    listBankAccountsHandler(ctx.session.user.id),
  ),

  create: protectedProcedure
    .input(createBankAccountSchema)
    .mutation(({ input, ctx }) =>
      createBankAccountHandler(input, ctx.session.user.id),
    ),

  delete: protectedProcedure
    .input(deleteBankAccountSchema)
    .mutation(({ input, ctx }) =>
      deleteBankAccountHandler(input, ctx.session.user.id),
    ),

  updateTracking: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      isTracked: z.boolean(),
    }))
    .mutation(({ input, ctx }) =>
      updateTrackingHandler(input, ctx.session.user.id),
    ),
});
