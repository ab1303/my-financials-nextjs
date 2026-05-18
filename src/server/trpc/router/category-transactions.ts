import { z } from 'zod';

import { router, protectedProcedure } from '@/server/trpc/trpc';

const GetByCategoryInputSchema = z.object({
  category: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2099),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type GetByCategoryInput = z.infer<typeof GetByCategoryInputSchema>;

export interface CategoryTransactionRow {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  description: string;
  amount: number;
  category: string;
  source: string; // LLM_CLASSIFIED | USER_OVERRIDE
  status: string; // CONFIRMED
  bankAccountName: string | null;
}

export interface GetByCategoryOutput {
  transactions: CategoryTransactionRow[];
  category: string;
  month: number;
  year: number;
  total: number; // count
  totalAmount: number; // sum
  averageAmount: number;
}

export const categoryTransactionsRouter = router({
  getByCategory: protectedProcedure
    .input(GetByCategoryInputSchema)
    .query(async ({ ctx, input }): Promise<GetByCategoryOutput> => {
      const userId = ctx.session.user.id;
      const { category, month, year, limit, offset } = input;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const where = {
        userId,
        type: 'DEBIT' as const,
        status: 'CONFIRMED' as const,
        category: { equals: category, mode: 'insensitive' as const },
        date: {
          gte: startDate,
          lte: endDate,
        },
      };

      const [transactions, total] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where,
          include: {
            bankAccount: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip: offset,
          take: limit,
        }),
        ctx.prisma.transaction.count({ where }),
      ]);

      const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      const averageAmount = total > 0 ? totalAmount / total : 0;

      return {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString().split('T')[0]!,
          description: tx.description,
          amount: Number(tx.amount),
          category: tx.category,
          source: tx.source,
          status: tx.status,
          bankAccountName: tx.bankAccount?.name ?? null,
        })),
        category,
        month,
        year,
        total,
        totalAmount: Number(totalAmount.toFixed(2)),
        averageAmount: Number(averageAmount.toFixed(2)),
      };
    }),
});
