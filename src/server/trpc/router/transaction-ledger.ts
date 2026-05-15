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
  applyReimbursementOffset,
  reverseReimbursementOffset,
} from '@/server/services/transactions/ledger.service';
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';

type PrismaReimbursement = {
  id: string;
  date: Date;
  description: string;
  amount: Decimal;
  type: TransactionTypeEnum;
  category: string;
  offsetCategory: string | null;
  source: TransactionSourceEnum;
  status: TransactionStatusEnum;
  confirmedAt: Date | null;
  bankAccountId: string | null;
  bankAccount?: { name: string; bank?: { name: string | null } | null } | null;
};

type PrismaTransaction = {
  id: string;
  date: Date;
  description: string;
  amount: Decimal;
  type: TransactionTypeEnum;
  category: string;
  offsetCategory: string | null;
  offsetTransactionId: string | null;
  source: TransactionSourceEnum;
  status: TransactionStatusEnum;
  confirmedAt: Date | null;
  bankAccountId: string | null;
  bankAccount?: { name: string; bank?: { name: string | null } | null } | null;
  userId: string;
  importSessionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reimbursements: PrismaReimbursement[];
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
  offsetCategory: string | null;
  offsetTransactionId: string | null;
  reimbursements: TransactionRow[];
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
  category: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  uncategorized: z.boolean().optional(),
  reimbursementOnly: z.boolean().optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
});

