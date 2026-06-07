import { prisma } from '@/server/utils/prisma';

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
  bankId: string,
  calendarYearId: string,
  userId: string,
): Promise<YearlyCleansingData> => {
  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: { id: calendarYearId },
  });

  // FIX 1: Use fromMonth/toMonth from calendarYear, respecting fiscal year windows
  // ADR-1: CalendarYear is a time window — derive dateFrom/dateTo from fromYear/fromMonth → toYear/toMonth
  // Use UTC to avoid timezone offset issues
  const dateFrom = new Date(
    Date.UTC(calendarYear.fromYear, calendarYear.fromMonth - 1, 1),
  );
  const dateTo = new Date(
    Date.UTC(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59),
  );

  // bankId is a FinancialAccount.id — filter transactions directly by this account
  const bankAccountIds = [bankId];

  // Generate all 12 months for this calendar window (Jan-Dec for Annual, Jul-Jun for Fiscal, etc.)
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
      // "Credit Interest" income source is the canonical anchor for bank interest.
      // "Bank Interest" is retained as a legacy fallback.
      OR: [
        { category: { equals: 'Credit Interest', mode: 'insensitive' } },
        { category: { equals: 'Bank Interest', mode: 'insensitive' } },
      ],
    },
  });

  const rawDonations = await prisma.donationPayment.findMany({
    where: {
      donationPurpose: 'INTEREST_CLEANSING',
      // FIX 2: Use datePaid date range instead of FK-based calendarId lookup
      // ADR-4: Use datePaid BETWEEN dateFrom AND dateTo, not calendarId FK as primary scope
      datePaid: { gte: dateFrom, lte: dateTo },
    },
    include: {
      business: { select: { name: true } },
      individual: { select: { firstName: true, lastName: true } },
      interestTx: { select: { description: true } },
      evidence: {
        include: {
          evidenceTransaction: { select: { description: true, date: true } },
        },
      },
    },
    orderBy: { datePaid: 'desc' },
  });

  // Build monthlyCredits from all 12 months (after rawDonations is available)
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

    // Sum up donations linked to transactions in this month
    const monthTxIds = new Set(monthTx.map((tx) => tx.id));
    const cleansedAmount = rawDonations
      .filter((d) => d.interestTxId && monthTxIds.has(d.interestTxId))
      .reduce((s, d) => s + d.amount.toNumber(), 0);

    return {
      month,
      year,
      receivedFromLedger,
      cleansedAmount,
    };
  });

  const cleansingDonations: CleansingDonation[] = rawDonations.map((dp) => ({
    id: dp.id,
    datePaid: dp.datePaid,
    amount: dp.amount.toNumber(),
    beneficiaryName:
      dp.beneficiaryType === 'BUSINESS'
        ? (dp.business?.name ?? 'Unknown')
        : `${dp.individual?.firstName ?? ''} ${dp.individual?.lastName ?? ''}`.trim(),
    beneficiaryType: dp.beneficiaryType as 'INDIVIDUAL' | 'BUSINESS',
    source: dp.interestTxId ? 'LINKED' : 'MANUAL',
    interestTxId: dp.interestTxId,
    interestTxDescription: dp.interestTx?.description,
    evidence: dp.evidence.map((e) => ({
      id: e.id,
      amountApplied: e.amountApplied.toNumber(),
      description: e.evidenceTransaction.description,
      date: e.evidenceTransaction.date,
    })),
  }));

  const linkedTxIds = new Set(
    rawDonations
      .filter((dp) => dp.interestTxId !== null)
      .map((dp) => dp.interestTxId!),
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
  bankId: string,
  dateFrom: Date,
  dateTo: Date,
  userId: string,
): Promise<
  Array<{ id: string; date: string; description: string; amount: number }>
> => {
  // bankId is a FinancialAccount.id — filter transactions directly by this account
  const bankAccountIds = [bankId];

  // Find all interest transactions
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
    orderBy: { date: 'asc' },
  });

  // Find transactions already linked to interest cleansing donations
  const linkedInterestTxIds = new Set(
    (
      await prisma.donationPayment.findMany({
        where: {
          donationPurpose: 'INTEREST_CLEANSING',
          interestTxId: { not: null },
        },
        select: { interestTxId: true },
      })
    ).map((dp) => dp.interestTxId!),
  );

  // Return unlinked transactions
  const unlinked = allInterestTx.filter(
    (tx) => !linkedInterestTxIds.has(tx.id),
  );
  return unlinked.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().split('T')[0] ?? tx.date.toISOString(),
    description: tx.description,
    amount: tx.amount.toNumber(),
  }));
};

