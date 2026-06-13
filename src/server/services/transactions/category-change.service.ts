import { TransactionTypeEnum, TransactionStatusEnum, TransactionSourceEnum } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { TRPCError } from '@trpc/server';
import { 
  REIMBURSEMENT_CATEGORY, 
  TRANSFER_CATEGORY 
} from '@/server/services/transactions/constants';
import { 
  rerollupExpenseSummary, 
  updateIncomeRecordSource, 
  applyReimbursementOffset, 
  reverseReimbursementOffset 
} from '@/server/services/transactions/ledger.service';

interface Context {
  prismaClient: any;
  userId: string;
  transaction: any;
  newCategory: string;
  newStatus: TransactionStatusEnum;
  offsetCategory?: string | null;
  amount: Decimal;
}

export async function validateCategoryChange(ctx: {
  prismaClient: any;
  userId: string;
  transaction: any;
  input: any;
}) {
  const { prismaClient, userId, transaction, input } = ctx;

  if (input.newCategory === REIMBURSEMENT_CATEGORY) {
    if (transaction.type === TransactionTypeEnum.CREDIT && !input.offsetCategory?.trim()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'offsetCategory is required when assigning Reimbursement to a CREDIT transaction',
      });
    }
  }

  if (input.offsetTransactionId) {
    const linked = await prismaClient.transaction.findUnique({
      where: { id: input.offsetTransactionId },
      select: { userId: true, type: true, status: true, category: true, description: true },
    });
    if (!linked || linked.userId !== userId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Linked transaction not found' });
    }
    if (linked.type !== TransactionTypeEnum.DEBIT) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Linked transaction must be a DEBIT' });
    }
    const isConfirmedExpense = linked.status === TransactionStatusEnum.CONFIRMED;
    const isAwaitingPayback = linked.status === TransactionStatusEnum.EXCLUDED && linked.category === REIMBURSEMENT_CATEGORY;
    if (!isConfirmedExpense && !isAwaitingPayback) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Linked transaction must be a confirmed expense or a DEBIT awaiting reimbursement',
      });
    }
  }
}

async function handleReimbursementTransition(ctx: Context) {
  const { prismaClient, userId, transaction, newCategory, offsetCategory, amount } = ctx;

  // Transition TO Reimbursement
  if (transaction.category !== REIMBURSEMENT_CATEGORY && newCategory === REIMBURSEMENT_CATEGORY) {
    if (transaction.type === TransactionTypeEnum.CREDIT && offsetCategory) {
      await applyReimbursementOffset({ prismaClient, userId, offsetCategory, amount, date: transaction.date });
    } else if (transaction.type === TransactionTypeEnum.DEBIT && transaction.status === TransactionStatusEnum.CONFIRMED) {
      await rerollupExpenseSummary({ prismaClient, userId, oldCategory: transaction.category, newCategory: REIMBURSEMENT_CATEGORY, amount, date: transaction.date });
    }
    return true;
  }

  // Transition FROM Reimbursement
  if (transaction.category === REIMBURSEMENT_CATEGORY && newCategory !== REIMBURSEMENT_CATEGORY) {
    if (transaction.type === TransactionTypeEnum.CREDIT && transaction.offsetCategory) {
      await reverseReimbursementOffset({ prismaClient, userId, offsetCategory: transaction.offsetCategory, amount, date: transaction.date });
    } else if (transaction.type === TransactionTypeEnum.DEBIT && ctx.newStatus === TransactionStatusEnum.CONFIRMED) {
      await rerollupExpenseSummary({ prismaClient, userId, oldCategory: REIMBURSEMENT_CATEGORY, newCategory, amount, date: transaction.date });
    }
    return true;
  }

  // Modify Reimbursement Offset Category
  if (transaction.category === REIMBURSEMENT_CATEGORY && newCategory === REIMBURSEMENT_CATEGORY) {
    const offsetCatChanged = transaction.offsetCategory !== (offsetCategory ?? null);
    if (offsetCatChanged) {
      if (transaction.offsetCategory) {
        await reverseReimbursementOffset({ prismaClient, userId, offsetCategory: transaction.offsetCategory, amount, date: transaction.date });
      }
      if (offsetCategory) {
        await applyReimbursementOffset({ prismaClient, userId, offsetCategory, amount, date: transaction.date });
      }
    }
    return true;
  }

  return false;
}

