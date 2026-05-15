import type { TransactionTypeEnum } from '@prisma/client';

import { prisma } from '@/server/db/client';

export interface DedupKeyParams {
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
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
  return `${dateStr}|${desc}|${amount}|${type}`;
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
    },
    select: {
      date: true,
      description: true,
      amount: true,
      type: true,
    },
  });

  const set = new Set<string>();
  for (const tx of existing) {
    const key = makeDedupKey({
      date: tx.date.toISOString(),
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
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
