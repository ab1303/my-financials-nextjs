import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db/client';

import {
  type InterestCleansingInput,
  type InterestCleansingModel,
} from './types';

export const getInterestCleansingPayments = async (
  calendarYearId: string,
  beneficiaryId?: string,
): Promise<Array<InterestCleansingModel>> => {
  const payments = await prisma.interestCleansing.findMany({
    where: {
      donationLedger: { calendarId: calendarYearId },
      ...(beneficiaryId ? { sourceBusinessId: beneficiaryId } : {}),
    },
    include: { sourceBusiness: true },
  });

  return payments.map(
    (ic): InterestCleansingModel => ({
      id: ic.id,
      datePaid: ic.datePaid,
      amount: ic.amount.toNumber(),
      sourceBusinessId: ic.sourceBusinessId,
      donationLedgerId: ic.donationLedgerId,
      transactionId: ic.creditTxId,
      isDeductible: ic.sourceBusiness?.isDgrRegistered === true,
      donationPurpose: 'INTEREST_CLEANSING',
    }),
  );
};

export const addInterestCleansingPayment = async (
  input: InterestCleansingInput,
) => {
  return await prisma.interestCleansing.create({
    data: {
      id: input.id,
      donationLedgerId: input.donationLedgerId,
      datePaid: input.datePaid,
      amount: input.amount,
      sourceBusinessId: input.sourceBusinessId,
      creditTxId: input.transactionId,
    },
  });
};

export const updateInterestCleansingPayment = async (
  id: string,
  input: InterestCleansingInput,
) => {
  return await prisma.interestCleansing.update({
    where: { id },
    data: {
      datePaid: input.datePaid,
      amount: input.amount,
      sourceBusinessId: input.sourceBusinessId,
      updatedAt: new Date(),
    },
  });
};

export const deleteInterestCleansingPayment = async (id: string) => {
  return await prisma.interestCleansing.delete({ where: { id } });
};

const CLEANSING_CATEGORY_NAME = 'Interest Cleansing';

export type MonthlyCredit = {
  month: number;
  year: number;
  receivedFromLedger: number;
  cleansedAmount: number;
};

export type CleansingDonation = {
  id: string;
  datePaid: Date;
  amount: number;
  beneficiaryName: string;
  beneficiaryType: 'INDIVIDUAL' | 'BUSINESS';
  source: 'LINKED' | 'MANUAL';
  interestTxId: string | null;
  interestTxDescription?: string;
  evidence: Array<{
    id: string;
    amountApplied: number;
    description: string;
    date: Date;
  }>;
};

export type YearlySummary = {
  totalReceived: number;
  totalCleansed: number;
  balance: number;
};

export type YearlyCleansingData = {
  monthlyCredits: MonthlyCredit[];
  cleansingDonations: CleansingDonation[];
  yearlySummary: YearlySummary;
  unlinkedInterestCount: number;
  dateFrom: string;
  dateTo: string;
};

