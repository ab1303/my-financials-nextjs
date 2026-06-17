import { z } from 'zod';
import { protectedProcedure } from '@/server/trpc/trpc';
import { getUnlinkedDonationTransactions } from '@/server/services/transactions/donation-link.service';

export const getUnlinkedDonationTransactionsQuery = protectedProcedure
  .input(
    z.object({
      dateFrom: z.string(),
      dateTo: z.string(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const dateFrom = new Date(`${input.dateFrom}T00:00:00`);
    const dateTo = new Date(`${input.dateTo}T23:59:59`);
    return getUnlinkedDonationTransactions(userId, dateFrom, dateTo);
  });
