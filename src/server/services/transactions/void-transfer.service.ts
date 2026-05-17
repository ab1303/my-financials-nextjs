import type { PrismaClient, TransactionStatusEnum } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import { rerollupExpenseSummary } from './ledger.service';

const TRANSFER_CATEGORY = 'Transfer';

export async function clearTransferLink(
  db: PrismaClient,
  userId: string,
  tx: {
    id: string;
    transferLinkedTransactionId: string | null;
    preLinkCategory: string | null;
    preLinkStatus: TransactionStatusEnum | null;
  },
  sessionTxIds: Set<string>,
): Promise<void> {
  if ((tx as any).transferLinkedTransactionId) {
    await _clearDebitSide(db, userId, tx as any, sessionTxIds);
  } else {
    await _clearCreditSide(db, userId, tx.id, sessionTxIds);
  }
}

async function _clearDebitSide(
  db: PrismaClient,
  _userId: string,
  debit: {
    id: string;
    transferLinkedTransactionId: string;
    preLinkCategory: string | null;
    preLinkStatus: TransactionStatusEnum | null;
  },
  sessionTxIds: Set<string>,
): Promise<void> {
  await (db.transaction as any).update({
    where: { id: debit.id },
    data: {
      transferLinkedTransactionId: null,
      preLinkCategory: null,
      preLinkStatus: null,
    },
  });

  if (sessionTxIds.has(debit.transferLinkedTransactionId)) return;

  const credit = await (db.transaction as any).findUnique({
    where: { id: debit.transferLinkedTransactionId },
    select: { id: true, preLinkCategory: true, preLinkStatus: true, category: true, status: true },
  });
  if (!credit || credit.status === 'VOIDED') return;

  await (db.transaction as any).update({
    where: { id: credit.id },
    data: {
      category: credit.preLinkCategory ?? credit.category,
      status: credit.preLinkStatus ?? credit.status,
      preLinkCategory: null,
      preLinkStatus: null,
    },
  });
}

async function _clearCreditSide(
  db: PrismaClient,
  userId: string,
  creditId: string,
  sessionTxIds: Set<string>,
): Promise<void> {
  const debit = await (db.transaction as any).findFirst({
    where: { transferLinkedTransactionId: creditId },
    select: {
      id: true,
      preLinkCategory: true,
      preLinkStatus: true,
      category: true,
      status: true,
      amount: true,
      date: true,
    },
  });
  if (!debit) return;

  const restoredCategory = debit.preLinkCategory ?? debit.category;
  const restoredStatus = debit.preLinkStatus ?? debit.status;

  if (sessionTxIds.has(debit.id)) {
    await (db.transaction as any).update({
      where: { id: debit.id },
      data: { transferLinkedTransactionId: null, preLinkCategory: null, preLinkStatus: null },
    });
    return;
  }

  await (db.transaction as any).update({
    where: { id: debit.id },
    data: {
      transferLinkedTransactionId: null,
      category: restoredCategory,
      status: restoredStatus,
      preLinkCategory: null,
      preLinkStatus: null,
    },
  });

  if (debit.preLinkStatus === 'CONFIRMED' && restoredCategory !== TRANSFER_CATEGORY) {
    await rerollupExpenseSummary({
      prismaClient: db,
      userId,
      oldCategory: TRANSFER_CATEGORY,
      newCategory: restoredCategory,
      amount: debit.amount as Decimal,
      date: debit.date as Date,
    });
  }

  await (db.transaction as any).update({
    where: { id: creditId },
    data: { preLinkCategory: null, preLinkStatus: null },
  });
}
