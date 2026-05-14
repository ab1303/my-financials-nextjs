import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  Prisma,
  IncomeSourceEnumType,
  TransactionStatusEnum,
  TransactionSourceEnum,
  TransactionTypeEnum,
} from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { router, protectedProcedure } from '@/server/trpc/trpc';
import {
  rerollupExpenseSummary,
  updateIncomeRecordSource,
} from '@/server/services/transactions/ledger.service';

type PrismaTransaction = {
  id: string;
  date: Date;
  description: string;
  amount: Decimal;
  type: TransactionTypeEnum;
  category: string;
  source: TransactionSourceEnum;
  status: TransactionStatusEnum;
  confirmedAt: Date | null;
  bankAccountId: string | null;
  bankAccount?: { name: string; bank?: { name: string | null } | null } | null;
  userId: string;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  category: string;
  source: TransactionSourceEnum;
  status: TransactionStatusEnum;
  confirmedAt: string | null;
  bankAccountId: string | null;
  bankAccountName: string | null;
  bankName: string | null;
}

export interface GetAllOutput {
  transactions: TransactionRow[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GetFilterOptionsOutput {
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
}

const getAllInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  type: z.nativeEnum(TransactionTypeEnum).optional(),
  status: z.nativeEnum(TransactionStatusEnum).optional(),
  bankAccountId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  uncategorized: z.boolean().optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
});

const updateCategorySchema = z.object({ id: z.string().min(1), newCategory: z.string().min(1) });

export function buildTransactionWhere(input: z.infer<typeof getAllInputSchema>, userId: string) {
  const where: Prisma.TransactionWhereInput = { userId };

  if (input.type) {
    where.type = input.type;
  }

  if (input.status) {
    where.status = input.status;
  }

  if (input.bankAccountId) {
    where.bankAccountId = input.bankAccountId;
  }

  if (input.uncategorized === true) {
    where.category = '';
  }

  if (input.dateFrom || input.dateTo) {
    const dateFilter: Prisma.DateTimeFilter = {};

    if (input.dateFrom) {
      dateFilter.gte = new Date(`${input.dateFrom}T00:00:00`);
    }

    if (input.dateTo) {
      const end = new Date(`${input.dateTo}T00:00:00`);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    where.date = dateFilter;
  }

  if (input.amountMin !== undefined || input.amountMax !== undefined) {
    const amountFilter: Prisma.DecimalFilter = {};

    if (input.amountMin !== undefined) {
      amountFilter.gte = input.amountMin;
    }

    if (input.amountMax !== undefined) {
      amountFilter.lte = input.amountMax;
    }

    where.amount = amountFilter;
  }

  if (input.search?.trim()) {
    const search = input.search.trim();
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export const transactionLedgerRouter = router({
  getAll: protectedProcedure.input(getAllInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const where = buildTransactionWhere(input, userId);

    const [transactions, total] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        include: { bankAccount: { select: { name: true, bank: { select: { name: true } } } } },
      }),
      ctx.prisma.transaction.count({ where }),
    ]);

    const outputTransactions: TransactionRow[] = (transactions as PrismaTransaction[]).map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
      category: tx.category,
      source: tx.source,
      status: tx.status,
      confirmedAt: tx.confirmedAt ? tx.confirmedAt.toISOString() : null,
      bankAccountId: tx.bankAccountId,
      bankAccountName: tx.bankAccount?.name ?? null,
      bankName: tx.bankAccount?.bank?.name ?? null,
    }));

    return {
      transactions: outputTransactions,
      total,
      page: input.page,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    } satisfies GetAllOutput;
  }),

  getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
    const expenseCategories = await ctx.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });

    return {
      expenseCategories,
      incomeSourceLabels: Object.values(IncomeSourceEnumType) as string[],
    } satisfies GetFilterOptionsOutput;
  }),

  updateCategory: protectedProcedure.input(updateCategorySchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const transaction = await ctx.prisma.transaction.findUnique({
      where: { id: input.id },
      select: { id: true, userId: true, type: true, status: true, category: true, amount: true, date: true },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    await ctx.prisma.transaction.update({
      where: { id: transaction.id },
      data: { category: input.newCategory, source: TransactionSourceEnum.USER_OVERRIDE },
    });

    if (transaction.category !== input.newCategory) {
      if (transaction.type === TransactionTypeEnum.DEBIT && transaction.status === TransactionStatusEnum.CONFIRMED) {
        await rerollupExpenseSummary({
          prismaClient: ctx.prisma,
          userId,
          oldCategory: transaction.category,
          newCategory: input.newCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      }

      if (transaction.type === TransactionTypeEnum.CREDIT && transaction.status === TransactionStatusEnum.CONFIRMED) {
        await updateIncomeRecordSource({
          prismaClient: ctx.prisma,
          userId,
          newSource: input.newCategory as IncomeSourceEnumType,
          amount: transaction.amount as Decimal,
          transactionDate: transaction.date,
        });
      }
    }

    return { success: true };
  }),
});
