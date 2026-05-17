import type { PrismaClient } from '@prisma/client';
import { TransactionTypeEnum } from '@prisma/client';
import { TRANSFER_CATEGORY } from './constants';
import { linkTransferPair, scoreCandidate } from './transfer.service';

export interface JobSummary {
  rulesRan: number;
  autoLinkedCount: number;
  flaggedCount: number;
  skippedCount: number;
  jobResultIds: string[];
}

export async function runTransferMatchRules(params: {
  prisma: PrismaClient;
  userId: string;
  importSessionId: string;
}): Promise<JobSummary> {
  const { prisma, userId, importSessionId } = params;

  const activeRules = await (prisma.transferMatchRule as any).findMany({
    where: { userId, isActive: true },
  });

  if (activeRules.length === 0) {
    return {
      rulesRan: 0,
      autoLinkedCount: 0,
      flaggedCount: 0,
      skippedCount: 0,
      jobResultIds: [],
    };
  }

  const newTransactions = await (prisma.transaction as any).findMany({
    where: {
      userId,
      importSessionId,
      category: TRANSFER_CATEGORY,
      transferLinkedTransactionId: null,
      transferCounterpart: { is: null },
    },
    include: { bankAccount: { include: { bank: true } } },
  });

  let totalAutoLinked = 0;
  let totalFlagged = 0;
  let totalSkipped = 0;
  const jobResultIds: string[] = [];

  for (const rule of activeRules) {
    let ruleAutoLinked = 0;
    let ruleFlagged = 0;
    let ruleSkipped = 0;

    const debits = newTransactions.filter(
      (tx: any) =>
        tx.type === TransactionTypeEnum.DEBIT &&
        (!rule.debitBankAccountId || tx.bankAccountId === rule.debitBankAccountId) &&
        (rule.amountExact ? Math.abs(Number(tx.amount) - Number(rule.amountExact)) < 0.01 : true),
    );

    for (const debit of debits) {
      const freshDebit = await (prisma.transaction as any).findUnique({
        where: { id: debit.id },
        select: { transferLinkedTransactionId: true, transferCounterpart: true },
      });
      if (freshDebit?.transferLinkedTransactionId || freshDebit?.transferCounterpart) {
        ruleSkipped++;
        continue;
      }

      const dateFrom = new Date(debit.date);
      dateFrom.setDate(dateFrom.getDate() - rule.maxDayGap);
      const dateTo = new Date(debit.date);
      dateTo.setDate(dateTo.getDate() + rule.maxDayGap);

      const creditCandidates = await (prisma.transaction as any).findMany({
        where: {
          userId,
          type: TransactionTypeEnum.CREDIT,
          category: TRANSFER_CATEGORY,
          transferLinkedTransactionId: null,
          transferCounterpart: { is: null },
          ...(rule.creditBankAccountId && { bankAccountId: rule.creditBankAccountId }),
          ...(rule.amountExact && { amount: rule.amountExact }),
          bankAccountId: { not: debit.bankAccountId },
          date: { gte: dateFrom, lte: dateTo },
        },
        include: { bankAccount: { include: { bank: true } } },
      });

      let bestCredit: any = null;
      let bestScore = 0;

      for (const credit of creditCandidates) {
        const { score } = scoreCandidate({
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

        const debitWords = new Set(debit.description.toLowerCase().split(/\W+/).filter(Boolean));
        const keywordIntersection = rule.debitKeywords.filter((kw: string) =>
          debitWords.has(kw),
        ).length;
        const boostedScore = Math.min(100, score + Math.min(10, keywordIntersection * 2));

        if (boostedScore > bestScore) {
          bestScore = boostedScore;
          bestCredit = credit;
        }
      }

      if (!bestCredit) {
        ruleSkipped++;
        continue;
      }

      if (bestScore >= rule.confidenceThreshold) {
        try {
          await linkTransferPair({
            prisma,
            debitTransactionId: debit.id,
            creditTransactionId: bestCredit.id,
            userId,
          });
          ruleAutoLinked++;
        } catch {
          ruleSkipped++;
        }
      } else if (bestScore >= 40) {
        ruleFlagged++;
      } else {
        ruleSkipped++;
      }
    }

    const jobResult = await (prisma.transferMatchJobResult as any).create({
      data: {
        userId,
        importSessionId,
        ruleId: rule.id,
        autoLinkedCount: ruleAutoLinked,
        flaggedCount: ruleFlagged,
        skippedCount: ruleSkipped,
      },
    });

    if (ruleAutoLinked > 0) {
      await (prisma.transferMatchRule as any).update({
        where: { id: rule.id },
        data: {
          matchCount: { increment: ruleAutoLinked },
          lastMatchedAt: new Date(),
        },
      });
    }

    jobResultIds.push(jobResult.id);
    totalAutoLinked += ruleAutoLinked;
    totalFlagged += ruleFlagged;
    totalSkipped += ruleSkipped;
  }

  return {
    rulesRan: activeRules.length,
    autoLinkedCount: totalAutoLinked,
    flaggedCount: totalFlagged,
    skippedCount: totalSkipped,
    jobResultIds,
  };
}
