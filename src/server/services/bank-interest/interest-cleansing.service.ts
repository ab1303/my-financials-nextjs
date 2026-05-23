import { prisma } from '@/server/utils/prisma';

const CLEANSING_CATEGORY_NAME = 'Interest Cleansing';

export type MonthlyCredit = {
  month: number;
  year: number;
  receivedFromLedger: number;
};

export type CleansingDonation = {
  id: string;
  datePaid: Date;
  amount: number;
  beneficiaryName: string;
  beneficiaryType: 'INDIVIDUAL' | 'BUSINESS';
  source: 'LINKED' | 'MANUAL';
  transactionId: string | null;
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
  const dateFrom = new Date(Date.UTC(calendarYear.fromYear, calendarYear.fromMonth - 1, 1));
  const dateTo = new Date(Date.UTC(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59));

  const bankAccounts = await prisma.financialAccount.findMany({
    where: { institutionId: bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

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

  // Fetch interest transactions from the ledger
  const interestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
      // Match both explicitly-categorised "Bank Interest" records and any CREDIT
      // transactions whose description contains the word "interest" (e.g. the
      // "Credit Interest" entries imported from Australian banks, which the AI
      // classifier assigns to category "Other").
      OR: [
        { category: { equals: 'Bank Interest', mode: 'insensitive' } },
        { description: { contains: 'interest', mode: 'insensitive' } },
      ],
    },
  });

  // Build monthlyCredits from all 12 months
  const monthlyCredits: MonthlyCredit[] = allMonths.map(({ month, year }) => {
    const monthTx = interestTx.filter(
      (tx) => tx.date.getMonth() + 1 === month && tx.date.getFullYear() === year,
    );
    const receivedFromLedger = monthTx.reduce((s, tx) => s + tx.amount.toNumber(), 0);

    return {
      month,
      year,
      receivedFromLedger,
    };
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
    },
    orderBy: { datePaid: 'desc' },
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
    source: dp.transactionId ? 'LINKED' : 'MANUAL',
    transactionId: dp.transactionId,
  }));

  const linkedTxIds = new Set(
    rawDonations.filter((dp) => dp.transactionId !== null).map((dp) => dp.transactionId!),
  );
  const unlinkedInterestCount = interestTx.filter((tx) => !linkedTxIds.has(tx.id)).length;

  const totalReceived = monthlyCredits.reduce((s, m) => s + m.receivedFromLedger, 0);
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
): Promise<Array<{ id: string; date: string; description: string; amount: number }>> => {
  const bankAccounts = await prisma.financialAccount.findMany({
    where: { institutionId: bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
      OR: [
        { category: { equals: 'Bank Interest', mode: 'insensitive' } },
        { description: { contains: 'interest', mode: 'insensitive' } },
      ],
      AND: [
        {
          OR: [
            { donationPayment: null },
            { donationPayment: { donationPurpose: { not: 'INTEREST_CLEANSING' } } },
          ],
        },
      ],
    },
    orderBy: { date: 'asc' },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().split('T')[0] ?? tx.date.toISOString(),
    description: tx.description,
    amount: tx.amount.toNumber(),
  }));
};

export const getUnlinkedCleansingDebitTransactions = async (
  userId: string,
  bankId: string,
): Promise<Array<{ id: string; date: string; description: string; amount: number }>> => {
  const accounts = await prisma.financialAccount.findMany({
    where: {
      userId,
      institutionId: bankId,
    },
    select: { id: true },
  });
  const bankAccountIds = accounts.map((a) => a.id);

  if (bankAccountIds.length === 0) return [];

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: {
        equals: CLEANSING_CATEGORY_NAME,
        mode: 'insensitive',
      },
      donationPayment: null,
    },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
    },
  });

  return transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    description: t.description,
    amount: Number(t.amount),
  }));
};

