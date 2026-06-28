import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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
  forceCreateIds: z.array(z.string()).optional(),
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
    const raw = await req.text();
    // raw body parsed silently (no debug logs)
    let body: unknown;
    try {
      body = raw.length ? JSON.parse(raw) : {};
    } catch (parseErr) {
      console.error(
        'CSV confirm parse error:',
        parseErr,
        'rawLength:',
        raw.length,
      );
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parse = ConfirmRequestSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 },
      );
    }

    const { fileId, llmUsage, debitMonths, creditMonths, forceCreateIds } =
      parse.data;

    // Enforce ISO date-only strings (yyyy-MM-dd) for all incoming transactions.
    // This guarantees confirm only receives canonical dates produced by classify.
    const isoDateRE = /^\d{4}-\d{2}-\d{2}$/;
    const allTxs = [
      ...debitMonths.flatMap((m: any) => m.transactions as any[]),
      ...creditMonths.flatMap((m: any) => m.transactions as any[]),
    ];

    const bad = allTxs.find((tx) => {
      const v = tx?.date;
      return typeof v !== 'string' || !isoDateRE.test(v);
    });

    if (bad) {
      return NextResponse.json(
        {
          error:
            'Invalid date format in payload. expected ISO yyyy-MM-dd for all transaction.date fields.',
        },
        { status: 400 },
      );
    }

    // request parsed successfully

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
    const bankAccountId =
      typeof metadata?.bankAccountId === 'string' ? metadata.bankAccountId : '';

    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'Bank account not found in import session' },
        { status: 400 },
      );
    }

    const [debitResult, creditResult] = await Promise.all([
      confirmDebitTransactions(
        debitMonths,
        session.user.id,
        bankAccountId,
        fileId,
        forceCreateIds,
      ),
      confirmCreditTransactions(
        creditMonths,
        session.user.id,
        bankAccountId,
        fileId,
      ),
    ]);

    const totalEntries = debitResult.totalEntries + creditResult.totalEntries;
    const duplicatesSkipped =
      debitResult.duplicatesSkipped + creditResult.duplicatesSkipped;
    const creditsExcluded = creditMonths.reduce((count, month) => {
      return (
        count +
        month.transactions.filter(
          (tx: any) =>
            tx.confirmedCategory === 'Transfer' ||
            tx.confirmedCategory === 'Excluded',
        ).length
      );
    }, 0);

    const errors = [...debitResult.errors, ...creditResult.errors];
    const status =
      errors.length > 0
        ? totalEntries > 0
          ? 'PARTIAL'
          : 'FAILED'
        : 'COMPLETED';

    // Aggregate min/max transaction date for this import
    const dateRange = await prisma.transaction.aggregate({
      where: { importSessionId: fileId },
      _min: { date: true },
      _max: { date: true },
    });

    await prisma.importSession.update({
      where: { id: fileId },
      data: {
        status,
        recordsCreated: totalEntries,
        startDate: dateRange._min.date ?? null,
        endDate: dateRange._max.date ?? null,
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

    const categoryRulesSummary = null;

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
        categoryRulesSummary,
      },
      { status: errors.length > 0 && totalEntries === 0 ? 500 : 200 },
    );
  } catch (error: unknown) {
    console.error('CSV confirm error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
