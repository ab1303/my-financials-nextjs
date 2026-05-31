import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  Prisma,
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
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';
import { getUnlinkedDonationTransactions } from '@/server/services/transactions/donation-link.service';
import { getUnlinkedZakatTransactions } from '@/server/services/zakat.service';

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
  financialAccount?: { name: string; institution?: { name: string | null } | null } | null;
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
  financialAccount?: { name: string; institution?: { name: string | null } | null } | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  reimbursements: PrismaReimbursement[];
  donationPayment: { id: string } | null;
  transferLinkedTransactionId: string | null;
  transferLinkedTransaction: {
    id: string;
    date: Date;
    description: string;
    amount: Decimal;
    type: TransactionTypeEnum;
    bankAccount?: { name: string; bank?: { name: string | null } | null } | null;
  } | null;
  transferCounterpart: {
    id: string;
    date: Date;
    description: string;
    amount: Decimal;
    type: TransactionTypeEnum;
    bankAccount?: { name: string; bank?: { name: string | null } | null } | null;
  } | null;
  importSession?: { id: string; createdAt: Date } | null;
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
  isDonationLinked?: boolean;
  transferLinkedTransactionId: string | null;
  transferCounterpartId: string | null;
  transferCounterpart: {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    bankAccountName: string | null;
    bankName: string | null;
  } | null;
  isTransferClassified: boolean;
  importSource?: {
    id: string;
    createdAt: string;
  };
}

export interface GetAllOutput {
  transactions: TransactionRow[];
  nextCursor: string | null;
  totalDebitAmount: number;
  totalCreditAmount: number;
}

export interface GetFilterOptionsOutput {
  expenseCategories: Array<{ id: string; name: string }>;
  incomeSourceLabels: Array<{ id: string; name: string }>;
}

const getAllInputSchema = z.object({
  cursor: z.string().cuid().optional(),
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
  transferOnly: z.boolean().optional(),
  unmatchedTransferOnly: z.boolean().optional(),
  excludeTransferCategory: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  id: z.string().min(1),
  newCategory: z.string().min(1),
  offsetCategory: z.string().optional(),
  offsetTransactionId: z.string().optional(),
  applyToMatching: z.boolean().optional(), // default true; pass false during review-batch edits to prevent recursion
});