export const getYearlyCleansingData = async (
  institutionId: string,
  calendarYearId: string,
  userId: string,
): Promise<YearlyCleansingData> => {
  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: { id: calendarYearId },
  });

  const dateFrom = new Date(
    Date.UTC(calendarYear.fromYear, calendarYear.fromMonth - 1, 1),
  );
  const dateTo = new Date(
    Date.UTC(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59),
  );

  const bankAccountIds = [institutionId];

  const allMonths: Array<{ month: number; year: number }> = [];
  let currentYear = calendarYear.fromYear;
  let currentMonth = calendarYear.fromMonth;
  for (let i = 0; i < 12; i++) {
    allMonths.push({ month: currentMonth, year: currentYear });
    currentMonth += 1;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear += 1;
    }
  }

  const interestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
      OR: [
        { category: { equals: 'Credit Interest', mode: 'insensitive' } },
        { category: { equals: 'Bank Interest', mode: 'insensitive' } },
      ],
    },
  });

  const cleansingPayments = await prisma.interestCleansing.findMany({
    where: {
      datePaid: { gte: dateFrom, lte: dateTo },
    },
    include: {
      sourceBusiness: { select: { name: true } },
      creditTx: { select: { description: true } },
      evidence: {
        include: {
          transaction: { select: { description: true, date: true } },
        },
      },
    },
    orderBy: { datePaid: 'desc' },
  });

  const monthlyCredits: MonthlyCredit[] = allMonths.map(({ month, year }) => {
    const monthTx = interestTx.filter(
      (tx) =>
        tx.date.getUTCMonth() + 1 === month &&
        tx.date.getUTCFullYear() === year,
    );
    const receivedFromLedger = monthTx.reduce(
      (s, tx) => s + tx.amount.toNumber(),
      0,
    );

    const monthTxIds = new Set(monthTx.map((tx) => tx.id));
    const cleansedAmount = cleansingPayments
      .filter((d) => d.creditTxId && monthTxIds.has(d.creditTxId))
      .reduce((s, d) => s + d.amount.toNumber(), 0);

    return {
      month,
      year,
      receivedFromLedger,
      cleansedAmount,
    };
  });

  const cleansingDonations: CleansingDonation[] = cleansingPayments.map(
    (dp) => ({
      id: dp.id,
      datePaid: dp.datePaid,
      amount: dp.amount.toNumber(),
      beneficiaryName: dp.sourceBusiness?.name ?? 'Unknown',
      beneficiaryType: 'BUSINESS',
      source: dp.creditTxId ? 'LINKED' : 'MANUAL',
      interestTxId: dp.creditTxId,
      interestTxDescription: dp.creditTx?.description,
      evidence: dp.evidence.map((e) => ({
        id: e.id,
        amountApplied: e.amountLinked?.toNumber() ?? 0,
        description: e.transaction.description,
        date: e.transaction.date,
      })),
    }),
  );

  const linkedTxIds = new Set(
    cleansingPayments
      .filter((dp) => dp.creditTxId !== null)
      .map((dp) => dp.creditTxId!),
  );
  const unlinkedInterestCount = interestTx.filter(
    (tx) => !linkedTxIds.has(tx.id),
  ).length;

  const totalReceived = monthlyCredits.reduce(
    (s, m) => s + m.receivedFromLedger,
    0,
  );
  const totalCleansed = cleansingDonations.reduce((s, d) => s + d.amount, 0);
  const balance = Math.max(0, totalReceived - totalCleansed);

  return {
    monthlyCredits,
    cleansingDonations,
    yearlySummary: { totalReceived, totalCleansed, balance },
    unlinkedInterestCount,
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
  };
};

export const getUnlinkedInterestTransactions = async (
  institutionId: string,
  dateFrom: Date,
  dateTo: Date,
  userId: string,
): Promise<
  Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    cleansedAmount: number;
  }>
> => {
  const bankAccountIds = [institutionId];

  const allInterestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
      OR: [
        { category: { equals: 'Credit Interest', mode: 'insensitive' } },
        { category: { equals: 'Bank Interest', mode: 'insensitive' } },
      ],
    },
    include: {
      interestCleansingCredit: {
        include: {
          evidence: {
            select: { amountLinked: true },
          },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  return allInterestTx.map((tx) => {
    const cleansedAmount =
      tx.interestCleansingCredit?.evidence.reduce(
        (sum, e) => sum + (e.amountLinked?.toNumber() ?? 0),
        0,
      ) ?? 0;
    return {
      id: tx.id,
      date: tx.date.toISOString().split('T')[0] ?? tx.date.toISOString(),
      description: tx.description,
      amount: tx.amount.toNumber(),
      cleansedAmount,
    };
  });
};

export const getUnlinkedCleansingDebitTransactions = async (
  userId: string,
  institutionId: string,
  categoryName: string = CLEANSING_CATEGORY_NAME,
  options?: { includeAnyType?: boolean },
): Promise<
  Array<{ id: string; date: string; description: string; amount: number }>
> => {
  const bankAccountIds = [institutionId];

  if (bankAccountIds.length === 0) return [];

  const where: Prisma.TransactionWhereInput = {
    userId,
    bankAccountId: { in: bankAccountIds },
    status: 'CONFIRMED',
    interestCleansingEvidence: { none: {} },
  };

  if (!options?.includeAnyType) {
    where.type = 'DEBIT';
    where.category = { equals: categoryName, mode: 'insensitive' };
  }

  const allCleansingTx = await prisma.transaction.findMany({
    where,
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
    },
  });

  const linkedTxIds = new Set(
    (
      await prisma.interestCleansingEvidence.findMany({
        select: { transactionId: true },
      })
    ).map((e) => e.transactionId),
  );

  const unlinked = allCleansingTx.filter((tx) => !linkedTxIds.has(tx.id));
  return unlinked.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    description: t.description,
    amount: Number(t.amount),
  }));
};

