import { prisma } from '@/server/db/client';

export interface UnlinkedDonationTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

const DONATION_CATEGORY = 'Gifts & donations';

async function getPotentialDonationTransactions(
  userId: string,
  dateFrom: Date,
  dateTo: Date,
  select: any,
) {
  return await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: DONATION_CATEGORY, mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
    },
    ...select,
  });
}

async function getLinkedVoluntaryTransactionIds(): Promise<Set<string>> {
  const linked = await prisma.voluntaryDonation.findMany({
    where: { transactionId: { not: null } },
    select: { transactionId: true },
  });
  return new Set(linked.map((d) => d.transactionId!));
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
  const [allDonationTx, linkedVoluntaryTxIds] = await Promise.all([
    getPotentialDonationTransactions(userId, dateFrom, dateTo, {
      orderBy: { date: 'desc' },
      select: { id: true, date: true, description: true, amount: true, category: true },
    }),
    getLinkedVoluntaryTransactionIds(),
  ]);

  return allDonationTx
    .filter((tx) => !linkedVoluntaryTxIds.has(tx.id))
    .map((tx) => ({
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

  const [allDonationTx, linkedVoluntaryTxIds] = await Promise.all([
    getPotentialDonationTransactions(userId, dateFrom, dateTo, {
      select: { id: true },
    }),
    getLinkedVoluntaryTransactionIds(),
  ]);

  return allDonationTx.filter((t) => !linkedVoluntaryTxIds.has(t.id)).length;
}