export const getUnlinkedCleansingDebitTransactions = async (
  userId: string,
  bankId: string,
  categoryName: string = CLEANSING_CATEGORY_NAME,
  options?: { includeAnyType?: boolean },
): Promise<
  Array<{ id: string; date: string; description: string; amount: number }>
> => {
  // bankId is a FinancialAccount.id — filter transactions directly by this account
  const bankAccountIds = [bankId];

  if (bankAccountIds.length === 0) return [];

  // Build where clause. By default we filter to CONFIRMED DEBIT transactions
  // in `categoryName` to follow the cleansing flow. When `options.includeAnyType`
  // is true we relax the filter so any transaction type (DEBIT/CREDIT) is
  // considered (still respecting CONFIRMED status and excluding already-linked evidence).
  const where: any = {
    userId,
    bankAccountId: { in: bankAccountIds },
    status: 'CONFIRMED',
    // Ensure this transaction is NOT linked as evidence to any DonationPayment
    donationPaymentEvidence: { none: {} },
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

  // Find transactions already linked to donations as evidence
  const linkedTxIds = new Set(
    (
      await prisma.donationPaymentEvidence.findMany({
        select: { evidenceTransactionId: true },
      })
    ).map((e) => e.evidenceTransactionId),
  );

  // Return unlinked transactions
  const unlinked = allCleansingTx.filter((tx) => !linkedTxIds.has(tx.id));
  return unlinked.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    description: t.description,
    amount: Number(t.amount),
  }));
};

// -------------------------
// Interest cleansing: tRPC service helpers (Phase D)
// -------------------------

