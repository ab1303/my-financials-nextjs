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
): Promise<
  Array<{ id: string; date: string; description: string; amount: number }>
> => {
  // bankId is a FinancialAccount.id — filter transactions directly by this account
  const bankAccountIds = [bankId];

  if (bankAccountIds.length === 0) return [];

  // Find all cleansing category transactions
  const allCleansingTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: {
        equals: CLEANSING_CATEGORY_NAME,
        mode: 'insensitive',
      },
    },
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
