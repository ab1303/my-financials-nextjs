import type { TransactionTypeEnum } from '@prisma/client';

import { prisma } from '@/server/db/client';

export interface DedupKeyParams {
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  runningBalance?: number | null; // optional: bank balance after tx; tiebreaker for same-day same-amount
}

export interface BuildDedupSetParams {
  userId: string;
  bankAccountId: string;
  startDate: Date;
  endDate: Date;
}

export function makeDedupKey(params: DedupKeyParams): string {
  const dateStr = params.date.slice(0, 10);
  const desc = params.description.trim().toLowerCase();
  const amount = params.amount.toFixed(2);
  const type = params.type;
  // Only append balance when it's a real number; null/undefined = omit (graceful fallback for banks without balance)
  const balance = params.runningBalance != null
    ? `|${Number(params.runningBalance).toFixed(2)}`
    : '';
  return `${dateStr}|${desc}|${amount}|${type}${balance}`;
}

export async function buildDedupSet(params: BuildDedupSetParams): Promise<Set<string>> {
  const existing = await prisma.transaction.findMany({
    where: {
      userId: params.userId,
      bankAccountId: params.bankAccountId,
      date: {
        gte: params.startDate,
        lte: params.endDate,
      },
      status: { not: 'VOIDED' },
    },
    select: {
      date: true,
      description: true,
      amount: true,
      type: true,
      runningBalance: true,
    },
  });

  const set = new Set<string>();
  for (const tx of existing) {
    const key = makeDedupKey({
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
      runningBalance: tx.runningBalance != null ? Number(tx.runningBalance) : null,
    });
    set.add(key);
  }

  return set;
}

export function isDuplicate(key: string, dedupSet: Set<string>): boolean {
  return dedupSet.has(key);
}

export function getDateRangeFromMonthKeys(monthKeys: string[]): { startDate: Date; endDate: Date } {
  const sorted = [...monthKeys].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const [firstYear, firstMonth] = first.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];

  const startDate = new Date(firstYear, firstMonth - 1, 1);
  const endDate = new Date(lastYear, lastMonth, 0, 23, 59, 59, 999);

  return { startDate, endDate };
}
