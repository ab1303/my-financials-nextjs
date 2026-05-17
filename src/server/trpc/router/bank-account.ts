import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  createBankAccountSchema,
  deleteBankAccountSchema,
} from '@/server/schema/bank-account.schema';
import {
  createBankAccountHandler,
  deleteBankAccountHandler,
  listBankAccountsHandler,
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
});
