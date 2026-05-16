import { prisma } from '@/server/utils/prisma';

export type MonthlyCredit = {
  bankInterestLiabilityId: string;
  month: number;
  year: number;
  receivedFromLedger: number;
  manualOverride: number;
  receivedTotal: number;
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
};

export const getYearlyCleansingData = async (
  bankId: string,
  calendarYearId: string,
  userId: string,
): Promise<YearlyCleansingData> => {
  const liabilities = await prisma.bankInterestLiability.findMany({
    where: { bankId, calendarId: calendarYearId },
    orderBy: { month: 'asc' },
  });

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: { id: calendarYearId },
  });
  const dateFrom = new Date(calendarYear.fromYear, 0, 1);
  const dateTo = new Date(calendarYear.fromYear, 11, 31, 23, 59, 59);

  const interestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      category: { equals: 'Bank Interest', mode: 'insensitive' },
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
    },
  });

  const monthlyCredits: MonthlyCredit[] = liabilities.map((liability) => {
    const monthTx = interestTx.filter(
      (tx) => tx.date.getMonth() + 1 === liability.month,
    );
    const receivedFromLedger = monthTx.reduce((s, tx) => s + tx.amount.toNumber(), 0);
    const manualOverride = liability.amountDue.toNumber();
    return {
      bankInterestLiabilityId: liability.id,
      month: liability.month,
      year: liability.year,
      receivedFromLedger,
      manualOverride,
      receivedTotal: receivedFromLedger + manualOverride,
    };
  });

  const rawDonations = await prisma.donationPayment.findMany({
    where: {
      donationPurpose: 'INTEREST_CLEANSING',
      donationLedger: { calendarId: calendarYearId },
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

  const totalReceived = monthlyCredits.reduce((s, m) => s + m.receivedTotal, 0);
  const totalCleansed = cleansingDonations.reduce((s, d) => s + d.amount, 0);
  const balance = Math.max(0, totalReceived - totalCleansed);

  return {
    monthlyCredits,
    cleansingDonations,
    yearlySummary: { totalReceived, totalCleansed, balance },
    unlinkedInterestCount,
  };
};

export const getUnlinkedInterestTransactions = async (
  bankId: string,
  dateFrom: Date,
  dateTo: Date,
  userId: string,
): Promise<Array<{ id: string; date: string; description: string; amount: number }>> => {
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      category: { equals: 'Bank Interest', mode: 'insensitive' },
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
      OR: [
        { donationPayment: null },
        { donationPayment: { donationPurpose: { not: 'INTEREST_CLEANSING' } } },
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
