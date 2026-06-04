import { prisma } from '@/server/db/client';

export interface UnlinkedDonationTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

/**
 * Returns DEBIT CONFIRMED transactions with category "Gifts & donations"
 * that have no linked DonationPayment, within the given date range.
 */
export async function getUnlinkedDonationTransactions(
  userId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<UnlinkedDonationTransaction[]> {
  const DONATION_CATEGORY = 'Gifts & donations';

  // Find all donation category transactions
  const allDonationTx = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: DONATION_CATEGORY, mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, description: true, amount: true, category: true },
  });

  // Find transactions already linked as evidence
  const linkedTxIds = new Set(
    (
      await prisma.donationPaymentEvidence.findMany({
        select: { transactionId: true },
      })
    ).map((e) => e.transactionId),
  );

  // Return unlinked transactions
  const unlinked = allDonationTx.filter((tx) => !linkedTxIds.has(tx.id));
  return unlinked.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().slice(0, 10),
    description: tx.description,
    amount: Number(tx.amount),
    category: tx.category ?? '',
  }));
}

/**
 * Returns the count of unlinked donation transactions for a fiscal year.
 * Fiscal year: fromYear-07-01 to toYear-06-30.
 */
export async function countUnlinkedDonationTransactions(
  userId: string,
  fromYear: number,
  toYear: number,
): Promise<number> {
  const dateFrom = new Date(fromYear, 6, 1);
  const dateTo = new Date(toYear, 5, 30, 23, 59, 59);

  // Find all donation category transactions
  const allCount = new Set(
    (
      await prisma.transaction.findMany({
        where: {
          userId,
          type: 'DEBIT',
          status: 'CONFIRMED',
          category: { equals: 'Gifts & donations', mode: 'insensitive' },
          date: { gte: dateFrom, lte: dateTo },
        },
        select: { id: true },
      })
    ).map((t) => t.id),
  );

  // Find transactions already linked as evidence
  const linkedTxIds = new Set(
    (
      await prisma.donationPaymentEvidence.findMany({
        select: { transactionId: true },
      })
    ).map((e) => e.transactionId),
  );

  // Count unlinked transactions
  let count = 0;
  allCount.forEach((id) => {
    if (!linkedTxIds.has(id)) count += 1;
  });

  return count;
}