async function handleTransferTransition(ctx: Context) {
  const { prismaClient, userId, transaction, newCategory, newStatus, amount } = ctx;

  // Transfer DEBIT promoted to expense
  if (transaction.category === TRANSFER_CATEGORY && newCategory !== TRANSFER_CATEGORY && transaction.type === TransactionTypeEnum.DEBIT && newStatus === TransactionStatusEnum.CONFIRMED) {
    await rerollupExpenseSummary({ prismaClient, userId, oldCategory: TRANSFER_CATEGORY, newCategory, amount, date: transaction.date });
    return true;
  }

  // Confirmed DEBIT re-classified as Transfer
  if (transaction.category !== TRANSFER_CATEGORY && newCategory === TRANSFER_CATEGORY && transaction.type === TransactionTypeEnum.DEBIT && newStatus === TransactionStatusEnum.EXCLUDED) {
    await rerollupExpenseSummary({ prismaClient, userId, oldCategory: transaction.category, newCategory: TRANSFER_CATEGORY, amount, date: transaction.date });
    return true;
  }

  return false;
}

async function handleGenericCategoryChange(ctx: Context) {
  const { prismaClient, userId, transaction, newCategory, newStatus, amount } = ctx;
  const categoryChanged = transaction.category !== newCategory;

  // DEBIT category change
  if (transaction.type === TransactionTypeEnum.DEBIT && transaction.status === TransactionStatusEnum.CONFIRMED && categoryChanged) {
    await rerollupExpenseSummary({ prismaClient, userId, oldCategory: transaction.category, newCategory, amount, date: transaction.date });
    return true;
  }

  // CREDIT category change
  if (transaction.type === TransactionTypeEnum.CREDIT && transaction.status === TransactionStatusEnum.CONFIRMED && transaction.category !== REIMBURSEMENT_CATEGORY && newCategory !== REIMBURSEMENT_CATEGORY && categoryChanged) {
    await updateIncomeRecordSource({ prismaClient, userId, newSourceName: newCategory, amount, transactionDate: transaction.date });
    return true;
  }

  return false;
}

export async function applyMatchingCategoryChanges(ctx: {
  prismaClient: any;
  userId: string;
  transaction: any;
  newCategory: string;
  applyToMatching?: boolean;
  matchScope?: { type: 'recent' | 'all'; days?: number };
}): Promise<string[]> {
  const { prismaClient, userId, transaction, newCategory, applyToMatching, matchScope } = ctx;
  const matchedIds: string[] = [];
  const isSpecialCategory = newCategory === REIMBURSEMENT_CATEGORY || newCategory === TRANSFER_CATEGORY;

  // New Safety: Explicitly require flag to run, and skip for special categories
  if (applyToMatching !== true || isSpecialCategory) {
    return matchedIds;
  }

  // Define date scope
  const dateFilter: any = {};
  if (matchScope?.type === 'recent') {
    const days = matchScope.days ?? 90;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    dateFilter.gte = dateLimit.toISOString();
  }

  const matches = await prismaClient.transaction.findMany({
    where: {
      userId,
      description: transaction.description,
      id: { not: transaction.id },
      category: { not: newCategory },
      status: { not: TransactionStatusEnum.VOIDED },
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    },
    select: { id: true, type: true, status: true, category: true, amount: true, date: true },
  });

  for (const match of matches) {
    await prismaClient.transaction.update({
      where: { id: match.id },
      data: { category: newCategory, source: TransactionSourceEnum.USER_OVERRIDE },
    });

    if (match.status === TransactionStatusEnum.CONFIRMED) {
      if (match.type === TransactionTypeEnum.DEBIT) {
        await rerollupExpenseSummary({
          prismaClient,
          userId,
          oldCategory: match.category,
          newCategory,
          amount: match.amount as Decimal,
          date: match.date,
        });
      } else if (match.type === TransactionTypeEnum.CREDIT) {
        await updateIncomeRecordSource({
          prismaClient,
          userId,
          newSourceName: newCategory,
          amount: match.amount as Decimal,
          transactionDate: match.date,
        });
      }
    }
    matchedIds.push(match.id);
  }

  return matchedIds;
}

export async function handleCategoryChange({
  prismaClient,
  userId,
  transaction,
  newCategory,
  newStatus,
  offsetCategory,
}: {
  prismaClient: any;
  userId: string;
  transaction: any;
  newCategory: string;
  newStatus: TransactionStatusEnum;
  offsetCategory?: string | null;
}): Promise<void> {
  const ctx: Context = {
    prismaClient,
    userId,
    transaction,
    newCategory,
    newStatus,
    offsetCategory,
    amount: transaction.amount as Decimal,
  };

  if (await handleReimbursementTransition(ctx)) return;
  if (await handleTransferTransition(ctx)) return;
  await handleGenericCategoryChange(ctx);
}
