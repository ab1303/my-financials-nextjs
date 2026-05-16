import type { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

interface VoidContext {
  prisma: PrismaClient;
  userId: string;
}

export async function voidSingleTransaction(
  ctx: VoidContext,
  transactionId: string,
): Promise<void> {
  const tx = await ctx.prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { incomeRecord: true },
  });

  if (!tx || tx.userId !== ctx.userId) {
    throw new Error('Transaction not found');
  }
  if (tx.status === 'VOIDED') {
    return; // idempotent
  }

  await ctx.prisma.$transaction(async (db) => {
    await reverseDownstream(db as unknown as PrismaClient, ctx.userId, tx);
    await db.transaction.update({
      where: { id: transactionId },
      data: { status: 'VOIDED', confirmedAt: null },
    });
  });
}

export async function undoImportSession(
  ctx: VoidContext,
  importSessionId: string,
): Promise<{ voided: number }> {
  const session = await ctx.prisma.importSession.findUnique({
    where: { id: importSessionId },
    include: {
      transactions: {
        where: { userId: ctx.userId, status: { not: 'VOIDED' } },
        include: { incomeRecord: true },
      },
    },
  });

  if (!session || session.userId !== ctx.userId) {
    throw new Error('Import session not found');
  }
  if (session.status === 'VOIDED') {
    return { voided: 0 };
  }

  const txs = session.transactions;

  await ctx.prisma.$transaction(async (db) => {
    for (const tx of txs) {
      await reverseDownstream(db as unknown as PrismaClient, ctx.userId, tx);
    }

    await db.transaction.updateMany({
      where: { importSessionId, userId: ctx.userId, status: { not: 'VOIDED' } },
      data: { status: 'VOIDED', confirmedAt: null },
    });

    await db.importSession.update({
      where: { id: importSessionId },
      data: { status: 'VOIDED' },
    });
  });

  return { voided: txs.length };
}

async function reverseDownstream(
  db: PrismaClient,
  userId: string,
  tx: {
    id: string;
    type: string;
    status: string;
    amount: Decimal;
    date: Date;
    category: string;
    incomeRecord: { id: string } | null;
  },
): Promise<void> {
  if (tx.status !== 'CONFIRMED') return;

  if (tx.type === 'DEBIT') {
    await reverseExpenseSummary(db, userId, tx.amount, tx.date, tx.category);
  } else if (tx.type === 'CREDIT') {
    await reverseIncomeRecord(db, userId, tx.amount, tx.date, tx.incomeRecord?.id);
  }
}

async function reverseExpenseSummary(
  db: PrismaClient,
  userId: string,
  amount: Decimal,
  date: Date,
  category: string,
): Promise<void> {
  const monthNum = date.getMonth() + 1;

  const calendar = await db.calendarYear.findFirst({
    where: {
      type: 'FISCAL',
      OR: [
        { fromYear: date.getFullYear(), fromMonth: { lte: monthNum } },
        { toYear: date.getFullYear(), toMonth: { gte: monthNum } },
      ],
    },
  });
  if (!calendar) return;

  const ledger = await db.expenseLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendar.id, userId } },
  });
  if (!ledger) return;

  const expenseCat = await db.expenseCategory.findFirst({
    where: { name: category, isActive: true },
  });
  if (!expenseCat) return;

  const summary = await db.monthlyExpenseSummary.findFirst({
    where: { expenseLedgerId: ledger.id, categoryId: expenseCat.id, month: monthNum },
  });
  if (!summary) return;

  const newAmount = Number(summary.amount) - Number(amount);
  if (newAmount <= 0) {
    await db.monthlyExpenseSummary.delete({ where: { id: summary.id } });
  } else {
    await db.monthlyExpenseSummary.update({
      where: { id: summary.id },
      data: { amount: { decrement: amount } },
    });
  }
}

async function reverseIncomeRecord(
  db: PrismaClient,
  userId: string,
  amount: Decimal,
  date: Date,
  incomeRecordId: string | undefined,
): Promise<void> {
  if (incomeRecordId) {
    await db.incomeRecord.delete({ where: { id: incomeRecordId } }).catch(() => {
      // Already deleted — idempotent
    });
    return;
  }

  // Fallback: fuzzy match for pre-backfill records
  const monthNum = date.getMonth() + 1;
  const calendar = await db.calendarYear.findFirst({
    where: {
      type: 'FISCAL',
      OR: [
        { fromYear: date.getFullYear(), fromMonth: { lte: monthNum } },
        { toYear: date.getFullYear(), toMonth: { gte: monthNum } },
      ],
    },
  });
  if (!calendar) return;

  const ledger = await db.incomeLedger.findUnique({
    where: { calendarId_userId: { calendarId: calendar.id, userId } },
  });
  if (!ledger) return;

  const record = await db.incomeRecord.findFirst({
    where: {
      incomeLedgerId: ledger.id,
      dateEarned: date,
      amount: String(amount),
    },
  });
  if (record) {
    await db.incomeRecord.delete({ where: { id: record.id } });
  }
}
