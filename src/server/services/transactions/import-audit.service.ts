import type { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';

export interface TransactionSummary {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
  importSessionId?: string;
}

export interface ImportSessionDetail {
  id: string;
  userId: string;
  importType: string;
  status: string;
  recordsCreated: number;
  skippedCount: number;
  metadata?: any;
  startDate?: string;
  endDate?: string;
  transactions: TransactionSummary[];
}

/**
 * Fetches import session details, including skipped count and transactions.
 * Throws NOT_FOUND if session does not exist, FORBIDDEN if userId does not match.
 */
export async function getImportSessionDetails(
  sessionId: string,
  userId: string,
  prisma: PrismaClient,
): Promise<ImportSessionDetail> {
  // Fetch the import session and its transactions
  const session = await prisma.importSession.findUnique({
    where: { id: sessionId },
    include: {
      transactions: true,
    },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Import session not found' });
  }
  if (session.userId !== userId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this import session',
    });
  }

  // Only count transactions that are not VOIDED
  const importedTransactions = session.transactions.filter((t) => t.status !== 'VOIDED');
  const skippedCount = session.recordsCreated - importedTransactions.length;

  // Map transactions to TransactionSummary
  const transactions: TransactionSummary[] = session.transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    description: t.description,
    amount: t.amount.toString(),
    status: t.status,
    importSessionId: t.importSessionId || undefined,
  }));

  return {
    id: session.id,
    userId: session.userId,
    importType: session.importType,
    status: session.status,
    recordsCreated: session.recordsCreated,
    skippedCount,
    metadata: session.metadata ?? undefined,
    startDate: session.startDate ? session.startDate.toISOString() : undefined,
    endDate: session.endDate ? session.endDate.toISOString() : undefined,
    transactions,
  };
}
