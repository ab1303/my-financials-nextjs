import { NextRequest, NextResponse } from 'next/server';
import { parseCommBankCsv } from '@/server/services/ai-import/csv-parser.service';
import { CsvUploadResponse } from '@/server/services/ai-import/_types';
import {
  ALLOWED_CSV_MIME_TYPES,
  MAX_CSV_FILE_SIZE,
  MAX_CSV_ROWS,
} from '@/server/services/ai-import/validation';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';

export async function POST(req: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    // Validate file exists and is a File object
    if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    // Validate MIME type
    const isValidMime = ALLOWED_CSV_MIME_TYPES.includes(mimeType);
    const isValidExtension = fileName.endsWith('.csv');

    if (!isValidMime && !isValidExtension) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${mimeType}. Only CSV files are supported.`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_CSV_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds 5MB limit (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
        },
        { status: 400 }
      );
    }

    // Read file as text
    const buffer = Buffer.from(await file.arrayBuffer());
    const csvContent = buffer.toString('utf8');

    // Parse CSV
    const parseResult = await parseCommBankCsv(csvContent);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error },
        { status: 400 }
      );
    }

    const { transactions } = parseResult;

    // Validate row count
    if (!transactions || transactions.length === 0 || transactions.length > MAX_CSV_ROWS) {
      return NextResponse.json(
        {
          error: `Invalid number of transactions. Expected 1-${MAX_CSV_ROWS}, got ${transactions?.length || 0}`,
        },
        { status: 400 }
      );
    }

    // Create ImportSession
    const importSession = await prisma.importSession.create({
      data: {
        userId: session.user.id,
        importType: 'EXPENSE',
        status: 'PENDING',
        metadata: {
          fileName,
          fileSize,
          transactions,
        } as any,
      },
    });

    const response: CsvUploadResponse = {
      fileId: importSession.id,
      fileName,
      fileSize,
      rowCount: transactions.length,
      transactions,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
