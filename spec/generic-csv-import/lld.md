# Generic CSV Import — Low-Level Design & Implementation Specs

**Status:** Implementation-Ready  
**For:** Phase 1 (Backend Parser) & Phase 2 (Auto-Detection)  
**Last Updated:** 2025

---

## Overview

This document specifies exact file paths, function signatures, type definitions, and implementation notes for Phases 1 & 2. Each phase is organized as a delegation unit (per AGENTS.md) with sub-tasks.

**Estimated Effort:**
- Phase 1: 12–16 hours (parser foundation, tests, route update)
- Phase 2: 8–10 hours (detection algorithm, threshold tuning, tests)

---

---

# PHASE 1: Generic Parser Foundation

## Delegation Unit: `@phase1-csv-parser-foundation`

**Objective:** Implement generic `BankCsvFormat` config type, generic parser function, and hardcoded registry for CommBank + NAB. Update upload route to use registry. Deprecate `parseCommBankCsv`.

---

## Task 1.1: Define Format Configuration Types

**File:** `src/server/services/transactions/csv-format.types.ts` (NEW)

**Responsibility:** Define all types for bank CSV format configuration.

```typescript
/**
 * Amount structure union type.
 * 
 * Example (Signed):
 *   { kind: 'signed', column: 1 } or { kind: 'signed', column: 'Amount' }
 *   → Look in column 1 (or named 'Amount'); negative = debit, positive = credit
 * 
 * Example (Split):
 *   { kind: 'split', debit: 'Debit', credit: 'Credit' }
 *   → If row['Debit'] has value → DEBIT transaction; else if row['Credit'] has value → CREDIT
 */
export type AmountStructure =
  | { kind: 'signed'; column: string | number }
  | { kind: 'split'; debit: string | number; credit: string | number };

/**
 * Bank CSV format configuration.
 * 
 * Describes the exact layout of a bank's CSV export:
 * - Whether headers are present
 * - Column names/positions for required fields (date, amount, description, balance)
 * - Date format (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY)
 * - Optional skip-rows for metadata headers (e.g., BOQ)
 */
export interface BankCsvFormat {
  /** Unique identifier for this format (e.g., 'commbank', 'nab', 'anz') */
  bankKey: string;

  /** Does this CSV include header row(s)? */
  hasHeaders: boolean;

  /** How many leading rows to skip before data starts? (default: 0) */
  skipLeadingRows?: number;

  /** Required and optional column mappings */
  columns: {
    /** Date column name (string) or index (number, 0-based) */
    date: string | number;

    /** Description/narrative column */
    description: string | number;

    /** Running balance column (optional) */
    balance?: string | number;

    /** Amount column(s) — may be single signed or split debit/credit */
    amount: AmountStructure;
  };

  /**
   * Date format in the CSV.
   * Parser will validate but NOT transform; returns raw string in CsvTransaction.date.
   * Caller responsible for ISO conversion.
   */
  dateFormat: 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
}

/**
 * Detection result from csv-format-detector.service.ts
 */
export interface FormatDetectionResult {
  /** Was a format detected with sufficient confidence? */
  matched: boolean;

  /** Detected format (if matched) */
  format: BankCsvFormat | null;

  /** Confidence score (0–1) */
  confidence: number;

  /** Which bank this was detected as (null if no match) */
  bankKey: string | null;
}

/**
 * Extended parse result with detection metadata (Phase 2)
 */
export interface CsvParseResultExtended {
  success: boolean;
  transactions?: CsvTransaction[];
  error?: string;
  message?: string;
  detectionMethod?: 'registry' | 'auto-detect' | null;  // NEW
  detectedFormat?: BankCsvFormat | null;  // NEW (only if auto-detected)
}
```

**Key Decisions:**
- `AmountStructure` is a union type; allows both patterns in same registry
- `skipLeadingRows` optional; defaults to 0
- `bankKey` is immutable identifier; same as DB `bank.key` (future)
- No transformations; parser returns raw strings/numbers from CSV

---

## Task 1.2: Implement Generic CSV Parser

**File:** `src/server/services/transactions/csv-parser-generic.service.ts` (NEW)

**Responsibility:** Implement format-agnostic CSV parsing that accepts `BankCsvFormat` config and returns `CsvTransaction[]`.

### Function Signature

```typescript
/**
 * Parse CSV content into transactions using provided format config.
 * 
 * @param csvContent - Raw CSV file content (string)
 * @param format - BankCsvFormat config (defines column layout, headers, etc.)
 * @returns CsvParseResult with success flag and either transactions or error message
 * 
 * @throws Never; all errors returned in result.error
 */
export async function parseBankCsv(
  csvContent: string,
  format: BankCsvFormat,
): Promise<CsvParseResult>;
```

### Implementation Pseudocode

```typescript
export async function parseBankCsv(
  csvContent: string,
  format: BankCsvFormat,
): Promise<CsvParseResult> {
  // 1. Validate input
  if (!csvContent?.trim()) {
    return { success: false, error: 'Empty CSV content' };
  }

  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) {
    return { success: false, error: 'CSV is empty' };
  }

  // 2. Skip leading rows (metadata, headers, etc.)
  const skipRows = format.skipLeadingRows ?? 0;
  const headerLineIndex = skipRows;
  const dataStartIndex = format.hasHeaders ? skipRows + 1 : skipRows;

  if (dataStartIndex >= lines.length) {
    return { success: false, error: 'No data rows found in CSV' };
  }

  // 3. Extract and normalize headers
  let headers: string[];
  if (format.hasHeaders) {
    if (!lines[headerLineIndex]) {
      return { success: false, error: 'Header row missing' };
    }
    headers = parseCSVLine(lines[headerLineIndex]);
    headers = headers.map(h => h.toLowerCase().trim());  // normalize
  } else {
    // No headers; generate positional names: '0', '1', '2', ...
    const sampleLine = parseCSVLine(lines[dataStartIndex]);
    headers = Array.from({ length: sampleLine.length }, (_, i) => i.toString());
  }

  // 4. Validate that all required columns exist
  const requiredColumns = [
    format.columns.date,
    format.columns.description,
    format.columns.amount.kind === 'signed'
      ? format.columns.amount.column
      : [format.columns.amount.debit, format.columns.amount.credit],
  ].flat();
  
  for (const col of requiredColumns) {
    const colIndex = typeof col === 'number' ? col : getColumnIndex(headers, col);
    if (colIndex === -1) {
      return {
        success: false,
        error: `Required column not found: ${col}`,
      };
    }
  }

  // 5. Parse data rows
  const transactions: CsvTransaction[] = [];
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row = buildRowObject(headers, values, format.hasHeaders);
      
      const tx = parseSingleTransaction(row, format);
      if (tx) {
        transactions.push(tx);
      }
    } catch (err) {
      return {
        success: false,
        error: `Error parsing row ${i}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // 6. Validate result
  if (transactions.length === 0) {
    return { success: false, error: 'No valid transactions found' };
  }

  return {
    success: true,
    transactions,
    message: `Successfully parsed ${transactions.length} transactions`,
  };
}

/**
 * Parse a single row into CsvTransaction.
 * Returns null if amount is zero (skipped).
 */
