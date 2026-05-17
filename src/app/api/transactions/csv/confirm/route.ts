import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import {
  confirmCreditTransactions,
  confirmDebitTransactions,
} from '@/server/services/transactions/csv-confirm.service';
import { runTransferMatchRules } from '@/server/services/transactions/transfer-rule-job.service';

const ConfirmRequestSchema = z.object({
  fileId: z.string().min(1),
  llmUsage: z.object({
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
  }),
  debitMonths: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      transactions: z.array(z.any()),
    }),
  ),
  creditMonths: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      transactions: z.array(z.any()),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parse = ConfirmRequestSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { fileId, llmUsage, debitMonths, creditMonths } = parse.data;

    const importSession = await prisma.importSession.findUnique({
      where: { id: fileId },
    });

    if (!importSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (importSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const metadata = importSession.metadata as Record<string, unknown> | null;
    const bankAccountId = typeof metadata?.bankAccountId === 'string' ? metadata.bankAccountId : '';

    if (!bankAccountId) {
      return NextResponse.json({ error: 'Bank account not found in import session' }, { status: 400 });
    }

    const [debitResult, creditResult] = await Promise.all([
      confirmDebitTransactions(debitMonths, session.user.id, bankAccountId, fileId),
      confirmCreditTransactions(creditMonths, session.user.id, bankAccountId, fileId),
    ]);

    const totalEntries = debitResult.totalEntries + creditResult.totalEntries;
    const duplicatesSkipped = debitResult.duplicatesSkipped + creditResult.duplicatesSkipped;
    const creditsExcluded = creditMonths.reduce((count, month) => {
      return (
        count +
        month.transactions.filter((tx: any) => tx.confirmedCategory === 'Transfer' || tx.confirmedCategory === 'Excluded')
          .length
      );
    }, 0);

    const errors = [...debitResult.errors, ...creditResult.errors];
    const status = errors.length > 0 ? (totalEntries > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';

    await prisma.importSession.update({
      where: { id: fileId },
      data: {
        status,
        recordsCreated: totalEntries,
      },
    });

    let matchJobSummary: {
      rulesRan: number;
      autoLinkedCount: number;
      flaggedCount: number;
    } | null = null;
    try {
      const jobSummary = await runTransferMatchRules({
        prisma,
        userId: session.user.id,
        importSessionId: fileId,
      });
      matchJobSummary = {
        rulesRan: jobSummary.rulesRan,
        autoLinkedCount: jobSummary.autoLinkedCount,
        flaggedCount: jobSummary.flaggedCount,
      };
    } catch (jobErr) {
      console.error('Transfer match job error:', jobErr);
    }

    return NextResponse.json(
      {
        success: status !== 'FAILED',
        status,
        debitsSaved: debitResult.totalEntries,
        creditsSaved: creditResult.totalEntries,
        creditsExcluded,
        duplicatesSkipped,
        totalEntries,
        errors,
        matchJobSummary,
      },
      { status: errors.length > 0 && totalEntries === 0 ? 500 : 200 },
    );
  } catch (error: unknown) {
    console.error('CSV confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
