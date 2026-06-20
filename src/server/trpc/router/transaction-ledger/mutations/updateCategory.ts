import { TransactionSourceEnum, TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { REIMBURSEMENT_CATEGORY, TRANSFER_CATEGORY } from '@/server/services/transactions/constants';
import { rerollupExpenseSummary, updateIncomeRecordSource } from '@/server/services/transactions/ledger.service';
import { handleCategoryChange, validateCategoryChange, applyMatchingCategoryChanges } from '@/server/services/transactions/category-change.service';
import { determineNewStatus } from '@/server/services/transactions/transaction-status.service';
import { protectedProcedure } from '@/server/trpc/trpc';

const updateCategorySchema = z.object({
  id: z.string().min(1),
  newCategory: z.string().min(1),
  offsetCategory: z.string().optional(),
  offsetTransactionId: z.string().optional(),
  applyToMatching: z.boolean().optional(),
  matchScope: z.object({ type: z.enum(['recent', 'all']), days: z.number().optional() }).optional(),
  selectedTransactionIds: z.array(z.string()).optional(),
});

export const updateCategoryMutation = protectedProcedure
  .input(updateCategorySchema)
  .mutation(async ({ ctx, input }) => {
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

    await validateCategoryChange({
      prismaClient: ctx.prisma,
      userId,
      transaction,
      input,
    });

    let newStatus: TransactionStatusEnum = transaction.status;
    const statusResult = determineNewStatus(transaction, input);
    newStatus = statusResult.newStatus;
    const newConfirmedAt = statusResult.newConfirmedAt;

    await ctx.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        category: input.newCategory,
        source: TransactionSourceEnum.USER_OVERRIDE,
        status: newStatus,
        ...(newConfirmedAt ? { confirmedAt: newConfirmedAt } : {}),
        offsetCategory:
          input.newCategory === REIMBURSEMENT_CATEGORY
            ? (input.offsetCategory ?? null)
            : null,
        offsetTransactionId:
          input.newCategory === REIMBURSEMENT_CATEGORY
            ? (input.offsetTransactionId ?? null)
            : null,
      },
    });

    await handleCategoryChange({
      prismaClient: ctx.prisma,
      userId,
      transaction,
      newCategory: input.newCategory,
      newStatus,
      offsetCategory: input.offsetCategory,
    });

    const matchedIds = await applyMatchingCategoryChanges({
      prismaClient: ctx.prisma,
      userId,
      transaction,
      newCategory: input.newCategory,
      applyToMatching: input.applyToMatching,
      matchScope: input.matchScope,
      selectedTransactionIds: input.selectedTransactionIds,
    });

    if (matchedIds.length > 0) {
      matchedIds.unshift(transaction.id);
    }
    return { success: true, matchedIds };
  });
