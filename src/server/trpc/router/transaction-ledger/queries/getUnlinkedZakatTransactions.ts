import { z } from 'zod';

import { getUnlinkedZakatTransactions } from '@/server/services/zakat/zakat.service';
import { protectedProcedure } from '@/server/trpc/trpc';

export const getUnlinkedZakatTransactionsQuery = protectedProcedure
  .input(
    z.object({
      dateFrom: z.string().min(1),
      dateTo: z.string().min(1),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const fromYear = parseInt(input.dateFrom.split('-')[0] ?? '2024');
    const toYear = parseInt(input.dateTo.split('-')[0] ?? '2024');
    return getUnlinkedZakatTransactions(userId, fromYear, toYear);
  });