function parseSingleTransaction(
  row: Record<string, string>,
  format: BankCsvFormat,
): CsvTransaction | null {
  // Extract date
  const dateStr = getFieldValue(row, format.columns.date).trim();
  if (!dateStr) {
    throw new Error('Missing date field');
  }
  
  // Validate date format
  if (!isValidDate(dateStr, format.dateFormat)) {
    throw new Error(`Invalid date format: "${dateStr}" (expected ${format.dateFormat})`);
  }

  // Extract description
  const description = getFieldValue(row, format.columns.description).trim() || '';

  // Extract amount and derive DEBIT/CREDIT type
  const { amount, type } = extractAmountAndType(row, format.columns.amount);
  
  if (amount === 0) {
    return null;  // Skip zero amounts
  }

  // Extract optional balance
  const balanceStr = format.columns.balance
    ? getFieldValue(row, format.columns.balance).trim()
    : '';
  const balance = balanceStr && !isNaN(parseFloat(balanceStr))
    ? parseFloat(balanceStr)
    : undefined;

  // Parse date string to extract month/year
  const { month, year } = parseDateComponents(dateStr, format.dateFormat);

  return {
    date: dateStr,  // raw string, NOT transformed to ISO
    amount,         // always positive absolute value
    type,           // DEBIT or CREDIT
    description,
    month,
    year,
    balance,        // optional
  };
}

/**
 * Extract amount and transaction type from row based on AmountStructure.
 * Returns { amount: positive absolute value, type: 'DEBIT' | 'CREDIT' }
 */
function extractAmountAndType(
  row: Record<string, string>,
  amountStructure: AmountStructure,
): { amount: number; type: 'DEBIT' | 'CREDIT' } {
  if (amountStructure.kind === 'signed') {
    // Single column; sign indicates direction
    const amountStr = getFieldValue(row, amountStructure.column).trim();
    if (!amountStr) {
      throw new Error('Missing amount field');
    }
    
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum)) {
      throw new Error(`Invalid amount: "${amountStr}"`);
    }

    const type = amountNum < 0 ? 'DEBIT' : 'CREDIT';
    return {
      amount: Math.abs(amountNum),
      type,
    };
  } else if (amountStructure.kind === 'split') {
    // Separate debit/credit columns
    const debitStr = getFieldValue(row, amountStructure.debit).trim();
    const creditStr = getFieldValue(row, amountStructure.credit).trim();

    const debit = debitStr ? parseFloat(debitStr) : 0;
    const credit = creditStr ? parseFloat(creditStr) : 0;

    if (debit && isNaN(debit)) {
      throw new Error(`Invalid debit amount: "${debitStr}"`);
    }
    if (credit && isNaN(credit)) {
      throw new Error(`Invalid credit amount: "${creditStr}"`);
    }

    if (debit > 0 && credit > 0) {
      throw new Error('Both debit and credit have values; expected one');
    }

    if (debit > 0) {
      return { amount: debit, type: 'DEBIT' };
    } else if (credit > 0) {
      return { amount: credit, type: 'CREDIT' };
    } else {
      throw new Error('No debit or credit amount found');
    }
  }

  throw new Error('Invalid AmountStructure');
}

/**
 * Helper: get field value from row object (case-insensitive if string key).
 * Handles numeric column indices.
 */
function getFieldValue(
  row: Record<string, string>,
  columnRef: string | number,
): string {
  if (typeof columnRef === 'number') {
    // Numeric index; row keys are stringified indices
    return row[String(columnRef)] ?? '';
  } else {
    // String column name; normalize to lowercase
    const key = Object.keys(row).find(
      k => k.toLowerCase() === columnRef.toLowerCase(),
    );
    return key ? row[key] : '';
  }
}

/**
 * Parse CSV line with quoted field handling.
 * Mirrors existing parseCSVLine logic from csv-parser.service.ts.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Validate date format matches expected pattern.
 */
function isValidDate(dateStr: string, format: string): boolean {
  const patterns: Record<string, RegExp> = {
    'DD/MM/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
    'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
    'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,  // same pattern as DD/MM; validation in parseDateComponents
  };
  return patterns[format]?.test(dateStr) ?? false;
}

/**
 * Extract month and year from date string.
 */
function parseDateComponents(
  dateStr: string,
  format: string,
): { month: number; year: number } {
  let day: number, month: number, year: number;

  if (format === 'DD/MM/YYYY') {
    const parts = dateStr.split('/');
    day = parseInt(parts[0]!, 10);
    month = parseInt(parts[1]!, 10);
    year = parseInt(parts[2]!, 10);
  } else if (format === 'YYYY-MM-DD') {
    const parts = dateStr.split('-');
    year = parseInt(parts[0]!, 10);
    month = parseInt(parts[1]!, 10);
    day = parseInt(parts[2]!, 10);
  } else if (format === 'MM/DD/YYYY') {
    const parts = dateStr.split('/');
    month = parseInt(parts[0]!, 10);
    day = parseInt(parts[1]!, 10);
    year = parseInt(parts[2]!, 10);
  } else {
    throw new Error(`Unknown date format: ${format}`);
  }

  if (isNaN(month) || isNaN(year) || isNaN(day)) {
    throw new Error(`Failed to parse date: ${dateStr}`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}`);
  }

  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}`);
  }

  return { month, year };
}

/**
 * Build row object from headers and values.
 * If headers are numeric strings (0, 1, 2...), use as-is.
 * Otherwise, normalize to lowercase for case-insensitive lookup.
 */
function buildRowObject(
  headers: string[],
  values: string[],
  isNamed: boolean,
): Record<string, string> {
  const row: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (isNamed) {
      // Named headers; lowercase for case-insensitive access
      row[header.toLowerCase()] = values[index] ?? '';
    } else {
      // Numeric indices
      row[header] = values[index] ?? '';
    }
  });
  return row;
}

/**
 * Get column index by name (case-insensitive).
 * Returns -1 if not found.
 */
function getColumnIndex(headers: string[], columnName: string): number {
  const normalized = columnName.toLowerCase();
  return headers.findIndex(h => h.toLowerCase() === normalized);
}
```

**Key Notes:**
- No transformation; returns raw date strings
- Handles both signed and split amount columns
- Skips zero amounts (returns null)
- Validates date format but doesn't convert
- Case-insensitive column matching for named columns
- Numeric column indices for headerless CSVs

---

## Task 1.3: Create Bank Format Registry

**File:** `src/server/services/transactions/bank-format-registry.ts` (NEW)

**Responsibility:** Hardcoded singleton registry of bank format configs. Provides lookup function.

```typescript
import type { BankCsvFormat } from './csv-format.types';

/**
 * Hardcoded registry of bank CSV formats.
 * Maps bank.name (or bankKey) → BankCsvFormat config.
 * 
 * Phase 1: CommBank + NAB (full support)
 * Phase 1 Stub: ANZ, Westpac (placeholder, to be implemented later)
 * 
 * DB field mapping (future):
 *   BankAccount.bank.key → registry lookup
 *   e.g., "bank.key" = 'commbank' → looks up BANK_FORMAT_REGISTRY['commbank']
 */