const updateCategorySchema = z
  .object({
    id: z.string().min(1),
    newCategory: z.string().min(1),
    offsetCategory: z.string().optional(),
    offsetTransactionId: z.string().optional(),
  })
  .refine(
    (data) =>
      data.newCategory !== REIMBURSEMENT_CATEGORY ||
      (!!data.offsetCategory && data.offsetCategory.length > 0),
    {
      message: 'offsetCategory is required when category is Reimbursement',
      path: ['offsetCategory'],
    },
  );

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

  if (input.category) {
    where.category = input.category;
  }

  if (input.uncategorized === true) {
    where.category = '';
  }

  if (input.reimbursementOnly === true) {
    where.category = REIMBURSEMENT_CATEGORY;
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
        include: {
          bankAccount: { select: { name: true, bank: { select: { name: true } } } },
          reimbursements: {
            where: { category: REIMBURSEMENT_CATEGORY },
            select: {
              id: true,
              date: true,
              description: true,
              amount: true,
              type: true,
              category: true,
              offsetCategory: true,
              source: true,
              status: true,
              confirmedAt: true,
              bankAccountId: true,
              bankAccount: { select: { name: true, bank: { select: { name: true } } } },
            },
          },
        },
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
      offsetCategory: tx.offsetCategory ?? null,
      offsetTransactionId: tx.offsetTransactionId ?? null,
      reimbursements: (tx.reimbursements ?? []).map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        description: r.description,
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        offsetCategory: r.offsetCategory ?? null,
        source: r.source,
        status: r.status,
        confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
        bankAccountId: r.bankAccountId,
        bankAccountName: r.bankAccount?.name ?? null,
        bankName: r.bankAccount?.bank?.name ?? null,
        offsetTransactionId: null,
        reimbursements: [],
      })),
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
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        category: true,
        offsetCategory: true,
        offsetTransactionId: true,
        amount: true,
        date: true,
      },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (input.newCategory === REIMBURSEMENT_CATEGORY && transaction.type !== TransactionTypeEnum.CREDIT) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Reimbursement category is only valid for CREDIT transactions',
      });
    }

    if (input.offsetTransactionId) {
      const linked = await ctx.prisma.transaction.findUnique({
        where: { id: input.offsetTransactionId },
        select: { userId: true, type: true, status: true },
      });
      if (!linked || linked.userId !== userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Linked transaction not found' });
      }
      if (linked.type !== TransactionTypeEnum.DEBIT || linked.status !== TransactionStatusEnum.CONFIRMED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Linked transaction must be a confirmed expense (DEBIT)',
        });
      }
    }

    let newStatus: TransactionStatusEnum = transaction.status;
    let newConfirmedAt: Date | undefined;

    if (
      input.newCategory === REIMBURSEMENT_CATEGORY &&
      transaction.status === TransactionStatusEnum.EXCLUDED
    ) {
      newStatus = TransactionStatusEnum.CONFIRMED;
      newConfirmedAt = new Date();
    } else if (
      transaction.category === REIMBURSEMENT_CATEGORY &&
      input.newCategory !== REIMBURSEMENT_CATEGORY &&
      transaction.status === TransactionStatusEnum.CONFIRMED
    ) {
      newStatus = TransactionStatusEnum.EXCLUDED;
    }

    await ctx.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        category: input.newCategory,
        source: TransactionSourceEnum.USER_OVERRIDE,
        status: newStatus,
        ...(newConfirmedAt ? { confirmedAt: newConfirmedAt } : {}),
        offsetCategory: input.newCategory === REIMBURSEMENT_CATEGORY ? (input.offsetCategory ?? null) : null,
        offsetTransactionId:
          input.newCategory === REIMBURSEMENT_CATEGORY ? (input.offsetTransactionId ?? null) : null,
      },
    });

    const categoryChanged = transaction.category !== input.newCategory;
    const offsetCatChanged = transaction.offsetCategory !== (input.offsetCategory ?? null);

    if (transaction.category !== REIMBURSEMENT_CATEGORY && input.newCategory === REIMBURSEMENT_CATEGORY) {
      if (input.offsetCategory) {
        await applyReimbursementOffset({
          prismaClient: ctx.prisma,
          userId,
          offsetCategory: input.offsetCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      }
    } else if (transaction.category === REIMBURSEMENT_CATEGORY && input.newCategory !== REIMBURSEMENT_CATEGORY) {
      if (transaction.offsetCategory) {
        await reverseReimbursementOffset({
          prismaClient: ctx.prisma,
          userId,
          offsetCategory: transaction.offsetCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      }
    } else if (
      transaction.category === REIMBURSEMENT_CATEGORY &&
      input.newCategory === REIMBURSEMENT_CATEGORY &&
      offsetCatChanged
    ) {
      if (transaction.offsetCategory) {
        await reverseReimbursementOffset({
          prismaClient: ctx.prisma,
          userId,
          offsetCategory: transaction.offsetCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      }
      if (input.offsetCategory) {
        await applyReimbursementOffset({
          prismaClient: ctx.prisma,
          userId,
          offsetCategory: input.offsetCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      }
    } else if (
      transaction.type === TransactionTypeEnum.DEBIT &&
      transaction.status === TransactionStatusEnum.CONFIRMED &&
      categoryChanged
    ) {
      await rerollupExpenseSummary({
        prismaClient: ctx.prisma,
        userId,
        oldCategory: transaction.category,
        newCategory: input.newCategory,
        amount: transaction.amount as Decimal,
        date: transaction.date,
      });
    } else if (
      transaction.type === TransactionTypeEnum.CREDIT &&
      transaction.status === TransactionStatusEnum.CONFIRMED &&
      transaction.category !== REIMBURSEMENT_CATEGORY &&
      input.newCategory !== REIMBURSEMENT_CATEGORY &&
      categoryChanged
    ) {
      await updateIncomeRecordSource({
        prismaClient: ctx.prisma,
        userId,
        newSource: input.newCategory as IncomeSourceEnumType,
        amount: transaction.amount as Decimal,
        transactionDate: transaction.date,
      });
    }

    return { success: true };
  }),

  searchDebitTransactions: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionTypeEnum.DEBIT,
          status: TransactionStatusEnum.CONFIRMED,
          ...(input.search?.trim()
            ? {
                OR: [
                  { description: { contains: input.search.trim(), mode: 'insensitive' } },
                  { category: { contains: input.search.trim(), mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ date: 'desc' }],
        take: input.limit,
        select: { id: true, date: true, description: true, amount: true, category: true },
      });
      return transactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString().slice(0, 10),
        description: tx.description,
        amount: Number(tx.amount),
        category: tx.category,
      }));
    }),
});
