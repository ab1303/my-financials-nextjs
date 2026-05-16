import { prisma } from '@/server/utils/prisma';

export type CleansingStatus = 'CLEANSED' | 'PARTIAL' | 'PENDING' | 'MANUAL' | 'NONE';

export type InterestCleansingMonthSummary = {
  bankInterestLiabilityId: string;
  month: number;
  year: number;
  receivedFromLedger: number;
  manualOverride: number;
  receivedTotal: number;
  amountCleansed: number;
  manualCleansed: number;
  balance: number;
  uncleansedTxCount: number;
  status: CleansingStatus;
};

export const getInterestCleansingData = async (
  bankId: string,
  calendarYearId: string,
  userId: string,
): Promise<InterestCleansingMonthSummary[]> => {
  // 1. Fetch BankInterestLiability rows (manual overrides) for bankId + calendarYearId
  const liabilities = await prisma.bankInterestLiability.findMany({
    where: { bankId, calendarId: calendarYearId },
    orderBy: { month: 'asc' },
  });

  // 2. Find BankAccount IDs for this bank + user
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  // 3. Fetch CalendarYear for date range
  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: { id: calendarYearId },
  });
  // For ANNUAL year: fromYear is the calendar year, months 1-12
  const dateFrom = new Date(calendarYear.fromYear, 0, 1); // Jan 1
  const dateTo = new Date(calendarYear.fromYear, 11, 31, 23, 59, 59); // Dec 31

  // 4. Fetch CREDIT "Bank Interest" CONFIRMED transactions
  const interestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      category: { equals: 'Bank Interest', mode: 'insensitive' },
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
    },
    include: { donationPayment: true },
  });

  // 5. Load manual cleansing donations (no transactionId) for this calendar year's date range
  const manualCleansingDonations = await prisma.donationPayment.findMany({
    where: {
      donationPurpose: 'INTEREST_CLEANSING',
      transactionId: null,
      donationLedger: { calendarId: calendarYearId },
      datePaid: { gte: dateFrom, lte: dateTo },
    },
  });

  // 6. Group by month and compute summary
  return liabilities.map((liability) => {
    const monthTx = interestTx.filter(
      (tx) => tx.date.getMonth() + 1 === liability.month,
    );
    const receivedFromLedger = monthTx.reduce(
      (s, tx) => s + tx.amount.toNumber(),
      0,
    );
    const manualOverride = liability.amountDue.toNumber();
    const receivedTotal = receivedFromLedger + manualOverride;

    const linkedCleansed = monthTx
      .filter(
        (tx) =>
          tx.donationPayment?.donationPurpose === 'INTEREST_CLEANSING',
      )
      .reduce(
        (s, tx) => s + (tx.donationPayment?.amount.toNumber() ?? 0),
        0,
      );

    const manualMonthDonations = manualCleansingDonations.filter(
      (dp) => new Date(dp.datePaid).getMonth() + 1 === liability.month,
    );
    const manualCleansed = manualMonthDonations.reduce(
      (s, dp) => s + dp.amount.toNumber(),
      0,
    );
    const amountCleansed = linkedCleansed + manualCleansed;
    const balance = Math.max(0, receivedTotal - amountCleansed);
    const uncleansedTxCount = monthTx.filter(
      (tx) => !tx.donationPayment || tx.donationPayment.donationPurpose !== 'INTEREST_CLEANSING',
    ).length;

    const status = computeStatus(receivedTotal, amountCleansed, balance, linkedCleansed);

    return {
      bankInterestLiabilityId: liability.id,
      month: liability.month,
      year: liability.year,
      receivedFromLedger,
      manualOverride,
      receivedTotal,
      amountCleansed,
      manualCleansed,
      balance,
      uncleansedTxCount,
      status,
    };
  });
};

function computeStatus(
  receivedTotal: number,
  amountCleansed: number,
  balance: number,
  linkedCleansed: number,
): CleansingStatus {
  if (receivedTotal === 0) return 'NONE';
  if (amountCleansed === 0) return 'PENDING';
  if (balance > 0) return 'PARTIAL';
  if (linkedCleansed === 0) return 'MANUAL';
  return 'CLEANSED';
}

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
      // Only include transactions with no cleansing donation linked
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