export const BANK_FORMAT_REGISTRY: Record<string, BankCsvFormat> = {
  /**
   * Commonwealth Bank web export (headerless format)
   * 
   * Sample:
   *   31/07/2025,"-90.72","WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 29/07/2025","+18811.43"
   *   31/07/2025,"-3.50","KMART 1042KMART 1042 HORNSBY 02 AUS Card xx5441 Value Date: 29/07/2025","+18902.15"
   * 
   * Columns (positional, 0-indexed):
   *   0: Date (DD/MM/YYYY)
   *   1: Amount (signed: negative = debit, positive = credit)
   *   2: Description (may contain commas; quoted)
   *   3: Balance (running account balance)
   */
  commbank: {
    bankKey: 'commbank',
    hasHeaders: false,
    columns: {
      date: 0,
      amount: { kind: 'signed', column: 1 },
      description: 2,
      balance: 3,
    },
    dateFormat: 'DD/MM/YYYY',
  },

  /**
   * National Australia Bank (NAB) export format
   * 
   * Sample:
   *   Date,Narrative,Debit,Credit,Balance
   *   01/07/2025,SALARY DEPOSIT,0.00,5000.00,15000.00
   *   02/07/2025,GROCERIES STORE,-50.00,0.00,14950.00
   * 
   * Features:
   *   - Has header row
   *   - Date format: DD/MM/YYYY
   *   - Amount split into Debit (expense) and Credit (income) columns
   *   - Optional Balance column (running balance)
   */
  nab: {
    bankKey: 'nab',
    hasHeaders: true,
    columns: {
      date: 'Date',
      description: 'Narrative',
      amount: { kind: 'split', debit: 'Debit', credit: 'Credit' },
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },

  /**
   * Australia & New Zealand Bank (ANZ) — STUB for Phase 2+
   * To be configured based on actual ANZ CSV format.
   * 
   * Expected format (TBD):
   *   - Has headers
   *   - Date format: DD/MM/YYYY
   *   - Amount: likely signed column
   */
  anz: {
    bankKey: 'anz',
    hasHeaders: true,
    columns: {
      date: 'Transaction Date',
      description: 'Description',
      amount: { kind: 'signed', column: 'Amount' },
    },
    dateFormat: 'DD/MM/YYYY',
  },

  /**
   * Westpac — STUB for Phase 2+
   * To be configured based on actual Westpac CSV format.
   * 
   * Expected format (TBD):
   *   - Has headers
   *   - Date format: DD/MM/YYYY
   *   - Amount: likely split debit/credit columns
   */
  westpac: {
    bankKey: 'westpac',
    hasHeaders: true,
    columns: {
      date: 'Date',
      description: 'Description',
      amount: { kind: 'split', debit: 'Debit', credit: 'Credit' },
    },
    dateFormat: 'DD/MM/YYYY',
  },
};

/**
 * Look up a bank format by key.
 * Returns the format config or undefined if not in registry.
 * 
 * @param bankKey - Bank identifier (e.g., 'commbank', 'nab')
 * @returns BankCsvFormat config or undefined
 */
export function getBankFormat(bankKey: string): BankCsvFormat | undefined {
  return BANK_FORMAT_REGISTRY[bankKey.toLowerCase()];
}

/**
 * Get list of all registered bank keys.
 * Useful for generating error messages: "Supported banks: ..."
 */
export function getRegisteredBankKeys(): string[] {
  return Object.keys(BANK_FORMAT_REGISTRY);
}

/**
 * Check if a bank key is registered (has a full config, not a stub).
 */
export function isFullySupported(bankKey: string): boolean {
  const format = getBankFormat(bankKey);
  if (!format) return false;
  
  // Stubs have minimal config; full support requires actual test data
  // For now, CommBank + NAB are fully supported; others are stubs
  return ['commbank', 'nab'].includes(bankKey.toLowerCase());
}
```

**Key Decisions:**
- Singleton object (not class); immutable
- Lowercase keys for case-insensitive lookup
- Stub entries for ANZ, Westpac (placeholder; confidence detection will use these)
- Export helper functions for lookup, listing, support status

---

## Task 1.4: Update Upload Route to Use Registry

**File:** `src/app/api/transactions/csv/upload/route.ts` (MODIFY)

**Current Responsibility:** `POST /api/transactions/csv/upload` — upload and parse CSV

**New Responsibility:** Chain format resolution: registry → auto-detect (Phase 2) → error

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { parseBankCsv } from '@/server/services/transactions/csv-parser-generic.service';
import { getBankFormat } from '@/server/services/transactions/bank-format-registry';
import type { CsvTransaction } from '@/server/services/ai-import/_types';
import type { BankCsvFormat } from '@/server/services/transactions/csv-format.types';
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

    // Validate bankAccountId
    if (typeof bankAccountId !== 'string' || bankAccountId.trim().length === 0) {
      return NextResponse.json({ error: 'bankAccountId is required' }, { status: 400 });
    }

    // Validate file exists and is uploadable
    if (!file || typeof file === 'string' || !('arrayBuffer' in file)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check bank account exists and belongs to user
    const account = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: session.user.id },
      include: { bank: true },  // Include bank to get bank.name
    });

    if (!account || !account.bank) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;

    // Validate file type
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

    // Validate file size
    if (fileSize > MAX_CSV_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds 5MB limit (${(fileSize / 1024 / 1024).toFixed(2)}MB)`,
        },
        { status: 400 },
      );
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    const csvContent = buffer.toString('utf8');

    // **NEW: Resolve format (Tier 1: registry)**
    let detectedFormat: BankCsvFormat | undefined;
    let detectionMethod: 'registry' | 'auto-detect' | null = null;

    const bankKey = account.bank.name.toLowerCase().replace(/\s+/g, '');  // e.g., "Commonwealth Bank" → "commwealthbank"
    detectedFormat = getBankFormat(bankKey);

    if (detectedFormat) {
      detectionMethod = 'registry';
    } else {
      // Tier 2: auto-detect (will be implemented in Phase 2)
      // For now, return error
      return NextResponse.json(
        {
          error: `Bank format not supported: ${account.bank.name}. Supported banks: CommBank, NAB.`,
        },
        { status: 400 },
      );
    }

    // Parse CSV using resolved format
    const parseResult = await parseBankCsv(csvContent, detectedFormat);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error || 'Failed to parse CSV' },
        { status: 400 },
      );
    }

    const { transactions } = parseResult;

    // Validate transaction count
    if (!transactions || transactions.length === 0 || transactions.length > MAX_CSV_ROWS) {
      return NextResponse.json(
        {
          error: `Invalid number of transactions. Expected 1–${MAX_CSV_ROWS}, got ${transactions?.length || 0}`,
        },
        { status: 400 },
      );
    }

    // Create import session
    const importSession = await prisma.importSession.create({
      data: {
        userId: session.user.id,
        importType: 'EXPENSE',
        status: 'PENDING',
        metadata: {
          fileName,
          fileSize,
          bankAccountId,
          bankName: account.bank.name,
          detectionMethod,
          detectedFormat: detectionMethod === 'auto-detect' ? detectedFormat : null,
          transactions,
        } as any,
      },
    });

    // Return success response
    return NextResponse.json(
      {
        fileId: importSession.id,
        fileName,
        fileSize,
        rowCount: transactions.length,
        bankAccountId,
        bankAccountName: account.name,
        bankName: account.bank.name,
        detectionMethod,
        detectedFormat: detectionMethod === 'auto-detect' ? detectedFormat : null,
        transactions: transactions as CsvTransaction[],
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error('CSV upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Key Changes:**
- Import `getBankFormat` from registry
- Look up bank format by `account.bank.name`
- Return 400 if format not in registry (Phase 2 will add auto-detect fallback)
- Include `detectionMethod` and `detectedFormat` in response
- Store both in `importSession.metadata`

---

## Task 1.5: Deprecate Old CommBank Parser

**File:** `src/server/services/ai-import/csv-parser.service.ts` (MODIFY)

**Responsibility:** Wrap old `parseCommBankCsv` to call generic parser; add `@deprecated` JSDoc.

```typescript
/**
 * @deprecated Use parseBankCsv(content, format) from csv-parser-generic.service.ts instead.
 * 
 * This wrapper maintains backward compatibility for existing code.
 * Will be removed in v2.0.
 */
export async function parseCommBankCsv(csvContent: string): Promise<CsvParseResult> {
  const { getBankFormat } = await import(
    '@/server/services/transactions/bank-format-registry'
  );
  const { parseBankCsv } = await import(
    '@/server/services/transactions/csv-parser-generic.service'
  );

  const commBankFormat = getBankFormat('commbank');
  if (!commBankFormat) {
    return {
      success: false,
      error: 'CommBank format not found in registry',
    };
  }

  return parseBankCsv(csvContent, commBankFormat);
}

// Remove all old parseCommBankCsv implementation; replace with wrapper above
```

**Key Notes:**
- Dynamic import to avoid circular dependencies
- Calls new generic parser with CommBank format from registry
- All existing code using `parseCommBankCsv` continues to work
- Deprecation warning guides users to new API

---

## Task 1.6: Add Unit Tests for Generic Parser

**File:** `src/__tests__/unit/csv-parser-generic.test.ts` (NEW)

**Responsibility:** Test generic parser with CommBank and NAB formats; ensure backward compatibility.

```typescript
import { describe, it, expect } from 'vitest';
import { parseBankCsv } from '@/server/services/transactions/csv-parser-generic.service';
import {
  getBankFormat,
  BANK_FORMAT_REGISTRY,
} from '@/server/services/transactions/bank-format-registry';

describe('parseBankCsv — CommBank Format', () => {
  const commBankFormat = getBankFormat('commbank')!;

  it('parses CommBank headerless CSV with signed amounts', async () => {
    const csv = [
      '01/01/2024,"-50.00","Groceries",950.00',
      '02/01/2024,"1000.00","Salary",1950.00',
      '03/01/2024,"-20.50","Coffee",929.50',
    ].join('\n');

    const result = await parseBankCsv(csv, commBankFormat);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions![0]).toMatchObject({
      date: '01/01/2024',
      amount: 50,
      type: 'DEBIT',
      description: 'Groceries',
      month: 1,
      year: 2024,
      balance: 950,
    });
    expect(result.transactions![1]).toMatchObject({
      amount: 1000,
      type: 'CREDIT',
    });
  });

  it('skips zero amounts', async () => {
    const csv = [
      '01/01/2024,"-50.00","Groceries",950.00',
      '02/01/2024,"0.00","Zero Transaction",950.00',
      '03/01/2024,"-20.00","Coffee",930.00',
    ].join('\n');

    const result = await parseBankCsv(csv, commBankFormat);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);
  });

  it('handles quoted fields with special chars', async () => {
    const csv =
      '01/01/2024,"-123.45","STORE, INC. (LOCATION)","1234.55"\n';

    const result = await parseBankCsv(csv, commBankFormat);

    expect(result.success).toBe(true);
    expect(result.transactions![0].description).toBe('STORE, INC. (LOCATION)');
  });

  it('returns error on invalid date format', async () => {
    const csv = [
      '2024-01-01,"-50.00","Test",950.00',  // Wrong format (should be DD/MM/YYYY)
    ].join('\n');

    const result = await parseBankCsv(csv, commBankFormat);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid date format/);
  });

  it('returns error on empty CSV', async () => {
    const result = await parseBankCsv('', commBankFormat);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Empty/);
  });

  it('returns error on no valid transactions', async () => {
    const csv = ['01/01/2024,"0.00","Zero",100.00'].join('\n');
    const result = await parseBankCsv(csv, commBankFormat);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No valid transactions/);
  });

  it('extracts month and year correctly', async () => {
    const csv = [
      '15/12/2023,"-100.00","December",900.00',
      '20/05/2024,"-50.00","May",1100.00',
    ].join('\n');

    const result = await parseBankCsv(csv, commBankFormat);

    expect(result.success).toBe(true);
    expect(result.transactions![0]).toMatchObject({ month: 12, year: 2023 });
    expect(result.transactions![1]).toMatchObject({ month: 5, year: 2024 });
  });
});

describe('parseBankCsv — NAB Format', () => {
  const nabFormat = getBankFormat('nab')!;

  it('parses NAB CSV with headers and split debit/credit columns', async () => {
    const csv = [
      'Date,Narrative,Debit,Credit,Balance',
      '01/07/2024,SALARY DEPOSIT,0.00,5000.00,15000.00',
      '02/07/2024,GROCERIES STORE,50.00,0.00,14950.00',
      '03/07/2024,TRANSFER OUT,1000.00,0.00,13950.00',
    ].join('\n');

    const result = await parseBankCsv(csv, nabFormat);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(3);
    
    // Salary (credit)
    expect(result.transactions![0]).toMatchObject({
      date: '01/07/2024',
      amount: 5000,
      type: 'CREDIT',
      description: 'SALARY DEPOSIT',
      month: 7,
      year: 2024,
    });

    // Groceries (debit)
    expect(result.transactions![1]).toMatchObject({
      amount: 50,
      type: 'DEBIT',
      description: 'GROCERIES STORE',
    });
  });

  it('returns error if both debit and credit have values', async () => {
    const csv = [
      'Date,Narrative,Debit,Credit,Balance',
      '01/07/2024,INVALID,50.00,100.00,9000.00',
    ].join('\n');

    const result = await parseBankCsv(csv, nabFormat);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/both debit and credit/i);
  });

  it('skips rows with zero in both debit and credit', async () => {
    const csv = [
      'Date,Narrative,Debit,Credit,Balance',
      '01/07/2024,SALARY,0.00,1000.00,1000.00',
      '02/07/2024,ZERO ROW,0.00,0.00,1000.00',
      '03/07/2024,PURCHASE,50.00,0.00,950.00',
    ].join('\n');

    const result = await parseBankCsv(csv, nabFormat);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(2);  // Zero row skipped
  });

  it('handles case-insensitive header matching', async () => {
    const csv = [
      'date,narrative,debit,credit,balance',  // lowercase
      '01/07/2024,TEST,0.00,100.00,100.00',
    ].join('\n');

    const result = await parseBankCsv(csv, nabFormat);

    expect(result.success).toBe(true);
    expect(result.transactions).toHaveLength(1);
  });
});

describe('parseBankCsv — Backward Compatibility', () => {
  it('CommBank output matches old parseCommBankCsv format', async () => {
    // Ensure generic parser produces same output as old implementation
    const csv = [
      '31/07/2025,"-90.72","WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 29/07/2025","+18811.43"',
    ].join('\n');

    const format = getBankFormat('commbank')!;
    const result = await parseBankCsv(csv, format);

    expect(result.success).toBe(true);
    expect(result.transactions![0]).toEqual({
      date: '31/07/2025',
      amount: 90.72,
      type: 'DEBIT',
      description: 'WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 29/07/2025',
      month: 7,
      year: 2025,
      balance: 18811.43,
    });
  });
});

describe('getBankFormat', () => {
  it('returns CommBank format', () => {
    const format = getBankFormat('commbank');
    expect(format).toBeDefined();
    expect(format!.bankKey).toBe('commbank');
    expect(format!.hasHeaders).toBe(false);
  });

  it('returns NAB format', () => {
    const format = getBankFormat('nab');
    expect(format).toBeDefined();
    expect(format!.bankKey).toBe('nab');
    expect(format!.hasHeaders).toBe(true);
  });

  it('returns undefined for unknown bank', () => {
    const format = getBankFormat('unknown-bank');
    expect(format).toBeUndefined();
  });

  it('case-insensitive lookup', () => {
    const format1 = getBankFormat('CommBank');
    const format2 = getBankFormat('COMMBANK');
    expect(format1).toEqual(format2);
  });
});
```

**Coverage:**
- CommBank headerless format (signed amounts)
- NAB header format (split debit/credit)
- Error cases (invalid date, no transactions, etc.)
- Backward compatibility with old output format
- Registry lookup functions

---

## Task 1.7: Update UI to Show Format Badge

**File:** `src/app/(authorized)/cashflow/transactions/_components/csv/CSVUploadStep.tsx` (MODIFY)

**Current Behavior:** Shows hardcoded "Supports CommBank CSV format"

**New Behavior:** Show format badge + supported banks list

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CSVUploadStepProps, UploadedCSVFile } from './_types';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function CSVUploadStep({
  file,
  onFileSelected,
  onRemoveFile,
  onStartImport,
  isLoading = false,
  bankAccounts,
  selectedBankAccountId,
  onBankAccountChange,
}: CSVUploadStepProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [detectionMethod, setDetectionMethod] = useState<
    'registry' | 'auto-detect' | null
  >(null);

  const validateCSV = async (csvFile: File): Promise<UploadedCSVFile | null> => {
    if (!selectedBankAccountId) {
      setValidationError('Please select a bank account before uploading.');
      return null;
    }

    setIsValidating(true);
    setValidationError(null);
    setDetectionMethod(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('bankAccountId', selectedBankAccountId ?? '');

      const response = await fetch('/api/transactions/csv/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to validate CSV file';
        setValidationError(errorMessage);
        setIsValidating(false);
        return null;
      }

      const uploadResponse = await response.json();
      setDetectionMethod(uploadResponse.detectionMethod);

      const uploadedFile: UploadedCSVFile = {
        id: uploadResponse.fileId,
        file: csvFile,
        fileName: uploadResponse.fileName,
        fileSize: uploadResponse.fileSize,
        rowCount: uploadResponse.rowCount,
        status: 'valid',
        transactions: uploadResponse.transactions,
      };

      onFileSelected(uploadedFile);
      setIsValidating(false);
      return uploadedFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to validate CSV';
      setValidationError(errorMessage);
      setIsValidating(false);
      return null;
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const csvFile = acceptedFiles[0];
      if (!csvFile) return;

      if (!csvFile.type.includes('csv') && !csvFile.name.endsWith('.csv')) {
        setValidationError('Please upload a CSV file');
        return;
      }

      if (csvFile.size > MAX_FILE_SIZE) {
        setValidationError('File size exceeds 5MB limit');
        return;
      }

      await validateCSV(csvFile);
    },
    [selectedBankAccountId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.csv'],
    },
    multiple: false,
    disabled: isValidating || isLoading,
  });

  return (
    <div className='space-y-6'>
      {/* Bank Account Selection */}
      <div className='space-y-2 mb-6'>
        <label className='text-sm font-medium text-gray-700'>
          Bank Account <span className='text-red-500'>*</span>
        </label>
        <select
          value={selectedBankAccountId ?? ''}
          onChange={(e) => onBankAccountChange(e.target.value)}
          className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
          required
        >
          <option value=''>Select a bank account</option>
          {bankAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.bankName} — {acc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Supported Banks Info */}
      <div className='rounded-lg border border-teal-200 bg-teal-50 p-4'>
        <h4 className='text-sm font-semibold text-teal-900 mb-2'>Supported Banks</h4>
        <p className='text-sm text-teal-800'>
          Phase 1: <strong>Commonwealth Bank (CBA)</strong>, <strong>National Australia Bank (NAB)</strong>
        </p>
        <p className='text-xs text-teal-700 mt-2'>
          Other Australian banks coming soon. Unknown formats will be detected automatically.
        </p>
      </div>

      {!file ? (
        <>
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            } ${isValidating ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className='mx-auto mb-4 h-12 w-12 text-gray-400' />
            <h3 className='mb-1 text-lg font-semibold text-gray-900'>
              {isDragActive ? 'Drop your CSV file here' : 'Drop CSV file or click to select'}
            </h3>
            <p className='mb-4 text-sm text-gray-600'>
              Upload your bank's CSV export. Formats will be auto-detected.
            </p>
            <p className='text-xs text-gray-500'>
              Maximum file size: 5MB | Maximum 1000 rows
            </p>
          </div>

          {validationError && (
            <div className='flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-4'>
              <AlertCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-600' />
              <div>
                <h4 className='text-sm font-semibold text-red-900'>Validation Error</h4>
                <p className='mt-1 text-sm text-red-800'>{validationError}</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* File Details Card */}
          <div className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex-1'>
                <div className='flex items-center gap-2'>
                  <p className='text-sm font-semibold text-gray-900'>{file.fileName}</p>
                  {detectionMethod && (
                    <span className='inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-1 text-xs font-medium text-teal-700'>
                      <CheckCircle className='h-3 w-3' />
                      {detectionMethod === 'registry' ? 'Registry' : 'Auto-Detected'}
                    </span>
                  )}
                </div>
                <p className='mt-1 text-xs text-gray-600'>
                  {file.rowCount} rows | {(file.fileSize / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={onRemoveFile}
                disabled={isLoading}
                className='text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50'
                aria-label='Remove file'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            {/* Transaction Preview */}
            {file.transactions && file.transactions.length > 0 && (
              <div className='mt-4 border-t border-gray-200 pt-4'>
                <p className='mb-2 text-xs font-medium text-gray-700'>
                  Preview ({Math.min(3, file.transactions.length)} of {file.transactions.length})
                </p>
                <div className='space-y-2'>
                  {file.transactions.slice(0, 3).map((tx, idx) => (
                    <div
                      key={idx}
                      className='rounded border border-gray-100 bg-white p-2 text-xs text-gray-600'
                    >
                      <div className='flex justify-between'>
                        <span className='truncate'>{tx.description}</span>
                        <span
                          className={`ml-2 flex-shrink-0 font-medium ${
                            tx.type === 'DEBIT' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {tx.type === 'DEBIT' ? '−' : '+'} ${tx.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className='mt-1 text-gray-500'>{tx.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className='flex justify-between gap-3'>
            <Button variant='outline' onClick={onRemoveFile} disabled={isLoading}>
              Choose Different File
            </Button>
            <Button
              variant='default'
              onClick={onStartImport}
              disabled={isLoading || !selectedBankAccountId || !file}
            >
              {isLoading ? 'Processing...' : 'Import CSV'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

**Changes:**
- Add "Supported Banks" info box (Phase 1: CBA, NAB)
- Show format badge after upload (Registry or Auto-Detected)
- Update drop-zone text to mention auto-detection
- Show DEBIT/CREDIT symbols in preview (red/green)
- Store `detectionMethod` state

---

## Task 1.8: Add NAB Test Fixture

**File:** `src/__tests__/fixtures/nab-sample.csv` (NEW)

```csv
Date,Narrative,Debit,Credit,Balance
01/07/2024,SALARY DEPOSIT,0.00,5000.00,15000.00
02/07/2024,WOOLWORTHS GROCERIES,87.45,0.00,14912.55
03/07/2024,TRANSFER IN - JOHN,0.00,500.00,15412.55
04/07/2024,UTILITY BILL PAYMENT,123.80,0.00,15288.75
05/07/2024,ATM WITHDRAWAL,200.00,0.00,15088.75
06/07/2024,INTEREST EARNED,0.00,12.50,15101.25
07/07/2024,PURCHASE - AMAZON,45.99,0.00,15055.26
08/07/2024,TRANSFER OUT,1000.00,0.00,14055.26
09/07/2024,RENT PAYMENT,1500.00,0.00,12555.26
10/07/2024,REFUND,0.00,87.45,12642.71
```

---

## Phase 1 Completion Checklist

- [ ] Task 1.1: `csv-format.types.ts` — type definitions
- [ ] Task 1.2: `csv-parser-generic.service.ts` — generic parser implementation
- [ ] Task 1.3: `bank-format-registry.ts` — CommBank + NAB + stubs
- [ ] Task 1.4: Update `/api/transactions/csv/upload/route.ts` — registry resolution
- [ ] Task 1.5: Deprecate `parseCommBankCsv` — thin wrapper
- [ ] Task 1.6: `csv-parser-generic.test.ts` — 15+ test suites
- [ ] Task 1.7: Update `CSVUploadStep.tsx` — format badge, bank list
- [ ] Task 1.8: Add `nab-sample.csv` fixture
- [ ] Run `pnpm run build` — no errors
- [ ] All existing `csv-parser.test.ts` tests pass
- [ ] New `csv-parser-generic.test.ts` tests all pass

---

---

# PHASE 2: Auto-Detection Fallback

## Delegation Unit: `@phase2-csv-format-detection`

**Objective:** Implement auto-detection algorithm for unknown banks. Chain: registry → auto-detect → error. Update upload route to use detector.

---

## Task 2.1: Implement Format Detection Service

**File:** `src/server/services/transactions/csv-format-detector.service.ts` (NEW)

**Responsibility:** Inspect CSV headers and sample rows; calculate confidence score; return matched format or null.

```typescript
import type { BankCsvFormat, FormatDetectionResult } from './csv-format.types';
import { BANK_FORMAT_REGISTRY } from './bank-format-registry';

/**
 * CSV header keywords for each format field.
 * Used for similarity matching during auto-detection.
 */
const HEADER_KEYWORDS = {
  date: ['date', 'transaction date', 'value date', 'posting date', 'when posted'],
  description: [
    'description',
    'narrative',
    'details',
    'memo',
    'transaction details',
    'reference',
  ],
  debit: ['debit', 'withdrawal', 'spent', 'out', 'expense'],
  credit: ['credit', 'deposit', 'income', 'in', 'received'],
  balance: ['balance', 'available balance', 'ending balance', 'account balance'],
};

/**
 * Detect CSV format by inspecting headers and sample data rows.
 * Returns a FormatDetectionResult with matched format and confidence score.
 * 
 * Algorithm:
 * 1. Extract headers from CSV (first row or user-provided)
 * 2. For each stub format in registry:
 *    a. Calculate keyword similarity for each required column
 *    b. Calculate overall structural match score
 *    c. Combine scores: (keyword_match * 0.6) + (structure_match * 0.4)
 * 3. Return format with highest confidence if ≥ 0.80; else return null
 * 
 * @param headers - CSV column headers (already parsed and trimmed)
 * @param sampleRows - First 3–5 data rows as Record<string, string>[] for structure validation
 * @returns FormatDetectionResult with matched format and confidence
 */
export function detectCsvFormat(
  headers: string[],
  sampleRows: Record<string, string>[],
): FormatDetectionResult {
  if (headers.length === 0) {
    return {
      matched: false,
      format: null,
      confidence: 0,
      bankKey: null,
    };
  }

  // Normalize headers for comparison
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  let bestMatch: { bankKey: string; format: BankCsvFormat; confidence: number } | null = null;

  // Try each stub format (exclude fully-supported CommBank and NAB)
  const stubFormats = ['anz', 'westpac'];

  for (const bankKey of stubFormats) {
    const format = BANK_FORMAT_REGISTRY[bankKey];
    if (!format || !format.hasHeaders) {
      // Skip headerless formats; they can't be auto-detected
      continue;
    }

    // Calculate confidence for this format
    const confidence = calculateFormatConfidence(format, normalizedHeaders, sampleRows);

    if (confidence > (bestMatch?.confidence ?? 0)) {
      bestMatch = { bankKey, format, confidence };
    }
  }

  // Return result if best match meets threshold
  const CONFIDENCE_THRESHOLD = 0.80;

  if (bestMatch && bestMatch.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      matched: true,
      format: bestMatch.format,
      confidence: bestMatch.confidence,
      bankKey: bestMatch.bankKey,
    };
  }

  return {
    matched: false,
    format: null,
    confidence: bestMatch?.confidence ?? 0,
    bankKey: null,
  };
}

/**
 * Calculate confidence score for a format against CSV headers and sample data.
 * 
 * Score = (keyword_match_score * 0.6) + (structure_match_score * 0.4)
 *   - keyword_match_score: how well column names match expected keywords (0–1)
 *   - structure_match_score: validation against sample data (0–1)
 */
function calculateFormatConfidence(
  format: BankCsvFormat,
  normalizedHeaders: string[],
  sampleRows: Record<string, string>[],
): number {
  // Extract expected column names from format
  const expectedColumns = extractExpectedColumns(format);

  // Calculate keyword similarity
  let keywordScore = 0;
  const scoredColumns = Object.entries(expectedColumns);

  for (const [role, columnRef] of scoredColumns) {
    if (typeof columnRef !== 'string') continue;

    const columnName = columnRef.toLowerCase();
    const score = findBestHeaderMatch(columnName, normalizedHeaders, role);
    keywordScore += score;
  }

  keywordScore = keywordScore / scoredColumns.length;  // Average

  // Calculate structural match (sample data validation)
  let structureScore = 1.0;
  if (sampleRows.length > 0) {
    const validRowCount = sampleRows.filter(row =>
      validateRowAgainstFormat(row, format),
    ).length;
    structureScore = validRowCount / sampleRows.length;
  }

  // Combine scores
  return (keywordScore * 0.6) + (structureScore * 0.4);
}

/**
 * Find the best matching header for an expected column name.
 * Returns similarity score (0–1).
 * 
 * Matching strategy:
 * 1. Exact match: 1.0
 * 2. Contains keyword: 0.8
 * 3. Fuzzy match (edit distance ≤ 2): 0.6
 * 4. No match: 0.0
 */
function findBestHeaderMatch(
  expectedColumn: string,
  availableHeaders: string[],
  fieldRole: string,
): number {
  // Get keywords for this field role
  const keywords =
    HEADER_KEYWORDS[fieldRole as keyof typeof HEADER_KEYWORDS] || [];

  let bestScore = 0;

  for (const header of availableHeaders) {
    // Exact match
    if (header === expectedColumn) {
      return 1.0;
    }

    // Check against keywords
    for (const keyword of keywords) {
      // Exact keyword match
      if (header === keyword) {
        bestScore = Math.max(bestScore, 1.0);
      }
      // Contains keyword
      else if (header.includes(keyword) || keyword.includes(header)) {
        bestScore = Math.max(bestScore, 0.8);
      }
      // Fuzzy (edit distance)
      else if (levenshteinDistance(header, keyword) <= 2) {
        bestScore = Math.max(bestScore, 0.6);
      }
    }

    // Substring match (contains expected column)
    if (header.includes(expectedColumn) || expectedColumn.includes(header)) {
      bestScore = Math.max(bestScore, 0.7);
    }
  }

  return bestScore;
}

/**
 * Validate a sample row against the format.
 * Checks if required columns are present and have non-empty values.
 */
function validateRowAgainstFormat(
  row: Record<string, string>,
  format: BankCsvFormat,
): boolean {
  // Check date field
  const dateVal = getFieldFromRow(row, format.columns.date);
  if (!dateVal) return false;

  // Check amount field(s)
  if (format.columns.amount.kind === 'signed') {
    const amountVal = getFieldFromRow(row, format.columns.amount.column);
    if (!amountVal) return false;
  } else if (format.columns.amount.kind === 'split') {
    const debitVal = getFieldFromRow(row, format.columns.amount.debit);
    const creditVal = getFieldFromRow(row, format.columns.amount.credit);
    if (!debitVal && !creditVal) return false;  // At least one must have value
  }

  return true;
}

/**
 * Extract field value from row (case-insensitive for named keys, or numeric).
 */
function getFieldFromRow(
  row: Record<string, string>,
  fieldRef: string | number,
): string | null {
  if (typeof fieldRef === 'number') {
    return row[String(fieldRef)] ?? null;
  } else {
    const key = Object.keys(row).find(k => k.toLowerCase() === fieldRef.toLowerCase());
    return key ? row[key] : null;
  }
}

/**
 * Extract expected column names from format.
 * Returns object mapping field role → column name/index.
 */
function extractExpectedColumns(
  format: BankCsvFormat,
): Record<string, string | number> {
  return {
    date: format.columns.date,
    description: format.columns.description,
    balance: format.columns.balance ?? '',
    debit:
      format.columns.amount.kind === 'split'
        ? format.columns.amount.debit
        : '',
    credit:
      format.columns.amount.kind === 'split'
        ? format.columns.amount.credit
        : '',
  };
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching of column names.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i++) matrix[i]![0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,      // deletion
        matrix[i]![j - 1]! + 1,      // insertion
        matrix[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }

  return matrix[a.length]![b.length]!;
}
```

**Key Features:**
- Keyword matching with fallback to fuzzy (Levenshtein distance)
- Dual scoring: keyword (60%) + structure (40%)
- Validates sample rows against format
- Confidence threshold: 0.80
- Handles both signed and split amount structures

---

## Task 2.2: Update Upload Route to Use Auto-Detection

**File:** `src/app/api/transactions/csv/upload/route.ts` (MODIFY)

**Current:** Returns 400 if format not in registry

**New:** Chain registry → auto-detect → 400 error

```typescript
import { detectCsvFormat } from '@/server/services/transactions/csv-format-detector.service';

export async function POST(req: NextRequest) {
  // ... (existing validation code from Task 1.4) ...

  // **UPDATED: Resolve format (Tier 1: registry → Tier 2: auto-detect)**
  let detectedFormat: BankCsvFormat | undefined;
  let detectionMethod: 'registry' | 'auto-detect' | null = null;

  const bankKey = account.bank.name.toLowerCase().replace(/\s+/g, '');
  detectedFormat = getBankFormat(bankKey);

  if (detectedFormat) {
    detectionMethod = 'registry';
  } else {
    // Tier 2: Try auto-detection
    // Parse CSV headers and sample rows for detection
    const lines = csvContent.trim().split('\n');
    if (lines.length >= 2) {
      try {
        const headerLine = parseCSVLine(lines[0]!);
        const sampleLines = lines.slice(1, 4);  // First 3 data rows
        const sampleRows = sampleLines
          .map(line => {
            const values = parseCSVLine(line);
            const row: Record<string, string> = {};
            headerLine.forEach((header, idx) => {
              row[header.toLowerCase().trim()] = values[idx] ?? '';
            });
            return row;
          })
          .filter(row => Object.values(row).some(v => v.trim()));  // Filter empty rows

        const detectionResult = detectCsvFormat(
          headerLine.map(h => h.toLowerCase().trim()),
          sampleRows,
        );

        if (detectionResult.matched && detectionResult.format) {
          detectedFormat = detectionResult.format;
          detectionMethod = 'auto-detect';
        }
      } catch (detectError) {
        // Detection failed; fall through to error
      }
    }
  }

  // If no format found
  if (!detectedFormat) {
    const supportedBanks = getRegisteredBankKeys()
      .filter(k => ['commbank', 'nab'].includes(k))
      .join(', ');
    return NextResponse.json(
      {
        error: `Bank format not supported: ${account.bank.name}. Supported: ${supportedBanks}.`,
      },
      { status: 400 },
    );
  }

  // ... (rest of parsing and response, same as Task 1.4) ...
}

// Helper: parse CSV line (copied from csv-parser-generic.service or imported)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
```

---

## Task 2.3: Add Detection Algorithm Tests

**File:** `src/__tests__/unit/csv-format-detector.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest';
import { detectCsvFormat } from '@/server/services/transactions/csv-format-detector.service';

describe('csv-format-detector', () => {
  it('detects CommBank-like format from headers', () => {
    // Note: CommBank is headerless, so this tests ANZ/Westpac stub detection
    const headers = [
      'Transaction Date',
      'Description',
      'Debit',
      'Credit',
      'Balance',
    ];
    const sampleRows = [
      {
        'transaction date': '01/07/2024',
        description: 'SALARY',
        debit: '0.00',
        credit: '5000.00',
        balance: '15000.00',
      },
      {
        'transaction date': '02/07/2024',
        description: 'STORE',
        debit: '50.00',
        credit: '0.00',
        balance: '14950.00',
      },
    ];

    const result = detectCsvFormat(headers.map(h => h.toLowerCase()), sampleRows);

    // Should detect as split debit/credit (similar to Westpac)
    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
    expect(result.bankKey).toBeDefined();
  });

  it('rejects format with low confidence', () => {
    // Random headers that don't match any known format
    const headers = ['Col A', 'Col B', 'Col C'];
    const sampleRows = [
      { 'col a': '123', 'col b': '456', 'col c': '789' },
    ];

    const result = detectCsvFormat(headers.map(h => h.toLowerCase()), sampleRows);

    expect(result.matched).toBe(false);
    expect(result.confidence).toBeLessThan(0.80);
  });

  it('handles case-insensitive header matching', () => {
    const headers = [
      'TRANSACTION DATE',
      'DESCRIPTION',
      'DEBIT',
      'CREDIT',
      'BALANCE',
    ];
    const sampleRows = [
      {
        'transaction date': '01/07/2024',
        description: 'TEST',
        debit: '0.00',
        credit: '100.00',
        balance: '100.00',
      },
    ];

    const result = detectCsvFormat(headers.map(h => h.toLowerCase()), sampleRows);

    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.80);
  });

  it('detects format with fuzzy header matching', () => {
    // Headers with slight variations (typos, abbreviations)
    const headers = ['Trans. Date', 'Desc', 'Debits', 'Credits', 'Bal'];
    const sampleRows = [
      {
        'trans. date': '01/07/2024',
        desc: 'SALARY',
        debits: '0.00',
        credits: '5000.00',
        bal: '5000.00',
      },
    ];

    const result = detectCsvFormat(headers.map(h => h.toLowerCase()), sampleRows);

    // Should still detect with reasonable confidence due to fuzzy matching
    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('returns null format for empty headers', () => {
    const result = detectCsvFormat([], []);

    expect(result.matched).toBe(false);
    expect(result.format).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('validates sample rows against detected format', () => {
    // Rows with missing required fields should lower confidence
    const headers = ['date', 'description', 'debit', 'credit', 'balance'];
    const sampleRows = [
      {
        date: '01/07/2024',
        description: 'TEST',
        debit: '50.00',
        credit: '0.00',
        balance: '100.00',
      },
      {
        date: '',  // Missing date
        description: 'TEST2',
        debit: '0.00',
        credit: '50.00',
        balance: '150.00',
      },
    ];

    const result = detectCsvFormat(headers, sampleRows);

    // Should still match, but confidence affected
    expect(result.confidence).toBeGreaterThan(0);
    if (result.confidence >= 0.80) {
      expect(result.matched).toBe(true);
    }
  });

  it('picks highest confidence format when multiple candidates match', () => {
    // Headers that match both signed and split formats
    // (edge case; split should win for NAB-like structure)
    const headers = ['date', 'description', 'debit', 'credit', 'balance'];
    const sampleRows = [
      {
        date: '01/07/2024',
        description: 'TEST',
        debit: '50.00',
        credit: '0.00',
        balance: '100.00',
      },
    ];

    const result = detectCsvFormat(headers, sampleRows);

    expect(result.matched).toBe(true);
    expect(result.bankKey).toBeDefined();
  });
});
```

---

## Task 2.4: Update Type Definitions for Detection

**File:** `src/server/services/ai-import/_types.ts` (MODIFY)

**Current:** `CsvParseResult` doesn't include detection metadata

**New:** Add optional fields for detection

```typescript
/**
 * Result of CSV parsing operation
 */
export interface CsvParseResult {
  success: boolean;
  transactions?: CsvTransaction[];
  error?: string;
  message?: string;
  // NEW (Phase 2)
  detectionMethod?: 'registry' | 'auto-detect' | null;
  detectedFormat?: any;  // BankCsvFormat (avoids circular import)
}
```

---

## Phase 2 Completion Checklist

- [ ] Task 2.1: `csv-format-detector.service.ts` — detection algorithm
- [ ] Task 2.2: Update `/api/transactions/csv/upload/route.ts` — auto-detect chain
- [ ] Task 2.3: `csv-format-detector.test.ts` — 8+ test suites
- [ ] Task 2.4: Update `_types.ts` — detection metadata fields
- [ ] Run `pnpm run build` — no errors
- [ ] All Phase 1 tests still pass
- [ ] New Phase 2 tests all pass
- [ ] Existing CommBank imports still work (backward compat)
- [ ] NAB format imports work (new)
- [ ] Unknown bank returns clear error with supported list

---

---

# PHASE 3 & 4: DOCUMENTATION ONLY (Not in Scope)

## Phase 3: Column Mapping UI

**Objective (Future):** Allow users to manually map CSV columns to transaction fields when auto-detect fails.

### Proposed Component: `CSVColumnMappingStep.tsx`

```typescript
interface CSVColumnMappingStepProps {
  file: UploadedCSVFile;
  headers: string[];
  onMapComplete: (mapping: ColumnMapping) => void;
}

interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string | { debit: string; credit: string };
  balanceColumn?: string;
}
```

### UI:
- Display CSV preview (first 5 rows)
- Dropdown for each required field (Date, Description, Amount, Balance)
- Show sample values for each selected column
- Persist mapping in `BankAccount.csvFormatOverride` (DB field to add)
- On next import, use override if available

### Database Change (Phase 3+):
```prisma
model BankAccount {
  ...
  csvFormatOverride?: Json  // Optional: user-defined BankCsvFormat
}
```

---

## Phase 4: Enhanced Error UX

### Proposed Error Messages

**Registry miss + auto-detect miss:**
```
❌ Bank format not supported: Bendigo Bank

We couldn't automatically detect the format of your CSV.
Supported banks: Commonwealth Bank, National Australia Bank

Options:
1. Try mapping columns manually [Map Columns]
2. Export from your bank in a different format
3. Check our help docs [Learn More]
```

**Unsupported bank but manual mapping available:**
```
⚠️ Bendigo Bank is not yet supported, but you can map columns manually.

Choose column roles:
- Date column: [dropdown]
- Description column: [dropdown]
- Amount column: [dropdown]
- Save this mapping for future imports [checkbox]
```

---

## Phase 5+: Future Enhancements (Not Discussed)

- Database-driven format registry (versioning, hot-update)
- LLM-based column detection (expensive; Phase 4+)
- OFX/QIF import support (international standards)
- User-submitted format definitions (crowdsourced library)
- Format versioning & rollback

---

---

# Implementation Notes

## Code Style & Patterns

- **Imports:** Use absolute imports (`@/server/services/...`) per project conventions
- **Error Handling:** Return error in result object; never throw from public API functions
- **Testing:** Vitest framework; use `describe`, `it`, `expect`
- **Types:** Strict TypeScript; no `any` except for Prisma metadata fields
- **Naming:** camelCase for functions, PascalCase for types and interfaces

## Build & Test

```bash
# Lint and type-check
pnpm run lint
pnpm run type-check

# Run unit tests
pnpm run test

# Build
pnpm run build

# E2E tests (if applicable)
pnpm run e2e
```

## Related Files (No Changes Required)

- `src/server/services/ai-import/csv-parser.service.ts` — Will be deprecated; keep for backward compat
- `src/__tests__/unit/csv-parser.test.ts` — Existing CommBank tests; should all pass
- `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts` — Wizard types (no changes needed)

---

**Status:** Ready for implementation. Each task is self-contained and can be delegated independently. Phase 1 is prerequisite for Phase 2.