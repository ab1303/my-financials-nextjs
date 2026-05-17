import { type PrismaClient, TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { TransferCandidateScore, TransferLinkResult, TransferUnlinkResult } from './_types';
import { TRANSFER_CATEGORY } from './constants';
import { rerollupExpenseSummary } from './ledger.service';

export const TRANSFER_DATE_TOLERANCE_DAYS = 5;
export const TRANSFER_AMOUNT_FEE_TOLERANCE = 10;

/**
 * Score a potential transfer match candidate.
 * Returns 0-100 composite score.
 */
export function scoreCandidate(params: {
  sourceAmount: Decimal;
  sourceDate: Date;
  sourceBankId: string | null;
  candidate: {
    amount: Decimal;
    date: Date;
    description: string;
    bankAccountId: string;
    bankId: string | null;
  };
  sourceDescription: string;
}): { score: number; breakdown: TransferCandidateScore['scoreBreakdown']; amountDiffWarning: string | null } {
  // Amount match (0–40)
  const amountDiff = Math.abs(Number(params.sourceAmount) - Number(params.candidate.amount));
  const amountMatch = amountDiff === 0 ? 40 : amountDiff <= TRANSFER_AMOUNT_FEE_TOLERANCE ? 20 : 0;
  const amountDiffWarning =
    amountDiff > 0 && amountDiff <= TRANSFER_AMOUNT_FEE_TOLERANCE
      ? `Amounts differ by $${amountDiff.toFixed(2)} (possible transfer fee)`
      : null;

  // Date proximity (0–30): full score ≤1 day, scaled to 0 at 5 days
  const daysDiff = Math.abs((params.sourceDate.getTime() - params.candidate.date.getTime()) / 86_400_000);
  const dateProximity =
    daysDiff === 0 ? 30 : Math.max(0, Math.round(30 * (1 - daysDiff / TRANSFER_DATE_TOLERANCE_DAYS)));

  // Description similarity (0–20): keyword overlap heuristic
  const sourceWords = new Set(params.sourceDescription.toLowerCase().split(/\W+/).filter(Boolean));
  const candidateWords = params.candidate.description.toLowerCase().split(/\W+/).filter(Boolean);
  const overlap = candidateWords.filter((w) => sourceWords.has(w)).length;
  const descriptionSimilarity = Math.min(20, Math.round((overlap / Math.max(sourceWords.size, 1)) * 20));

  // Same bank bonus (0–10)
  const sameBankBonus =
    params.sourceBankId && params.sourceBankId === params.candidate.bankId ? 10 : 0;

  const score = amountMatch + dateProximity + descriptionSimilarity + sameBankBonus;
  return {
    score,
    breakdown: { amountMatch, dateProximity, descriptionSimilarity, sameBankBonus },
    amountDiffWarning,
  };
}

/**
 * Return scored transfer match candidates for a given transaction.
 * Only returns candidates from OTHER bank accounts.
 * Excludes already-linked transactions.
 * Minimum score of 20 to be returned.
 */
export async function getCandidates(params: {
  prisma: PrismaClient;
  transactionId: string;
  userId: string;
}): Promise<TransferCandidateScore[]> {
  const source = await params.prisma.transaction.findUnique({
    where: { id: params.transactionId, userId: params.userId },
    // @ts-ignore — new relation fields not yet in generated client
    include: { bankAccount: { include: { bank: true } } },
  });

  if (!source || !source.bankAccountId) return [];

  const counterType =
    source.type === TransactionTypeEnum.DEBIT
      ? TransactionTypeEnum.CREDIT
      : TransactionTypeEnum.DEBIT;

  const dateFrom = new Date(source.date);
  dateFrom.setDate(dateFrom.getDate() - TRANSFER_DATE_TOLERANCE_DAYS);
  const dateTo = new Date(source.date);
  dateTo.setDate(dateTo.getDate() + TRANSFER_DATE_TOLERANCE_DAYS);

  const candidates = await (params.prisma.transaction as any).findMany({
    where: {
      userId: params.userId,
      type: counterType,
      category: TRANSFER_CATEGORY,
      transferLinkedTransactionId: null,
      transferCounterpart: { is: null },
      bankAccountId: { not: source.bankAccountId },
      date: { gte: dateFrom, lte: dateTo },
    },
    include: { bankAccount: { include: { bank: true } } },
  }) as Array<{
    id: string;
    amount: Decimal;
    date: Date;
    description: string;
    type: TransactionTypeEnum;
    status: TransactionStatusEnum;
    bankAccountId: string | null;
    bankAccount: { name: string; bankId: string; bank: { name: string | null } | null } | null;
  }>;

  // @ts-ignore — bankId on bankAccount available after migration
  const sourceBankId: string | null = (source as any).bankAccount?.bankId ?? null;

  return candidates
    .map((candidate) => {
      const { score, breakdown, amountDiffWarning } = scoreCandidate({
        sourceAmount: source.amount,
        sourceDate: source.date,
        sourceBankId,
        sourceDescription: source.description,
        candidate: {
          amount: candidate.amount,
          date: candidate.date,
          description: candidate.description,
          bankAccountId: candidate.bankAccountId!,
          bankId: candidate.bankAccount?.bankId ?? null,
        },
      });
      return {
        transactionId: candidate.id,
        bankAccountId: candidate.bankAccountId!,
        bankAccountName: candidate.bankAccount?.name ?? 'Unknown',
        bankName: candidate.bankAccount?.bank?.name ?? null,
        date: candidate.date.toISOString(),
        description: candidate.description,
        amount: Number(candidate.amount),
        type: candidate.type,
        status: candidate.status,
        confidenceScore: score,
        scoreBreakdown: breakdown,
        amountDiffWarning,
      } satisfies TransferCandidateScore;
    })
    .filter((c) => c.confidenceScore >= 20)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Link two transactions as a transfer pair.
 * - Both must belong to the same user
 * - One must be DEBIT, the other CREDIT
 * - They must be from different bank accounts
 * - Neither can already be linked
 */
export async function linkTransferPair(params: {
  prisma: PrismaClient;
  debitTransactionId: string;
  creditTransactionId: string;
  userId: string;
}): Promise<TransferLinkResult> {
  const [debit, credit] = await Promise.all([
    params.prisma.transaction.findUnique({
      where: { id: params.debitTransactionId, userId: params.userId },
    }),
    params.prisma.transaction.findUnique({
      where: { id: params.creditTransactionId, userId: params.userId },
    }),
  ]);

  if (!debit || !credit) throw new Error('Transaction not found');
  if (debit.type !== TransactionTypeEnum.DEBIT) throw new Error('First transaction must be DEBIT');
  if (credit.type !== TransactionTypeEnum.CREDIT)
    throw new Error('Second transaction must be CREDIT');
  if (debit.bankAccountId === credit.bankAccountId)
    throw new Error('Transfer pairs must be from different accounts');

  // @ts-ignore — new fields not in generated client yet
  if ((debit as any).transferLinkedTransactionId ?? (credit as any).transferLinkedTransactionId) {
    throw new Error('One or both transactions are already linked to a transfer pair');
  }

  let rollupReversed = false;
  let incomeRecordDeleted = false;

  await params.prisma.$transaction(async (tx) => {
    // Store pre-link state and mark debit as Transfer/EXCLUDED
    await (tx.transaction as any).update({
      where: { id: debit.id },
      data: {
        transferLinkedTransactionId: credit.id,
        preLinkCategory: debit.category,
        preLinkStatus: debit.status,
        category: TRANSFER_CATEGORY,
        status: TransactionStatusEnum.EXCLUDED,
      },
    });

    // Store pre-link state and mark credit as Transfer/EXCLUDED
    await (tx.transaction as any).update({
      where: { id: credit.id },
      data: {
        preLinkCategory: credit.category,
        preLinkStatus: credit.status,
        category: TRANSFER_CATEGORY,
        status: TransactionStatusEnum.EXCLUDED,
      },
    });

    // Reverse expense rollup if debit was previously CONFIRMED
    if (
      debit.status === TransactionStatusEnum.CONFIRMED &&
      debit.category !== TRANSFER_CATEGORY
    ) {
      await rerollupExpenseSummary({
        prismaClient: tx as unknown as PrismaClient,
        userId: params.userId,
        oldCategory: debit.category,
        newCategory: TRANSFER_CATEGORY,
        amount: debit.amount,
        date: debit.date,
      });
      rollupReversed = true;
    }

    // Delete orphaned IncomeRecord if credit was previously CONFIRMED
    if (credit.status === TransactionStatusEnum.CONFIRMED) {
      const deleted = await tx.incomeRecord.deleteMany({
        where: { transactionId: credit.id },
      });
      incomeRecordDeleted = deleted.count > 0;
    }
  });

  return {
    debitTransactionId: debit.id,
    creditTransactionId: credit.id,
    linkedAt: new Date(),
    rollupReversed,
    incomeRecordDeleted,
  };
}

/**
 * Unlink a transfer pair, reverting both transactions to their pre-link state.
 */
export async function unlinkTransferPair(params: {
  prisma: PrismaClient;
  transactionId: string; // either side of the pair
  userId: string;
}): Promise<TransferUnlinkResult> {
  const txRecord = await (params.prisma.transaction as any).findUnique({
    where: { id: params.transactionId, userId: params.userId },
    include: { transferLinkedTransaction: true, transferCounterpart: true },
  }) as {
    id: string;
    type: TransactionTypeEnum;
    status: TransactionStatusEnum;
    category: string;
    amount: Decimal;
    date: Date;
    preLinkCategory: string | null;
    preLinkStatus: TransactionStatusEnum | null;
    transferLinkedTransactionId: string | null;
    transferLinkedTransaction: {
      id: string;
      type: TransactionTypeEnum;
      status: TransactionStatusEnum;
      category: string;
      amount: Decimal;
      date: Date;
      preLinkCategory: string | null;
      preLinkStatus: TransactionStatusEnum | null;
    } | null;
    transferCounterpart: {
      id: string;
      type: TransactionTypeEnum;
      status: TransactionStatusEnum;
      category: string;
      amount: Decimal;
      date: Date;
      preLinkCategory: string | null;
      preLinkStatus: TransactionStatusEnum | null;
    } | null;
  } | null;

  if (!txRecord) throw new Error('Transaction not found');

  const debit =
    txRecord.type === TransactionTypeEnum.DEBIT ? txRecord : txRecord.transferCounterpart;
  const credit =
    txRecord.type === TransactionTypeEnum.CREDIT ? txRecord : txRecord.transferLinkedTransaction;

  if (!debit || !credit) throw new Error('Transfer pair is incomplete');

  let rollupRestored = false;

  await params.prisma.$transaction(async (prismaClient) => {
    // Restore debit
    await (prismaClient.transaction as any).update({
      where: { id: debit.id },
      data: {
        transferLinkedTransactionId: null,
        category: debit.preLinkCategory ?? debit.category,
        status: debit.preLinkStatus ?? debit.status,
        preLinkCategory: null,
        preLinkStatus: null,
      },
    });

    // Restore credit
    await (prismaClient.transaction as any).update({
      where: { id: credit.id },
      data: {
        preLinkCategory: null,
        preLinkStatus: null,
        category: credit.preLinkCategory ?? credit.category,
        status: credit.preLinkStatus ?? credit.status,
      },
    });

    // Re-add to expense rollup if debit was previously CONFIRMED
    if (debit.preLinkStatus === TransactionStatusEnum.CONFIRMED && debit.preLinkCategory) {
      await rerollupExpenseSummary({
        prismaClient: prismaClient as unknown as PrismaClient,
        userId: params.userId,
        oldCategory: TRANSFER_CATEGORY,
        newCategory: debit.preLinkCategory,
        amount: debit.amount,
        date: debit.date,
      });
      rollupRestored = true;
    }
  });

  return {
    debitTransactionId: debit.id,
    creditTransactionId: credit.id,
    restoredDebitCategory: debit.preLinkCategory ?? debit.category,
    restoredDebitStatus: debit.preLinkStatus ?? debit.status,
    rollupRestored,
  };
}

/**
 * Return count of unmatched Transfer-classified transactions.
 */
export async function getUnmatchedTransferCount(params: {
  prisma: PrismaClient;
  userId: string;
}): Promise<number> {
  return (params.prisma.transaction as any).count({
    where: {
      userId: params.userId,
      category: TRANSFER_CATEGORY,
      transferLinkedTransactionId: null,
      transferCounterpart: { is: null },
    },
  }) as Promise<number>;
}

const STOP_WORDS = new Set([
  'to',
  'from',
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'in',
  'at',
  'on',
  'for',
  'app',
  'my',
  'your',
  'this',
  'that',
  'with',
  'by',
]);

export interface SimilarPairSuggestion {
  debit: {
    transactionId: string;
    date: string;
    description: string;
    amount: number;
    bankAccountName: string;
    bankName: string | null;
  };
  credit: {
    transactionId: string;
    date: string;
    description: string;
    amount: number;
    bankAccountName: string;
    bankName: string | null;
  };
  confidenceScore: number;
  scoreBreakdown: TransferCandidateScore['scoreBreakdown'];
  dayGap: number;
  amountDiffWarning: string | null;
}

export interface BatchLinkResult {
  linkedCount: number;
  errors: Array<{ debitId: string; creditId: string; message: string }>;
}

export function extractPatternFromPair(params: {
  debit: { description: string; amount: Decimal; date: Date; bankAccountId: string | null; bankId: string | null };
  credit: { description: string; amount: Decimal; date: Date; bankAccountId: string | null; bankId: string | null };
}): {
  amountExact: Decimal;
  debitKeywords: string[];
  creditKeywords: string[];
  maxDayGap: number;
  debitBankAccountId: string | null;
  creditBankAccountId: string | null;
} {
  const extractKeywords = (description: string): string[] =>
    description
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)
      .filter((w) => !STOP_WORDS.has(w) && w.length > 1);

  const dayGap = Math.abs(
    Math.round((params.debit.date.getTime() - params.credit.date.getTime()) / 86_400_000),
  );

  return {
    amountExact: params.debit.amount,
    debitKeywords: extractKeywords(params.debit.description),
    creditKeywords: extractKeywords(params.credit.description),
    maxDayGap: Math.max(dayGap + 2, TRANSFER_DATE_TOLERANCE_DAYS),
    debitBankAccountId: params.debit.bankAccountId,
    creditBankAccountId: params.credit.bankAccountId,
  };
}

export async function findSimilarUnmatchedPairs(params: {
  prisma: PrismaClient;
  userId: string;
  debitTransactionId: string;
  creditTransactionId: string;
}): Promise<SimilarPairSuggestion[]> {
  const [sourceDebit, sourceCredit] = await Promise.all([
    (params.prisma.transaction as any).findUnique({
      where: { id: params.debitTransactionId, userId: params.userId },
      include: { bankAccount: { include: { bank: true } } },
    }),
    (params.prisma.transaction as any).findUnique({
      where: { id: params.creditTransactionId, userId: params.userId },
      include: { bankAccount: { include: { bank: true } } },
    }),
  ]);

  if (!sourceDebit || !sourceCredit) return [];

  const pattern = extractPatternFromPair({
    debit: {
      description: sourceDebit.description,
      amount: sourceDebit.amount,
      date: sourceDebit.date,
      bankAccountId: sourceDebit.bankAccountId,
      bankId: sourceDebit.bankAccount?.bankId ?? null,
    },
    credit: {
      description: sourceCredit.description,
      amount: sourceCredit.amount,
      date: sourceCredit.date,
      bankAccountId: sourceCredit.bankAccountId,
      bankId: sourceCredit.bankAccount?.bankId ?? null,
    },
  });

  const unmatchedDebits = await (params.prisma.transaction as any).findMany({
    where: {
      userId: params.userId,
      type: TransactionTypeEnum.DEBIT,
      category: TRANSFER_CATEGORY,
      transferLinkedTransactionId: null,
      transferCounterpart: { is: null },
      amount: sourceDebit.amount,
      id: { not: sourceDebit.id },
    },
    include: { bankAccount: { include: { bank: true } } },
  });

  const results: SimilarPairSuggestion[] = [];

  for (const debit of unmatchedDebits) {
    const dateFrom = new Date(debit.date);
    dateFrom.setDate(dateFrom.getDate() - pattern.maxDayGap);
    const dateTo = new Date(debit.date);
    dateTo.setDate(dateTo.getDate() + pattern.maxDayGap);

    const creditCandidates = await (params.prisma.transaction as any).findMany({
      where: {
        userId: params.userId,
        type: TransactionTypeEnum.CREDIT,
        category: TRANSFER_CATEGORY,
        transferLinkedTransactionId: null,
        transferCounterpart: { is: null },
        amount: sourceCredit.amount,
        id: { not: sourceCredit.id },
        bankAccountId: { not: debit.bankAccountId },
        date: { gte: dateFrom, lte: dateTo },
      },
      include: { bankAccount: { include: { bank: true } } },
    });

    if (creditCandidates.length === 0) continue;

    let bestCredit: any = null;
    let bestScore = 0;
    let bestBreakdown: TransferCandidateScore['scoreBreakdown'] | null = null;
    let bestAmountDiffWarning: string | null = null;

    for (const credit of creditCandidates) {
      const { score, breakdown, amountDiffWarning } = scoreCandidate({
        sourceAmount: debit.amount,
        sourceDate: debit.date,
        sourceBankId: debit.bankAccount?.bankId ?? null,
        sourceDescription: debit.description,
        candidate: {
          amount: credit.amount,
          date: credit.date,
          description: credit.description,
          bankAccountId: credit.bankAccountId!,
          bankId: credit.bankAccount?.bankId ?? null,
        },
      });
      if (score > bestScore) {
        bestScore = score;
        bestCredit = credit;
        bestBreakdown = breakdown;
        bestAmountDiffWarning = amountDiffWarning;
      }
    }

    if (!bestCredit || bestScore < 20) continue;

    const dayGap = Math.abs(
      Math.round((debit.date.getTime() - bestCredit.date.getTime()) / 86_400_000),
    );

    results.push({
      debit: {
        transactionId: debit.id,
        date: debit.date.toISOString(),
        description: debit.description,
        amount: Number(debit.amount),
        bankAccountName: debit.bankAccount?.name ?? 'Unknown',
        bankName: debit.bankAccount?.bank?.name ?? null,
      },
      credit: {
        transactionId: bestCredit.id,
        date: bestCredit.date.toISOString(),
        description: bestCredit.description,
        amount: Number(bestCredit.amount),
        bankAccountName: bestCredit.bankAccount?.name ?? 'Unknown',
        bankName: bestCredit.bankAccount?.bank?.name ?? null,
      },
      confidenceScore: bestScore,
      scoreBreakdown: bestBreakdown!,
      dayGap,
      amountDiffWarning: bestAmountDiffWarning,
    });
  }

  return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export async function batchLinkTransferPairs(params: {
  prisma: PrismaClient;
  userId: string;
  pairs: Array<{ debitTransactionId: string; creditTransactionId: string }>;
}): Promise<BatchLinkResult> {
  let linkedCount = 0;
  const errors: BatchLinkResult['errors'] = [];

  for (const pair of params.pairs) {
    try {
      await linkTransferPair({
        prisma: params.prisma,
        debitTransactionId: pair.debitTransactionId,
        creditTransactionId: pair.creditTransactionId,
        userId: params.userId,
      });
      linkedCount++;
    } catch (err) {
      errors.push({
        debitId: pair.debitTransactionId,
        creditId: pair.creditTransactionId,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return { linkedCount, errors };
}
