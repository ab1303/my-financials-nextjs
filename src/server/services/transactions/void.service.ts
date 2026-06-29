import type { Prisma, PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';

import { clearTransferLink } from './void-transfer.service';

type DbClient = PrismaClient | Prisma.TransactionClient;

type VoidTransaction = Prisma.TransactionGetPayload<{
  include: {
    transferLinkedTransaction: { select: { id: true } };
    transferCounterpart: { select: { id: true } };
    reimbursements: { select: { id: true } };
  };
}>;

type VoidImportSession = Prisma.ImportSessionGetPayload<{
  include: {
    transactions: {
      where: { userId: string; status: { not: 'VOIDED' } };
      include: {
        transferLinkedTransaction: { select: { id: true } };
        transferCounterpart: { select: { id: true } };
        reimbursements: { select: { id: true } };
      };
    };
  };
}>;

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
    include: {
      transferLinkedTransaction: { select: { id: true } },
      transferCounterpart: { select: { id: true } },
      reimbursements: { select: { id: true } },
    },
  });

  if (!tx || tx.userId !== ctx.userId) {
    throw new Error('Transaction not found');
  }
  if (tx.status === 'VOIDED') {
    return; // idempotent
  }

  await ctx.prisma.$transaction(
    async (db) => {
      // Clear any reimbursement links before voiding
      if (tx.reimbursements.length > 0) {
        await db.transaction.updateMany({
          where: { id: { in: tx.reimbursements.map((r) => r.id) } },
          data: { offsetTransactionId: null },
        });
      }
      // Clear offset transaction link (this tx is a reimbursement)
      if (tx.offsetTransactionId) {
        await db.transaction.update({
          where: { id: tx.id },
          data: { offsetTransactionId: null },
        });
      }

      await clearTransferLink(db, ctx.userId, tx, new Set([tx.id]));
      await reverseDownstream(db, ctx.userId, tx);
      await db.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'VOIDED',
          confirmedAt: null,
          preVoidStatus: tx.status, // persist so restore can return to the exact prior state
        },
      });
    },
    { timeout: 30000 }, // 30s timeout instead of default 5s
  );
}

export async function restoreTransaction(
  ctx: VoidContext,
  transactionId: string,
): Promise<void> {
  const tx = await ctx.prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!tx || tx.userId !== ctx.userId) {
    throw new Error('Transaction not found');
  }
  if (tx.status !== 'VOIDED') {
    return; // nothing to restore
  }

  // Fall back to EXCLUDED if we somehow have no preVoidStatus (shouldn't happen for new voids,
  // but defensively handles any rows voided before this field existed).
  const restoreStatus = tx.preVoidStatus ?? 'EXCLUDED';

  await ctx.prisma.$transaction(
    async (db) => {
      await db.transaction.update({
        where: { id: transactionId },
        data: {
          status: restoreStatus,
          preVoidStatus: null,
          ...(restoreStatus === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        },
      });

      // Re-apply downstream records for CONFIRMED transactions
      if (restoreStatus === 'CONFIRMED') {
        if (tx.type === 'DEBIT') {
          await reapplyExpenseSummary(
            db,
            ctx.userId,
            tx.amount,
            tx.date,
            tx.category,
          );
        }
        // CREDIT: no downstream sync needed — income view queries Transaction live
      }
    },
    { timeout: 30000 }, // 30s timeout instead of default 5s
  );
}

export async function undoImportSession(
  ctx: VoidContext,
  importSessionId: string,
): Promise<{ voided: number; yearWarning: boolean }> {
  const session = (await ctx.prisma.importSession.findUnique({
    where: { id: importSessionId },
    include: {
      transactions: {
        where: { userId: ctx.userId, status: { not: 'VOIDED' } },
        include: {
          transferLinkedTransaction: { select: { id: true } },
          transferCounterpart: { select: { id: true } },
          reimbursements: { select: { id: true } },
        },
      },
    },
  })) as VoidImportSession | null;

  if (!session || session.userId !== ctx.userId) {
    throw new Error('Import session not found');
  }
  if (session.status === 'VOIDED') {
    return { voided: 0, yearWarning: false };
  }

  const txs = session.transactions;
  const sessionTxIds = new Set(txs.map((t) => t.id));

  await ctx.prisma.$transaction(
    async (db) => {
      for (const tx of txs) {
        // Clear any reimbursement links before voiding
        if (tx.reimbursements.length > 0) {
          await db.transaction.updateMany({
            where: { id: { in: tx.reimbursements.map((r) => r.id) } },
            data: { offsetTransactionId: null },
          });
        }
        // Clear offset transaction link (this tx is a reimbursement)
        if (tx.offsetTransactionId) {
          await db.transaction.update({
            where: { id: tx.id },
            data: { offsetTransactionId: null },
          });
        }

        await clearTransferLink(db, ctx.userId, tx, sessionTxIds);
        await reverseDownstream(db, ctx.userId, tx);
      }

      await db.transaction.updateMany({
        where: {
          importSessionId,
          userId: ctx.userId,
          status: { not: 'VOIDED' },
        },
        data: { status: 'VOIDED', confirmedAt: null },
      });

      await db.importSession.update({
        where: { id: importSessionId },
        data: { status: 'VOIDED' },
      });
    },
    { timeout: 60000 }, // 60s timeout for bulk operations
  );

  return { voided: txs.length, yearWarning: false };
}

async function reverseDownstream(
  db: DbClient,
  userId: string,
  tx: Pick<
    VoidTransaction,
    'id' | 'type' | 'status' | 'amount' | 'date' | 'category'
  >,
): Promise<void> {
  if (tx.status !== 'CONFIRMED') return;

  if (tx.type === 'DEBIT') {
    await reverseExpenseSummary(db, userId, tx.amount, tx.date, tx.category);
  }
  // CREDIT: no downstream sync needed — income view queries Transaction live
}

async function reverseExpenseSummary(
  db: DbClient,
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
    where: {
      expenseLedgerId: ledger.id,
      categoryId: expenseCat.id,
      month: monthNum,
    },
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

// ─── Restore helpers ─────────────────────────────────────────────────────────

async function reapplyExpenseSummary(
  db: DbClient,
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

  const existing = await db.monthlyExpenseSummary.findFirst({
    where: {
      expenseLedgerId: ledger.id,
      categoryId: expenseCat.id,
      month: monthNum,
    },
  });

  if (existing) {
    await db.monthlyExpenseSummary.update({
      where: { id: existing.id },
      data: { amount: { increment: amount } },
    });
  } else {
    await db.monthlyExpenseSummary.create({
      data: {
        month: monthNum,
        amount,
        categoryId: expenseCat.id,
        expenseLedgerId: ledger.id,
      },
    });
  }
}
