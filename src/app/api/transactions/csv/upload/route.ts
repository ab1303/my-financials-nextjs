import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { parseCommBankCsv } from '@/server/services/ai-import/csv-parser.service';
import type { CsvTransaction } from '@/server/services/ai-import/_types';
import {
  ALLOWED_CSV_MIME_TYPES,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_ROWS,
} from '@/server/services/ai-import/validation';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const bankAccountId = formData.get('bankAccountId') as string;

    if (typeof bankAccountId !== 'string' || bankAccountId.trim().length === 0) {
      return NextResponse.json({ error: 'bankAccountId is required' }, { status: 400 });
    }

    if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: session.user.id },
    });

    if (!account) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    const isValidMime = ALLOWED_CSV_MIME_TYPES.includes(mimeType);
    const isValidExtension = fileName.endsWith('.csv');

    if (!isValidMime && !isValidExtension) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${mimeType}. Only CSV files are supported.`,
        },
        { status: 400 },
      );
    }

    if (fileSize > MAX_CSV_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds 5MB limit (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const csvContent = buffer.toString('utf8');
    const parseResult = await parseCommBankCsv(csvContent);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error }, { status: 400 });
    }

    const { transactions } = parseResult;

    if (!transactions || transactions.length === 0 || transactions.length > MAX_CSV_ROWS) {
      return NextResponse.json(
        {
          error: `Invalid number of transactions. Expected 1-${MAX_CSV_ROWS}, got ${transactions?.length || 0}`,
        },
        { status: 400 },
      );
    }

    const importSession = await prisma.importSession.create({
      data: {
        userId: session.user.id,
        importType: 'EXPENSE',
        status: 'PENDING',
        metadata: {
          fileName,
          fileSize,
          bankAccountId,
          transactions,
        } as any,
      },
    });

    return NextResponse.json(
      {
        fileId: importSession.id,
        fileName,
        fileSize,
        rowCount: transactions.length,
        bankAccountId,
        bankAccountName: account.name,
        transactions: transactions as CsvTransaction[],
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error('CSV upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