export type Candidate = {
  transactionId: string; // transaction.id (DEBIT evidence)
  date: string; // ISO date YYYY-MM-DD (transaction.date)
  amount: number; // numeric amount (positive number)
  accountId: string; // FinancialAccount.id where the transaction occurred
  accountName: string; // Human-friendly account display name
  description: string; // transaction.description

  // Canonical match percent shown in UI badge. Integer 0..100
  matchPercent: number;

  // Short & long textual reasons for display
  reasonShort: string; // one-line short summary (e.g. "amount + date match")
  reasonLong: string; // longer explanation used in tooltip or expandable area

  // Primary score used for server-side thresholding; equals matchPercent
  score: number; // integer 0..100 (same as matchPercent, present for backward compatibility)

  // Detailed breakdown: rawNormalized are [0..1] floats. contributionsPercent are integers
  // representing each component's contribution to the total matchPercent and MUST sum to matchPercent
  scoreBreakdown: {
    rawNormalized: {
      amountScore: number; // 0..1
      dateScore: number; // 0..1
      descScore: number; // 0..1
      accountScore: number; // 0..1
    };
    contributionsPercent: {
      amount: number; // integer (e.g. 40)
      date: number; // integer (e.g. 20)
      desc: number; // integer (e.g. 30)
      account: number; // integer (e.g. 10)
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

  // 1. Fetch bounded superset of eligible DEBITs
  const whereClause: any = {
    userId,
    type: 'DEBIT',
    status: 'CONFIRMED',
    // Ensure this transaction is NOT linked as evidence to any DonationPayment
    donationPaymentEvidence: { none: {} },
  };

  if (bankAccountId) whereClause.bankAccountId = bankAccountId;
  if (dateFrom)
    whereClause.date = { ...whereClause.date, gte: new Date(dateFrom) };
  if (dateTo) whereClause.date = { ...whereClause.date, lte: new Date(dateTo) };
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
    },
    take: 1000, // Increase pool size to ensure best matches are captured
  });

  // 2. Score candidates
  const candidates: Candidate[] = rawCandidates.map((tx) => {
    const amount = Number(tx.amount);
    const txDate = new Date(tx.date);

    // Weights (canonical): amount 0.6, date 0.1, desc 0.2, account 0.1
    const weights = { amount: 0.6, date: 0.1, desc: 0.2, account: 0.1 };

    // amountScore (40%) - Proximity score
    const amountDiff = Math.abs(creditAmount - amount);
    const maxAmount = Math.max(creditAmount, amount, 1);
    const amountScore = Math.max(0, 1 - amountDiff / maxAmount);

    // dateScore (20%) - 90-day window normalization
    const daysBetween = Math.abs(
      (txDate.getTime() - creditDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const dateScore = Math.max(0, 1 - daysBetween / 90);

    // descScore (30%) - Token overlap
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
    const descScore = creditTokens.size === 0 ? 0 : common / creditTokens.size;

    // accountScore (10%) - Exact match if filter is provided, else 0.5 (neutral)
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
        ((accountScore * weights.account) / combinedNormalized) * matchPercent,
      );

      // Rounding drift correction
      const currentSum =
        contributions.amount +
        contributions.date +
        contributions.desc +
        contributions.account;
      const diff = matchPercent - currentSum;

      if (diff !== 0) {
        // Adjust the largest contributor to ensure sum equals matchPercent
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

  // 3. Sort and filter
  return candidates
    .filter((c) => c.matchPercent >= minScore)
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, limit);
}

export const suggestAllocations = async (
  creditId: string,
  limit: number,
  userId: string,
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

  // compute 90-day window around credit date
  const center = new Date(credit.date);
  const dateFrom = new Date(center);
  dateFrom.setDate(dateFrom.getDate() - 90);
  const dateTo = new Date(center);
  dateTo.setDate(dateTo.getDate() + 90);

  // Candidate donations in window with INTEREST_CLEANSING purpose
  const candidates = await prisma.donationPayment.findMany({
    where: {
      donationPurpose: 'INTEREST_CLEANSING',
      datePaid: { gte: dateFrom, lte: dateTo },
    },
    include: {
      evidence: {
        include: { evidenceTransaction: true },
      },
    },
  });

  // compute already-allocated amount for this credit (donationPayments that reference this interest Tx)
  const existingLinked = await prisma.donationPayment.findMany({
    where: { interestTxId: creditId },
  });
  const alreadyAllocated = existingLinked.reduce(
    (s, d) => s + d.amount.toNumber(),
    0,
  );
  const creditRemaining = Math.max(0, creditAmount - alreadyAllocated);

  const scored = candidates.map((c) => {
    const evidenceAmount = c.amount.toNumber();
    // amount proximity score [0,1]
    const amountScore =
      1 -
      Math.abs(creditAmount - evidenceAmount) /
        Math.max(creditAmount, evidenceAmount, 1);
    // date proximity score
    const daysBetween = Math.abs(
      (new Date(c.datePaid).getTime() - center.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const dateScore = Math.max(0, 1 - daysBetween / 90);
    // simple description/reference match using evidence transaction description
    const txDesc = c.evidence?.[0]?.evidenceTransaction?.description ?? '';
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
      donationTransactionId: c.interestTxId ?? null,
      evidenceAmount,
      score: Number(score.toFixed(4)),
      suggestedAmount,
    };
  });

  // sort by score desc and limit
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
};

export const applyAllocations = async (
  creditId: string,
  allocations: Array<{ evidenceId: string; amount: number }>,
  userId: string,
): Promise<{ success: boolean; allocationsCreated: number }> => {
  if (!allocations || allocations.length === 0)
    return { success: false, allocationsCreated: 0 };

  const credit = await prisma.transaction.findUniqueOrThrow({
    where: { id: creditId },
  });

  // 1. Find or create a DonationPayment for this credit
  // For interest cleansing, we link 1 credit to 1 "cleansing donation" record,
  // but that record can be backed by M debit transactions as evidence.

  return await prisma.$transaction(async (tx) => {
    let donation = await tx.donationPayment.findUnique({
      where: { interestTxId: creditId },
    });

    if (!donation) {
      // Find a ledger for this credit date
      const year = credit.date.getFullYear();
      let ledger = await tx.donationLedger.findFirst({
        where: {
          calendar: {
            fromYear: { lte: year },
            toYear: { gte: year },
          },
        },
      });

      if (!ledger) throw new Error(`No DonationLedger found for year ${year}`);

      donation = await tx.donationPayment.create({
        data: {
          datePaid: credit.date,
          amount: credit.amount,
          beneficiaryType: 'BUSINESS',
          donationLedgerId: ledger.id,
          interestTxId: creditId,
          donationPurpose: 'INTEREST_CLEANSING',
        },
      });
    }

    let createdCount = 0;
    for (const alloc of allocations) {
      await tx.donationPaymentEvidence.upsert({
        where: {
          donationPaymentId_evidenceTransactionId: {
            donationPaymentId: donation.id,
            evidenceTransactionId: alloc.evidenceId,
          },
        },
        update: {
          amountApplied: alloc.amount,
        },
        create: {
          donationPaymentId: donation.id,
          evidenceTransactionId: alloc.evidenceId,
          amountApplied: alloc.amount,
          confidence: 1.0, // Human confirmed
        },
      });
      createdCount++;
    }

    return { success: true, allocationsCreated: createdCount };
  });
};

export const removeAllocation = async (
  allocationId: string,
  userId: string,
): Promise<{ success: boolean }> => {
  // Simple deletion for now — can be extended to soft-delete with audit table
  await prisma.donationPaymentEvidence.delete({ where: { id: allocationId } });
  return { success: true };
};
