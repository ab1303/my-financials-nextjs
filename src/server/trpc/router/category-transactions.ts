import { z } from 'zod';

import {
  EXCLUDED_FROM_EXPENSE_AGGREGATION,
  TRANSFER_CATEGORY,
} from '@/server/services/transactions/constants';
import { protectedProcedure, router } from '@/server/trpc/trpc';

const GetByCategoryInputSchema = z.object({
  category: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2099),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type GetByCategoryInput = z.infer<typeof GetByCategoryInputSchema>;

const GetForPeriodInputSchema = z.object({
  // Filter by category name (for expense drill-down). Mutually exclusive with source.
  category: z.string().optional(),
  // Filter by income source/category (for income drill-down). Mutually exclusive with category.
  source: z.string().optional(),
  // Filter by specific month (1-12). If omitted, queries entire year.
  month: z.number().int().min(1).max(12).optional(),
  // Calendar year (e.g. 2024) — required
  year: z.number().int().min(2000).max(2099),
  // Transaction type: DEBIT for expenses, CREDIT for income
  type: z.enum(['DEBIT', 'CREDIT']).default('DEBIT'),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});

export type GetForPeriodInput = z.infer<typeof GetForPeriodInputSchema>;

export interface GetForPeriodOutput {
  transactions: CategoryTransactionRow[];
  total: number; // count
  totalAmount: number; // sum
  label: string; // Human-readable description of the filter
}

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

      // Only exclude Transfer rows when the caller is NOT querying the Transfer category itself.
      // The "Transfers" tab uses this path and must still see Transfer rows.
      const transferGuard =
        category.toLowerCase() !== TRANSFER_CATEGORY.toLowerCase()
          ? { category: { notIn: [...EXCLUDED_FROM_EXPENSE_AGGREGATION] } }
          : undefined;

      const where = {
        userId,
        type: 'DEBIT' as const,
        status: 'CONFIRMED' as const,
        category: { equals: category, mode: 'insensitive' as const },
        ...(transferGuard ? { AND: transferGuard } : {}),
        date: {
          gte: startDate,
          lte: endDate,
        },
      };

      const [transactions, total] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where,
          include: {
            financialAccount: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip: offset,
          take: limit,
        }),
        ctx.prisma.transaction.count({ where }),
      ]);

      const totalAmount = transactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0,
      );
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
          bankAccountName: tx.financialAccount?.name ?? null,
        })),
        category,
        month,
        year,
        total,
        totalAmount: Number(totalAmount.toFixed(2)),
        averageAmount: Number(averageAmount.toFixed(2)),
      };
    }),

  getForPeriod: protectedProcedure
    .input(GetForPeriodInputSchema)
    .query(async ({ ctx, input }): Promise<GetForPeriodOutput> => {
      const userId = ctx.session.user.id;
      const { category, source, month, year, type, limit, offset } = input;

      // Determine date range: specific month or entire year
      const startDate = new Date(year, month ? month - 1 : 0, 1);
      const endDate = month
        ? new Date(year, month, 0, 23, 59, 59, 999)
        : new Date(year, 11, 31, 23, 59, 59, 999);

      // Build category filter
      const categoryFilter = category
        ? { equals: category, mode: 'insensitive' as const }
        : source
          ? { equals: source, mode: 'insensitive' as const }
          : undefined;

      // Only exclude Transfer rows for DEBIT type when filtering by category
      const transferGuard =
        type === 'DEBIT' &&
        category &&
        category.toLowerCase() !== TRANSFER_CATEGORY.toLowerCase()
          ? { category: { notIn: [...EXCLUDED_FROM_EXPENSE_AGGREGATION] } }
          : undefined;

      const where = {
        userId,
        type,
        status: 'CONFIRMED' as const,
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(transferGuard ? { AND: transferGuard } : {}),
        date: {
          gte: startDate,
          lte: endDate,
        },
      };

      const [transactions, total] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where,
          include: {
            financialAccount: { select: { name: true } },
          },
          orderBy: { date: 'desc' },
          skip: offset,
          take: limit,
        }),
        ctx.prisma.transaction.count({ where }),
      ]);

      const totalAmount = transactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0,
      );

      // Build human-readable label
      let label = '';
      if (category) {
        label = category;
      } else if (source) {
        label = `${source} income`;
      } else if (month) {
        const monthName = new Date(year, month - 1).toLocaleString('en-US', {
          month: 'long',
        });
        label = `${monthName} ${year}`;
      } else {
        label = `Year ${year}`;
      }

      return {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString().split('T')[0]!,
          description: tx.description,
          amount: Number(tx.amount),
          category: tx.category,
          source: tx.source,
          status: tx.status,
          bankAccountName: tx.financialAccount?.name ?? null,
        })),
        total,
        totalAmount: Number(totalAmount.toFixed(2)),
        label,
      };
    }),
});