export function buildTransactionWhere(input: z.infer<typeof getAllInputSchema>, userId: string) {
  const where: Prisma.TransactionWhereInput = { userId };

  // Exclude VOIDED transactions by default from ledger view
  where.status = { not: TransactionStatusEnum.VOIDED };

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

  if (input.transferOnly === true) {
    where.category = TRANSFER_CATEGORY;
  }

  if (input.unmatchedTransferOnly === true) {
    where.category = TRANSFER_CATEGORY;
    // @ts-ignore — Prisma filters are correct; TS may not have the new field yet until migration
    where.transferLinkedTransactionId = null;
    // @ts-ignore — Prisma filters are correct; TS may not have the new field yet until migration
    where.transferCounterpart = { is: null };
  }

  if (input.excludeTransferCategory === true && !input.category) {
    where.category = { not: TRANSFER_CATEGORY };
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

  // Auto-exclude Transfer category from confirmed expense/income queries.
  // Applies when filtering by CONFIRMED status without an explicit category or transferOnly flag.
  // This prevents transfer-linked transactions (category='Transfer', status='CONFIRMED') from
  // leaking into expense/income reports when auto-matching sets category without changing status.
  if (
    input.status === TransactionStatusEnum.CONFIRMED &&
    !input.transferOnly &&
    !input.unmatchedTransferOnly &&
    !input.reimbursementOnly &&
    !input.category &&
    !input.uncategorized
  ) {
    where.category = { not: TRANSFER_CATEGORY };
  }

  return where;
}

export const transactionLedgerRouter = router({
  getAll: protectedProcedure.input(getAllInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const where = buildTransactionWhere(input, userId);

    // Fetch limit + 1 rows to detect if there's a next page
    const [rows, debitAggregate, creditAggregate] = await Promise.all([
      ctx.prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        skip: input.cursor ? 1 : 0,
        include: {
          financialAccount: { select: { name: true, institution: { select: { name: true } } } },
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
              financialAccount: { select: { name: true, institution: { select: { name: true } } } },
            },
          },
          donationPayment: { select: { id: true } },
          transferLinkedTransaction: {
            select: {
              id: true,
              date: true,
              description: true,
              amount: true,
              type: true,
              financialAccount: { select: { name: true, institution: { select: { name: true } } } },
            },
          },
          transferCounterpart: {
            select: {
              id: true,
              date: true,
              description: true,
              amount: true,
              type: true,
              financialAccount: { select: { name: true, institution: { select: { name: true } } } },
            },
          },
          importSession: { select: { id: true, createdAt: true } },
        },
      }),
      ctx.prisma.transaction.aggregate({
        where: { ...where, type: TransactionTypeEnum.DEBIT },
        _sum: { amount: true },
      }),
      ctx.prisma.transaction.aggregate({
        where: { ...where, type: TransactionTypeEnum.CREDIT },
        _sum: { amount: true },
      }),
    ]);

    // Determine if there's a next page and slice results
    const hasNextPage = rows.length > input.limit;
    const transactions = hasNextPage ? rows.slice(0, input.limit) : rows;
    const nextCursor = hasNextPage ? (transactions[transactions.length - 1]?.id ?? null) : null;

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
      bankAccountName: tx.financialAccount?.name ?? null,
      bankName: tx.financialAccount?.institution?.name ?? null,
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
        bankAccountName: r.financialAccount?.name ?? null,
        bankName: r.financialAccount?.institution?.name ?? null,
        offsetTransactionId: null,
        reimbursements: [],
        transferLinkedTransactionId: null,
        transferCounterpartId: null,
        transferCounterpart: null,
        isTransferClassified: false,
      })),
      isDonationLinked:
        tx.category.toLowerCase() === 'gifts & donations' && tx.type === TransactionTypeEnum.DEBIT
          ? tx.donationPayment !== null
          : undefined,
      transferLinkedTransactionId: tx.transferLinkedTransactionId ?? null,
      transferCounterpartId: tx.transferCounterpart?.id ?? null,
      transferCounterpart: (() => {
        const raw = (tx as any).transferLinkedTransaction ?? tx.transferCounterpart ?? null;
        if (!raw) return null;
        return {
          id: raw.id,
          date: (raw.date as Date).toISOString(),
          description: raw.description as string,
          amount: Number(raw.amount),
          type: raw.type as string,
          bankAccountName: raw.financialAccount?.name ?? null,
          bankName: raw.financialAccount?.institution?.name ?? null,
        };
      })(),
      isTransferClassified: tx.category === TRANSFER_CATEGORY,
      importSource: tx.importSession
        ? { id: tx.importSession.id, createdAt: tx.importSession.createdAt.toISOString() }
        : undefined,
    }));

    return {
      transactions: outputTransactions,
      nextCursor,
      totalDebitAmount: Number(debitAggregate._sum.amount ?? 0),
      totalCreditAmount: Number(creditAggregate._sum.amount ?? 0),
    } satisfies GetAllOutput;
  }),

  getFilterOptions: protectedProcedure.query(async ({ ctx }) => {
    const [expenseCategories, incomeSources] = await Promise.all([
      ctx.prisma.expenseCategory.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      ctx.prisma.incomeSource.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

    return {
      expenseCategories,
      incomeSourceLabels: incomeSources,
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
        description: true,
        offsetCategory: true,
        offsetTransactionId: true,
        amount: true,
        date: true,
      },
    });

    if (!transaction || transaction.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    if (input.newCategory === REIMBURSEMENT_CATEGORY) {
      if (transaction.type === TransactionTypeEnum.CREDIT && !input.offsetCategory?.trim()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'offsetCategory is required when assigning Reimbursement to a CREDIT transaction',
        });
      }
    }

    if (input.offsetTransactionId) {
      const linked = await ctx.prisma.transaction.findUnique({
        where: { id: input.offsetTransactionId },
        select: { userId: true, type: true, status: true, category: true },
      });
      if (!linked || linked.userId !== userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Linked transaction not found' });
      }
      if (linked.type !== TransactionTypeEnum.DEBIT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Linked transaction must be a DEBIT',
        });
      }
      // Allow CONFIRMED expenses AND EXCLUDED DEBITs already marked as Reimbursement (awaiting payback)
      const isConfirmedExpense = linked.status === TransactionStatusEnum.CONFIRMED;
      const isAwaitingPayback =
        linked.status === TransactionStatusEnum.EXCLUDED &&
        linked.category === REIMBURSEMENT_CATEGORY;
      if (!isConfirmedExpense && !isAwaitingPayback) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Linked transaction must be a confirmed expense or a DEBIT awaiting reimbursement',
        });
      }
    }

    let newStatus: TransactionStatusEnum = transaction.status;
    let newConfirmedAt: Date | undefined;

    if (input.newCategory === REIMBURSEMENT_CATEGORY) {
      if (transaction.type === TransactionTypeEnum.CREDIT && transaction.status === TransactionStatusEnum.EXCLUDED) {
        // CREDIT Reimbursement: promote to CONFIRMED (someone paid you back)
        newStatus = TransactionStatusEnum.CONFIRMED;
        newConfirmedAt = new Date();
      } else if (transaction.type === TransactionTypeEnum.DEBIT && transaction.status === TransactionStatusEnum.CONFIRMED) {
        // DEBIT Reimbursement: demote to EXCLUDED (awaiting payback; remove from expense reports)
        newStatus = TransactionStatusEnum.EXCLUDED;
      }
    } else if (
      transaction.category === REIMBURSEMENT_CATEGORY &&
      input.newCategory !== REIMBURSEMENT_CATEGORY
    ) {
      if (transaction.type === TransactionTypeEnum.CREDIT && transaction.status === TransactionStatusEnum.CONFIRMED) {
        newStatus = TransactionStatusEnum.EXCLUDED;
      } else if (transaction.type === TransactionTypeEnum.DEBIT && transaction.status === TransactionStatusEnum.EXCLUDED) {
        // Restoring DEBIT from Reimbursement → promote back to CONFIRMED
        newStatus = TransactionStatusEnum.CONFIRMED;
        newConfirmedAt = new Date();
      }
    } else if (
      transaction.category === TRANSFER_CATEGORY &&
      input.newCategory !== TRANSFER_CATEGORY &&
      transaction.status === TransactionStatusEnum.EXCLUDED
    ) {
      // User is reclassifying a Transfer (DEBIT or CREDIT) as a real category → promote to CONFIRMED
      newStatus = TransactionStatusEnum.CONFIRMED;
      newConfirmedAt = new Date();
    } else if (
      transaction.category !== TRANSFER_CATEGORY &&
      input.newCategory === TRANSFER_CATEGORY &&
      transaction.type === TransactionTypeEnum.DEBIT &&
      transaction.status === TransactionStatusEnum.CONFIRMED
    ) {
      // User is re-classifying a confirmed DEBIT back to Transfer → exclude it
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
      if (transaction.type === TransactionTypeEnum.CREDIT && input.offsetCategory) {
        // CREDIT Reimbursement: decrement the offset expense category
        await applyReimbursementOffset({
          prismaClient: ctx.prisma,
          userId,
          offsetCategory: input.offsetCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      } else if (
        transaction.type === TransactionTypeEnum.DEBIT &&
        transaction.status === TransactionStatusEnum.CONFIRMED
      ) {
        // DEBIT Reimbursement: remove from expense roll-up (awaiting payback)
        await rerollupExpenseSummary({
          prismaClient: ctx.prisma,
          userId,
          oldCategory: transaction.category,
          newCategory: REIMBURSEMENT_CATEGORY, // not an expense category; effectively just decrements old
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      }
    } else if (transaction.category === REIMBURSEMENT_CATEGORY && input.newCategory !== REIMBURSEMENT_CATEGORY) {
      if (transaction.type === TransactionTypeEnum.CREDIT && transaction.offsetCategory) {
        // CREDIT Reimbursement removed: restore the expense offset
        await reverseReimbursementOffset({
          prismaClient: ctx.prisma,
          userId,
          offsetCategory: transaction.offsetCategory,
          amount: transaction.amount as Decimal,
          date: transaction.date,
        });
      } else if (
        transaction.type === TransactionTypeEnum.DEBIT &&
        newStatus === TransactionStatusEnum.CONFIRMED
      ) {
        // DEBIT Reimbursement removed: restore the expense roll-up entry
        await rerollupExpenseSummary({
          prismaClient: ctx.prisma,
          userId,
          oldCategory: REIMBURSEMENT_CATEGORY, // no existing expense entry; just creates for new
          newCategory: input.newCategory,
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
      transaction.category === TRANSFER_CATEGORY &&
      input.newCategory !== TRANSFER_CATEGORY &&
      transaction.type === TransactionTypeEnum.DEBIT &&
      newStatus === TransactionStatusEnum.CONFIRMED
    ) {
      // Transfer DEBIT promoted to a real expense → create its expense summary entry
      await rerollupExpenseSummary({
        prismaClient: ctx.prisma,
        userId,
        oldCategory: TRANSFER_CATEGORY, // no expense entry exists for Transfer; nothing to decrement
        newCategory: input.newCategory,
        amount: transaction.amount as Decimal,
        date: transaction.date,
      });
    } else if (
      transaction.category !== TRANSFER_CATEGORY &&
      input.newCategory === TRANSFER_CATEGORY &&
      transaction.type === TransactionTypeEnum.DEBIT &&
      newStatus === TransactionStatusEnum.EXCLUDED
    ) {
      // Confirmed DEBIT re-classified as Transfer → remove its expense summary entry
      await rerollupExpenseSummary({
        prismaClient: ctx.prisma,
        userId,
        oldCategory: transaction.category,
        newCategory: TRANSFER_CATEGORY, // not an expense category; effectively just decrements old
        amount: transaction.amount as Decimal,
        date: transaction.date,
      });
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
        newSourceName: input.newCategory,
        amount: transaction.amount as Decimal,
        transactionDate: transaction.date,
      });
    }

    // Auto-apply to matching transactions (same description + user, different category)
    // Skipped when: applyToMatching is explicitly false (review-batch correction),
    //   or when the new category is Reimbursement/Transfer (complex special logic — not safe to batch)
    const matchedIds: string[] = [];
    const isSpecialCategory =
      input.newCategory === REIMBURSEMENT_CATEGORY || input.newCategory === TRANSFER_CATEGORY;

    if (input.applyToMatching !== false && !isSpecialCategory) {
      const matches = await ctx.prisma.transaction.findMany({
        where: {
          userId,
          description: transaction.description,
          id: { not: transaction.id },
          category: { not: input.newCategory },
          status: { not: TransactionStatusEnum.VOIDED },
        },
        select: {
          id: true,
          userId: true,
          type: true,
          status: true,
          category: true,
          amount: true,
          date: true,
        },
      });

      for (const match of matches) {
        const matchCategoryChanged = match.category !== input.newCategory;
        if (!matchCategoryChanged) continue;

        await ctx.prisma.transaction.update({
          where: { id: match.id },
          data: {
            category: input.newCategory,
            source: TransactionSourceEnum.USER_OVERRIDE,
          },
        });

        if (
          match.type === TransactionTypeEnum.DEBIT &&
          match.status === TransactionStatusEnum.CONFIRMED
        ) {
          await rerollupExpenseSummary({
            prismaClient: ctx.prisma,
            userId,
            oldCategory: match.category,
            newCategory: input.newCategory,
            amount: match.amount as Decimal,
            date: match.date,
          });
        } else if (
          match.type === TransactionTypeEnum.CREDIT &&
          match.status === TransactionStatusEnum.CONFIRMED
        ) {
          await updateIncomeRecordSource({
            prismaClient: ctx.prisma,
            userId,
            newSourceName: input.newCategory,
            amount: match.amount as Decimal,
            transactionDate: match.date,
          });
        }

        matchedIds.push(match.id);
      }
    }

    return { success: true, matchedIds };
  }),

  searchDebitTransactions: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(50),
        dateFrom: z.string().optional(), // ISO date string YYYY-MM-DD
        dateTo: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const transactions = await ctx.prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionTypeEnum.DEBIT,
          // Include confirmed expenses AND DEBITs already marked as Reimbursement (awaiting payback)
          OR: [
            { status: TransactionStatusEnum.CONFIRMED },
            { status: TransactionStatusEnum.EXCLUDED, category: REIMBURSEMENT_CATEGORY },
          ],
          reimbursements: { none: {} }, // exclude DEBITs that already have a reimbursement CREDIT linked
          ...(input.search?.trim()
            ? {
                OR: [
                  { description: { contains: input.search.trim(), mode: 'insensitive' } },
                  { category: { contains: input.search.trim(), mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(input.dateFrom || input.dateTo
            ? {
                date: {
                  ...(input.dateFrom ? { gte: new Date(`${input.dateFrom}T00:00:00`) } : {}),
                  ...(input.dateTo ? { lte: new Date(`${input.dateTo}T23:59:59`) } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ date: 'desc' }],
        take: input.limit,
        select: { id: true, date: true, description: true, amount: true, category: true, importSession: { select: { id: true, createdAt: true } } },
      });
      return transactions.map((tx) => ({
        id: tx.id,
        date: tx.date.toISOString().slice(0, 10),
        description: tx.description,
        amount: Number(tx.amount),
        category: tx.category,
        importSource: tx.importSession
          ? { id: tx.importSession.id, createdAt: tx.importSession.createdAt.toISOString() }
          : undefined,
      }));
    }),

  getUnlinkedDonationTransactions: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string(), // ISO date string YYYY-MM-DD
        dateTo: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const dateFrom = new Date(`${input.dateFrom}T00:00:00`);
      const dateTo = new Date(`${input.dateTo}T23:59:59`);
      return getUnlinkedDonationTransactions(userId, dateFrom, dateTo);
    }),

  getUnlinkedZakatTransactions: protectedProcedure
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
    }),

  getVoidedTransactions: protectedProcedure
    .input(
      z.object({
        importSessionId: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        page: z.number().int().min(1).default(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const where: Prisma.TransactionWhereInput = {
        userId,
        status: TransactionStatusEnum.VOIDED,
        ...(input.importSessionId && { importSessionId: input.importSessionId }),
      };

      const [transactions, total] = await Promise.all([
        ctx.prisma.transaction.findMany({
          where,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: {
            id: true,
            date: true,
            description: true,
            amount: true,
            type: true,
            category: true,
            status: true,
            importSessionId: true,
            createdAt: true,
          },
        }),
        ctx.prisma.transaction.count({ where }),
      ]);

      return {
        transactions: transactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString(),
          description: tx.description,
          amount: Number(tx.amount),
          type: tx.type,
          category: tx.category,
          status: tx.status,
          importSessionId: tx.importSessionId,
          createdAt: tx.createdAt.toISOString(),
        })),
        total,
        page: input.page,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
      };
    }),

  restoreVoidedTransaction: protectedProcedure
    .input(z.object({ transactionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const transaction = await ctx.prisma.transaction.findUnique({
        where: { id: input.transactionId },
        select: { userId: true, status: true, id: true },
      });

      if (!transaction || transaction.userId !== userId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      if (transaction.status !== TransactionStatusEnum.VOIDED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only VOIDED transactions can be restored',
        });
      }

      await ctx.prisma.transaction.update({
        where: { id: input.transactionId },
        data: { status: TransactionStatusEnum.PENDING },
      });

      return { success: true };
    }),
});


