import type { Prisma } from '@prisma/client';

import { prisma } from '@/server/db/client';

import {
  DONATION_PURPOSES,
  getAllLinkedTransactionIds,
} from './donation-utils.service';

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
  select: Pick<Prisma.TransactionFindManyArgs, 'orderBy' | 'select'>,
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

/**
 * Returns DEBIT CONFIRMED transactions with category "Gifts & donations"
 * that have no linked VoluntaryDonation, InterestCleansing, or ZakatPayment.
 */
export async function getUnlinkedDonationTransactions(
  userId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<UnlinkedDonationTransaction[]> {
  const [allDonationTx, allLinkedTxIds] = await Promise.all([
    getPotentialDonationTransactions(userId, dateFrom, dateTo, {
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        category: true,
      },
    }),
    getAllLinkedTransactionIds([
      DONATION_PURPOSES.VOLUNTARY,
      DONATION_PURPOSES.INTEREST_CLEANSING,
      DONATION_PURPOSES.ZAKAT,
    ]),
  ]);

  return allDonationTx
    .filter((tx) => !allLinkedTxIds.has(tx.id))
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

  const [allDonationTx, allLinkedTxIds] = await Promise.all([
    getPotentialDonationTransactions(userId, dateFrom, dateTo, {
      select: { id: true },
    }),
    getAllLinkedTransactionIds([
      DONATION_PURPOSES.VOLUNTARY,
      DONATION_PURPOSES.INTEREST_CLEANSING,
      DONATION_PURPOSES.ZAKAT,
    ]),
  ]);

  return allDonationTx.filter((t) => !allLinkedTxIds.has(t.id)).length;
}
