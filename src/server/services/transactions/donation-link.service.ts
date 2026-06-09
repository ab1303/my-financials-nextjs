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
 * that have no linked VoluntaryDonation.
 */
export async function getUnlinkedDonationTransactions(
  userId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<UnlinkedDonationTransaction[]> {
  const DONATION_CATEGORY = 'Gifts & donations';

  // 1. Find all potential "Gifts & donations" transactions
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

  // 2. Find transactions already linked to VoluntaryDonation records
  const linkedVoluntaryTxIds = new Set(
    (await prisma.voluntaryDonation.findMany({
      where: { transactionId: { not: null } },
      select: { transactionId: true },
    })).map((d) => d.transactionId!)
  );

  // 3. Return only transactions that are NOT linked to a VoluntaryDonation
  const unlinked = allDonationTx.filter((tx) => !linkedVoluntaryTxIds.has(tx.id));
  
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
 */
export async function countUnlinkedDonationTransactions(
  userId: string,
  fromYear: number,
  toYear: number,
): Promise<number> {
  const dateFrom = new Date(fromYear, 6, 1);
  const dateTo = new Date(toYear, 5, 30, 23, 59, 59);

  // Fetch all donation transactions in window
  const allDonationTx = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: 'Gifts & donations', mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
    },
    select: { id: true },
  });

  // Fetch all linked VoluntaryDonation transaction IDs
  const linkedVoluntaryTxIds = new Set(
    (await prisma.voluntaryDonation.findMany({
      where: { transactionId: { not: null } },
      select: { transactionId: true },
    })).map((d) => d.transactionId!)
  );

  // Return count of transactions NOT in the linked set
  return allDonationTx.filter((t) => !linkedVoluntaryTxIds.has(t.id)).length;
}