export type Candidate = {
  transactionId: string;
  date: string;
  amount: number;
  remainingAmount: number;
  existingAllocations: Array<{
    interestTxId: string;
    description: string;
    amountApplied: number;
  }>;
  accountId: string;
  accountName: string;
  description: string;
  matchPercent: number;
  reasonShort: string;
  reasonLong: string;
  score: number;
  scoreBreakdown: {
    rawNormalized: {
      amountScore: number;
      dateScore: number;
      descScore: number;
      accountScore: number;
    };
    contributionsPercent: {
      amount: number;
      date: number;
      desc: number;
      account: number;
    };
  };
};

export async function getCleansingDebitCandidates(params: {
  userId: string;
  creditId: string;
  bankAccountId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  minScore?: number;
}): Promise<Candidate[]> {
  const {
    userId,
    creditId,
    bankAccountId,
    search,
    dateFrom,
    dateTo,
    limit = 20,
    minScore = 0,
  } = params;

  const credit = await prisma.transaction.findUniqueOrThrow({
    where: { id: creditId },
  });
  const creditAmount = credit.amount.toNumber();
  const creditDate = new Date(credit.date);

  const whereClause: Prisma.TransactionWhereInput = {
    userId,
    type: 'DEBIT',
    status: 'CONFIRMED',
  };

  if (bankAccountId) whereClause.bankAccountId = bankAccountId;
  if (dateFrom || dateTo) {
    whereClause.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (search) {
    const numericAmount = parseFloat(search);
    const isNumeric = !isNaN(numericAmount);

    whereClause.AND = [
      {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          ...(isNumeric ? [{ amount: { equals: numericAmount } }] : []),
        ],
      },
    ];
  }

  const rawCandidates = await prisma.transaction.findMany({
    where: whereClause,
    include: {
      financialAccount: {
        select: { name: true },
      },
      interestCleansingEvidence: {
        include: {
          interestCleansing: {
            include: {
              creditTx: { select: { id: true, description: true } },
            },
          },
        },
      },
    },
    take: 1000,
  });

  const candidates: Candidate[] = rawCandidates
    .filter((tx) => {
      const amount = Number(tx.amount);
      const allocatedAmount = tx.interestCleansingEvidence.reduce(
        (sum, e) => sum + (e.amountLinked?.toNumber() ?? 0),
        0,
      );
      return allocatedAmount < amount;
    })
    .map((tx) => {
      const amount = Number(tx.amount);
      const allocatedAmount = tx.interestCleansingEvidence.reduce(
        (sum, e) => sum + (e.amountLinked?.toNumber() ?? 0),
        0,
      );
      const remainingAmount = amount - allocatedAmount;
      const existingAllocations = tx.interestCleansingEvidence.map((e) => ({
        interestTxId: e.interestCleansing.creditTx?.id ?? 'unknown',
        description:
          e.interestCleansing.creditTx?.description ?? 'Unknown credit',
        amountApplied: e.amountLinked?.toNumber() ?? 0,
      }));
      const txDate = new Date(tx.date);

      const weights = { amount: 0.6, date: 0.1, desc: 0.2, account: 0.1 };

      const amountDiff = Math.abs(creditAmount - amount);
      const maxAmount = Math.max(creditAmount, amount, 1);
      const amountScore = Math.max(0, 1 - amountDiff / maxAmount);

      const daysBetween = Math.abs(
        (txDate.getTime() - creditDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const dateScore = Math.max(0, 1 - daysBetween / 90);

      const tokenize = (s: string) =>
        s
          .toLowerCase()
          .split(/\W+/)
          .filter((t) => t.length > 2);
      const creditTokens = new Set(tokenize(credit.description));
      const txTokens = new Set(tokenize(tx.description));

      let common = 0;
      creditTokens.forEach((t) => {
        if (txTokens.has(t)) common++;
      });
      const descScore =
        creditTokens.size === 0 ? 0 : common / creditTokens.size;

      const accountScore = bankAccountId
        ? tx.bankAccountId === bankAccountId
          ? 1
          : 0
        : 0.5;

      const combinedNormalized = Math.max(
        0,
        Math.min(
          1,
          amountScore * weights.amount +
            dateScore * weights.date +
            descScore * weights.desc +
            accountScore * weights.account,
        ),
      );

      const matchPercent = Math.round(100 * combinedNormalized);

      const contributions: {
        amount: number;
        date: number;
        desc: number;
        account: number;
      } = {
        amount: 0,
        date: 0,
        desc: 0,
        account: 0,
      };

      if (combinedNormalized > 0) {
        contributions.amount = Math.round(
          ((amountScore * weights.amount) / combinedNormalized) * matchPercent,
        );
        contributions.date = Math.round(
          ((dateScore * weights.date) / combinedNormalized) * matchPercent,
        );
        contributions.desc = Math.round(
          ((descScore * weights.desc) / combinedNormalized) * matchPercent,
        );
        contributions.account = Math.round(
          ((accountScore * weights.account) / combinedNormalized) *
            matchPercent,
        );

        const currentSum =
          contributions.amount +
          contributions.date +
          contributions.desc +
          contributions.account;
        const diff = matchPercent - currentSum;

        if (diff !== 0) {
          const keys: Array<keyof typeof contributions> = [
            'amount',
            'date',
            'desc',
            'account',
          ];
          const largestKey = keys.reduce((a, b) =>
            contributions[a] > contributions[b] ? a : b,
          );
          contributions[largestKey] += diff;
        }
      }

      const reasonShort =
        matchPercent >= 80
          ? 'Strong match'
          : matchPercent >= 50
            ? 'Partial match'
            : 'Weak match';
      const reasonLong = `Match breakdown: Amount proximity (${Math.round(amountScore * 100)}% contribution weight), Date proximity (${Math.round(dateScore * 100)}% contribution weight), Description overlap (${Math.round(descScore * 100)}% contribution weight), Account match (${accountScore * 100}% contribution weight).`;

      return {
        transactionId: tx.id,
        date: tx.date.toISOString().slice(0, 10),
        amount,
        remainingAmount,
        existingAllocations,
        accountId: tx.bankAccountId ?? 'unknown',
        accountName: tx.financialAccount?.name ?? 'Unknown Account',
        description: tx.description,
        matchPercent,
        score: matchPercent,
        reasonShort,
        reasonLong,
        scoreBreakdown: {
          rawNormalized: {
            amountScore,
            dateScore,
            descScore,
            accountScore,
          },
          contributionsPercent: contributions,
        },
      };
    });

  return candidates
    .filter((c) => c.matchPercent >= minScore)
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, limit);
}

export const suggestAllocations = async (
  creditId: string,
  limit: number,
  _userId: string,
): Promise<
  Array<{
    donationPaymentId: string;
    donationTransactionId: string | null;
    evidenceAmount: number;
    score: number;
    suggestedAmount: number;
  }>
> => {
  const credit = await prisma.transaction.findUniqueOrThrow({
    where: { id: creditId },
  });
  const creditAmount = credit.amount.toNumber();

  const center = new Date(credit.date);
  const dateFrom = new Date(center);
  dateFrom.setDate(dateFrom.getDate() - 90);
  const dateTo = new Date(center);
  dateTo.setDate(dateTo.getDate() + 90);

  const candidates = await prisma.interestCleansing.findMany({
    where: {
      datePaid: { gte: dateFrom, lte: dateTo },
    },
    include: {
      evidence: {
        include: { transaction: true },
      },
    },
  });

  const existingLinked = await prisma.interestCleansing.findMany({
    where: { creditTxId: creditId },
  });
  const alreadyAllocated = existingLinked.reduce(
    (s, d) => s + d.amount.toNumber(),
    0,
  );
  const creditRemaining = Math.max(0, creditAmount - alreadyAllocated);

  const scored = candidates.map((c) => {
    const evidenceAmount = c.amount.toNumber();
    const amountScore =
      1 -
      Math.abs(creditAmount - evidenceAmount) /
        Math.max(creditAmount, evidenceAmount, 1);
    const daysBetween = Math.abs(
      (new Date(c.datePaid).getTime() - center.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const dateScore = Math.max(0, 1 - daysBetween / 90);
    const txDesc = c.evidence?.[0]?.transaction?.description ?? '';
    const creditDesc = credit.description ?? '';
    const tokenMatch = (() => {
      const a = new Set(txDesc.toLowerCase().split(/\W+/).filter(Boolean));
      const b = new Set(creditDesc.toLowerCase().split(/\W+/).filter(Boolean));
      if (a.size === 0 || b.size === 0) return 0;
      let common = 0;
      a.forEach((t) => {
        if (b.has(t)) common += 1;
      });
      return common / Math.max(a.size, b.size);
    })();
    const refScore = tokenMatch;

    const score = Math.min(
      1,
      Math.max(
        0,
        amountScore * 0.4 + dateScore * 0.2 + refScore * 0.3 + 0.1 * 1,
      ),
    );

    const suggestedAmount = Math.min(creditRemaining, evidenceAmount);

    return {
      donationPaymentId: c.id,
      donationTransactionId: c.creditTxId ?? null,
      evidenceAmount,
      score: Number(score.toFixed(4)),
      suggestedAmount,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
};

export const applyAllocations = async (
  creditId: string,
  allocations: Array<{ evidenceId: string; amount: number }>,
  userId: string,
  sourceBusinessId?: string | null,
): Promise<{ success: boolean; allocationsCreated: number }> => {
  if (!allocations || allocations.length === 0)
    return { success: false, allocationsCreated: 0 };

  const credit = await prisma.transaction.findUniqueOrThrow({
    where: { id: creditId },
  });

  return await prisma.$transaction(async (tx) => {
    let cleansing = await tx.interestCleansing.findUnique({
      where: { creditTxId: creditId },
    });

    if (!cleansing) {
      const year = credit.date.getFullYear();
      const ledger = await tx.donationLedger.findFirst({
        where: {
          calendar: {
            fromYear: { lte: year },
            toYear: { gte: year },
          },
        },
      });

      if (!ledger) throw new Error(`No DonationLedger found for year ${year}`);

      cleansing = await tx.interestCleansing.create({
        data: {
          datePaid: credit.date,
          amount: credit.amount,
          donationLedgerId: ledger.id,
          creditTxId: creditId,
          sourceBusinessId: sourceBusinessId ?? null,
        },
      });
    }

    let createdCount = 0;
    for (const alloc of allocations) {
      await tx.interestCleansingEvidence.upsert({
        where: {
          interestCleansingId_transactionId: {
            interestCleansingId: cleansing.id,
            transactionId: alloc.evidenceId,
          },
        },
        update: {
          amountLinked: alloc.amount,
        },
        create: {
          interestCleansingId: cleansing.id,
          transactionId: alloc.evidenceId,
          amountLinked: alloc.amount,
        },
      });
      createdCount++;
    }

    return { success: true, allocationsCreated: createdCount };
  });
};

export const removeAllocation = async (
  allocationId: string,
  _userId: string,
): Promise<{ success: boolean }> => {
  return await prisma.$transaction(async (tx) => {
    const evidence = await tx.interestCleansingEvidence.findUniqueOrThrow({
      where: { id: allocationId },
      select: { interestCleansingId: true },
    });

    await tx.interestCleansingEvidence.delete({ where: { id: allocationId } });

    const remainingCount = await tx.interestCleansingEvidence.count({
      where: { interestCleansingId: evidence.interestCleansingId },
    });

    if (remainingCount === 0) {
      await tx.interestCleansing.delete({
        where: { id: evidence.interestCleansingId },
      });
    }

    return { success: true };
  });
};

export const getLinkedTransactionIds = async (): Promise<string[]> => {
  const linked = await prisma.interestCleansingEvidence.findMany({
    select: { transactionId: true },
  });
  return linked.map((d) => d.transactionId);
};
