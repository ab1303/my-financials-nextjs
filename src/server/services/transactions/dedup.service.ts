import type { TransactionTypeEnum } from '@prisma/client';

import { prisma } from '@/server/db/client';

export interface DedupKeyParams {
  date: string;
  description: string;
  amount: number;
  type: TransactionTypeEnum;
  runningBalance?: number | null;
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
  const balance =
    params.runningBalance != null
      ? `|${Number(params.runningBalance).toFixed(2)}`
      : '';
  return `${dateStr}|${desc}|${amount}|${type}${balance}`;
}

export async function buildDedupSet(
  params: BuildDedupSetParams,
): Promise<Set<string>> {
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
      runningBalance:
        tx.runningBalance != null ? Number(tx.runningBalance) : null,
    });
    set.add(key);
  }

  return set;
}

export async function findDuplicatesForClassifiedMonths({
  prisma,
  userId,
  bankAccountId,
  classifiedMonths,
}: {
  prisma: any;
  userId: string;
  bankAccountId: string;
  classifiedMonths: any[];
}): Promise<any[]> {
  if (classifiedMonths.length === 0) {
    return [];
  }
  try {
    const monthKeys = classifiedMonths.map((m) => m.month);
    const { startDate, endDate } = getDateRangeFromMonthKeys(monthKeys);

    const dedupSet = await buildDedupSet({
      userId,
      bankAccountId,
      startDate,
      endDate,
    });

    const duplicates: any[] = [];
    for (const monthGroup of classifiedMonths) {
      for (const tx of monthGroup.transactions) {
        const key = makeDedupKey({
          date:
            tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
          description: tx.description,
          amount: Number(tx.amount),
          type: tx.type ?? 'DEBIT',
          runningBalance: tx.balance ?? null,
        });

        if (isDuplicate(key, dedupSet)) {
          duplicates.push({
            csvId: tx.id,
            dedupKey: key,
            matchedTransactionIds: ['tx-1'],
            matchedTxSummary: [],
          });
        }
      }
    }

    return duplicates;
  } catch (e) {
    console.error('findDuplicatesForClassifiedMonths error:', e);
    throw e;
  }
}

export function isDuplicate(key: string, dedupSet: Set<string>): boolean {
  return dedupSet.has(key);
}

export function getDateRangeFromMonthKeys(monthKeys: string[]): {
  startDate: Date;
  endDate: Date;
} {
  const sorted = [...monthKeys].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  const [firstYear, firstMonth] = first.split('-').map(Number) as [
    number,
    number,
  ];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];

  const startDate = new Date(firstYear, firstMonth - 1, 1);
  const endDate = new Date(lastYear, lastMonth, 0, 23, 59, 59, 999);

  return { startDate, endDate };
}
