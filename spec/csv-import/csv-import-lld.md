# CSV/OFX Import Phase 2 — Low Level Design (LLD)

**Location:** `spec/csv-import/csv-import-lld.md`  
**Date:** May 12, 2026  
**Parent:** [csv-import-hld.md](csv-import-hld.md)  
**Scope:** Backend API for CSV import — upload route, parse route, type additions, validation schema, parsing algorithm, error handling, and security.

---

## Table of Contents

1. [Type Additions (`_types.ts`)](#1-type-additions)
2. [Upload Route](#2-upload-route)
3. [Parse Route](#3-parse-route)
4. [Zod Schema Addition (`validation.ts`)](#4-zod-schema-addition)
5. [CSV Parsing Algorithm](#5-csv-parsing-algorithm)
6. [Error Handling Matrix](#6-error-handling-matrix)
7. [Security Checklist](#7-security-checklist)
8. [Testing Notes](#8-testing-notes)

---

## 1. Type Additions

**File:** `src/server/services/ai-import/_types.ts`

Append the following interfaces to the end of the file:

```typescript
/**
 * A single parsed expense row from a CommBank (or compatible) CSV file.
 * Only debit rows (amount < 0 in source) are included — credits are filtered out.
 */
export interface CsvTransaction {
  date: string; // Raw "DD/MM/YYYY" as it appears in the CSV
  month: number; // 1–12, parsed from date (middle segment of DD/MM/YYYY)
  year: number; // e.g. 2025, parsed from date (last segment of DD/MM/YYYY)
  description: string; // Raw merchant description string from CSV Description column
  amount: number; // Positive absolute value (Math.abs of the negative debit)
}

/**
 * Result of parsing a CSV file — internal type used by upload route.
 */
export interface CsvParseResult {
  fileName: string;
  rowCount: number; // Count after filtering to debits only
  transactions: CsvTransaction[];
  warnings: string[]; // e.g. "Truncated to 1000 rows", skipped row notices
}

/**
 * API response for POST /api/csv-import/upload
 */
export interface CsvUploadResponse {
  fileId: string; // AIImportSession.id — used as reference for parse route
  fileName: string;
  fileSize: number; // Bytes
  rowCount: number;
  transactions: CsvTransaction[];
}

/**
 * Request body for POST /api/csv-import/parse
 */
export interface CsvParseRequest {
  fileId: string; // AIImportSession.id from upload response
  importType: 'EXPENSE'; // Only EXPENSE supported in Phase 2
  context: {
    calendarId: string; // Target calendar year record ID
  };
}
```

---

## 2. Upload Route

**File:** `src/app/api/csv-import/upload/route.ts`

### 2.1 Imports

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { ImportTypeEnum } from '@prisma/client';
import type {
  CsvUploadResponse,
  CsvTransaction,
} from '@/server/services/ai-import/_types';
```

### 2.2 Validation Constants

Define at module level (not exported — CSV-route-specific):

```typescript
const ALLOWED_CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/octet-stream', // some browsers omit MIME for .csv
  'text/plain', // some OSes use this for .csv
];
const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_CSV_ROWS = 1000;
const REQUIRED_CSV_HEADERS = ['Date', 'Amount', 'Description', 'Balance'];
```

### 2.3 Handler Pseudocode

```
POST /api/csv-import/upload

1. Auth check
   const session = await auth();
   if (!session?.user?.id) return 401

2. Parse multipart/form-data
   const formData = await request.formData();
   const files = formData.getAll('files') as File[];
   if (!files || files.length === 0) return 400 { error: 'No files provided' }
   const file = files[0]!;

3. MIME type validation
   const mimeType = file.type;
   const hasValidMime = ALLOWED_CSV_MIME_TYPES.includes(mimeType);
   const hasValidExtension = file.name.toLowerCase().endsWith('.csv');
   if (!hasValidMime && !hasValidExtension) return 400 { error: 'Invalid file type. Only CSV files are supported.' }

4. File size validation
   if (file.size > MAX_CSV_FILE_SIZE) return 400 { error: 'File size exceeds 5MB limit' }

5. Read file as text
   const text = await file.text();

6. Parse CSV
   const { transactions, warnings } = parseCsvText(text);

7. Header validation (parseCsvText raises or returns empty if headers missing)
   if headers not found in text → return 400 { error: 'Invalid CSV format: missing required headers (Date, Amount, Description, Balance)' }

8. Row count check
   if (transactions.length === 0) return 400 { error: 'No expense transactions found in CSV' }

9. Create AIImportSession
   const importSession = await prisma.aIImportSession.create({
     data: {
       userId,
       importType: ImportTypeEnum.EXPENSE,
       status: 'PENDING',
       metadata: { fileName: file.name, fileSize: file.size, transactions },
     },
   });

10. Return 200 CsvUploadResponse
    return NextResponse.json({
      fileId: importSession.id,
      fileName: file.name,
      fileSize: file.size,
      rowCount: transactions.length,
      transactions,
    } satisfies CsvUploadResponse);
```

### 2.4 Internal Helper: `parseCsvText()`

**Signature:**

```typescript
function parseCsvText(text: string): {
  transactions: CsvTransaction[];
  warnings: string[];
  headersValid: boolean;
};
```

**Full algorithm — see Section 5 for detail.**

---

## 3. Parse Route

**File:** `src/app/api/csv-import/parse/route.ts`

### 3.1 Imports

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { ImportStatusEnum, ImportTypeEnum } from '@prisma/client';
import { z } from 'zod';
import {
  mapExpenseData,
  type ExpenseMapResult,
} from '@/server/services/ai-import/expense-mapper.service';
import {
  EMBEDDING_MODEL_NAME,
  calculateEmbeddingCost,
} from '@/constants/ai-pricing';
import type {
  CsvTransaction,
  ExpenseExtractionResult,
} from '@/server/services/ai-import/_types';
```

### 3.2 Request Schema (inline)

```typescript
const CsvParseRequestSchema = z.object({
  fileId: z.string().min(1),
  importType: z.literal('EXPENSE'),
  context: z.object({
    calendarId: z.string().min(1),
  }),
});
```

> **Note:** This schema may alternatively be exported from `src/server/services/ai-import/validation.ts`. Define inline in the route file for Phase 2; move to validation.ts if reused elsewhere.

### 3.3 Handler Pseudocode

```
POST /api/csv-import/parse

1. Auth check
   const session = await auth();
   if (!session?.user?.id) return 401

2. Validate JSON body
   const body = await request.json();
   const parsed = CsvParseRequestSchema.safeParse(body);
   if (!parsed.success) return 400 { error: 'Invalid request', details: parsed.error.errors }

   const { fileId, context: { calendarId } } = parsed.data;

3. Load AIImportSession + ownership check
   const importSession = await prisma.aIImportSession.findUnique({ where: { id: fileId } });
   if (!importSession) return 404 { error: 'Import session not found' }
   if (importSession.userId !== userId) return 403 { error: 'Forbidden' }

4. Extract transactions from session metadata
   const metadata = importSession.metadata as { transactions: CsvTransaction[] };
   const transactions = metadata.transactions ?? [];
   if (transactions.length === 0) return 400 { error: 'No transactions found in session' }

5. Group transactions by month
   const monthGroups = new Map<number, CsvTransaction[]>();
   for (const tx of transactions) {
     if (!monthGroups.has(tx.month)) monthGroups.set(tx.month, []);
     monthGroups.get(tx.month)!.push(tx);
   }
   const sortedMonths = Array.from(monthGroups.keys()).sort((a, b) => a - b);
   const totalMonths = sortedMonths.length;

6. Build SSE stream
   const encoder = new TextEncoder();
   const stream = new ReadableStream({
     async start(controller) {

       let totalRecordsCreated = 0;
       let monthsProcessed = 0;
       let hasFailure = false;
       let hasPartial = false;

       for (const month of sortedMonths) {
         const monthTransactions = monthGroups.get(month)!;
         const monthName = new Date(2000, month - 1).toLocaleString('default', { month: 'long' });

         // 6a. Emit progress event
         controller.enqueue(encoder.encode(
           `data: ${JSON.stringify({
             type: 'progress',
             message: `Processing ${monthName} transactions...`,
             monthsProcessed,
             totalMonths,
           })}\n\n`
         ));

         try {
           // 6b. Build synthetic ExpenseExtractionResult
           const syntheticExtraction: ExpenseExtractionResult = {
             success: true,
             confidence: 1.0,
             entries: monthTransactions.map(t => ({
               categoryName: t.description,
               amount: t.amount,
             })),
             warnings: [],
             usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
           };

           // 6c. Call mapExpenseData — handles category matching + DB writes
           const mapResult = await mapExpenseData(
             syntheticExtraction,
             calendarId,
             month,
             userId,
             undefined,  // no importImageId for CSV imports
           );

           totalRecordsCreated += mapResult.entriesCreated;
           monthsProcessed++;

           const monthStatus = mapResult.success ? 'success' : mapResult.entriesCreated > 0 ? 'partial' : 'failed';
           if (!mapResult.success) {
             if (mapResult.entriesCreated > 0) hasPartial = true;
             else hasFailure = true;
           }

           // 6d. Emit saved event
           controller.enqueue(encoder.encode(
             `data: ${JSON.stringify({
               type: 'saved',
               message: `Created ${mapResult.entriesCreated} entries for ${monthName}`,
               recordsCreated: mapResult.entriesCreated,
               month,
               status: monthStatus,
             })}\n\n`
           ));

           // 6e. Log embedding usage non-blocking
           if (mapResult.embeddingUsage.totalTokens > 0) {
             after(async () => {
               try {
                 await prisma.aIUsageLog.create({
                   data: {
                     sessionId: importSession.id,
                     userId,
                     imageId: undefined,
                     importType: ImportTypeEnum.EXPENSE,
                     model: EMBEDDING_MODEL_NAME,
                     promptTokens: mapResult.embeddingUsage.promptTokens,
                     completionTokens: 0,
                     totalTokens: mapResult.embeddingUsage.totalTokens,
                     estimatedCostUSD: calculateEmbeddingCost(mapResult.embeddingUsage.totalTokens),
                   },
                 });
               } catch (logError) {
                 console.error('[csv-import/parse] Failed to log embedding usage:', logError);
               }
             });
           }

         } catch (monthError) {
           hasFailure = true;
           monthsProcessed++;
           const errMsg = monthError instanceof Error ? monthError.message : String(monthError);
           controller.enqueue(encoder.encode(
             `data: ${JSON.stringify({ type: 'error', message: errMsg, month })}\n\n`
           ));
         }
       }

       // 7. Determine final status
       const finalStatus: ImportStatusEnum = hasFailure && totalRecordsCreated === 0
         ? ImportStatusEnum.FAILED
         : (hasFailure || hasPartial)
           ? ImportStatusEnum.PARTIAL
           : ImportStatusEnum.COMPLETED;

       // 8. Update session
       await prisma.aIImportSession.update({
         where: { id: importSession.id },
         data: {
           status: finalStatus,
           overallConfidence: 1.0,
           recordsCreated: totalRecordsCreated,
         },
       });

       // 9. Emit complete event
       controller.enqueue(encoder.encode(
         `data: ${JSON.stringify({
           type: 'complete',
           sessionId: importSession.id,
           status: finalStatus,
           totalRecordsCreated,
           overallConfidence: 1.0,
           monthsProcessed,
         })}\n\n`
       ));

       controller.close();
     }
   });

7. Return SSE response
   return new Response(stream, {
     headers: {
       'Content-Type': 'text/event-stream',
       'Cache-Control': 'no-cache',
       'Connection': 'keep-alive',
     },
   });
```

---

## 4. Zod Schema Addition

**File:** `src/server/services/ai-import/validation.ts`

Add the following export at the end of the file:

```typescript
/**
 * Request body schema for POST /api/csv-import/parse
 */
export const CsvParseRequestSchema = z.object({
  fileId: z.string().min(1),
  importType: z.literal('EXPENSE'),
  context: z.object({
    calendarId: z.string().min(1),
  }),
});
```

> The existing `UploadRequestSchema` is for image imports and must NOT be reused for the CSV parse route.

---

## 5. CSV Parsing Algorithm

### Function Signature

```typescript
function parseCsvText(text: string): {
  transactions: CsvTransaction[];
  warnings: string[];
  headersValid: boolean;
};
```

### Step-by-Step Algorithm

```
1. Split by newlines:
   const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
   if (lines.length < 2) return { transactions: [], warnings: ['Empty CSV'], headersValid: false }

2. Parse header row (lines[0]):
   const headers = splitCsvRow(lines[0]);
   Check that all REQUIRED_CSV_HEADERS are present (exact match).
   If any missing → return { transactions: [], warnings: [], headersValid: false }

3. Locate column indices:
   const dateIdx = headers.indexOf('Date');         // 0
   const amountIdx = headers.indexOf('Amount');     // 1
   const descIdx = headers.indexOf('Description'); // 2

4. Iterate remaining lines (lines[1..]):
   const transactions: CsvTransaction[] = [];
   const warnings: string[] = [];

   for (const line of lines.slice(1)) {
     const cols = splitCsvRow(line);

     // Skip malformed rows
     if (cols.length < 3) { warnings.push(`Skipped malformed row`); continue; }

     const rawDate = cols[dateIdx]!.trim();
     const rawAmount = cols[amountIdx]!.trim();
     const rawDesc = cols[descIdx]!.trim();

     // Skip empty descriptions
     if (!rawDesc) continue;

     // Parse amount
     const cleanAmount = rawAmount.replace(/["+ ]/g, '');  // strip quotes and +
     const amount = parseFloat(cleanAmount);
     if (isNaN(amount)) { warnings.push(`Skipped row with invalid amount: ${rawAmount}`); continue; }
     if (amount >= 0) continue;  // skip credits/income

     // Parse date: expect DD/MM/YYYY
     const dateParts = rawDate.split('/');
     if (dateParts.length !== 3) { warnings.push(`Skipped row with invalid date: ${rawDate}`); continue; }
     const month = parseInt(dateParts[1]!, 10);
     const year = parseInt(dateParts[2]!, 10);
     if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
       warnings.push(`Skipped row with invalid date: ${rawDate}`); continue;
     }

     transactions.push({
       date: rawDate,
       month,
       year,
       description: rawDesc,
       amount: Math.abs(amount),
     });

     // Truncate at MAX_CSV_ROWS
     if (transactions.length >= MAX_CSV_ROWS) {
       warnings.push(`CSV truncated to ${MAX_CSV_ROWS} rows`);
       break;
     }
   }

5. return { transactions, warnings, headersValid: true }
```

### `splitCsvRow()` — Quoted Field Handling

```typescript
function splitCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}
```

### Edge Cases

| Case                                  | Handling                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Empty row                             | Filtered out by `.filter(l => l.length > 0)` before iteration             |
| Row with missing columns              | `cols.length < 3` check → skip with warning                               |
| Amount with `+` prefix (credit)       | Stripped of `+`, parsed as positive float → `amount >= 0` → skipped       |
| Amount `"-57.58"` (quoted)            | Quotes removed → `-57.58` → `amount < 0` → included, `Math.abs()` applied |
| Malformed date                        | Parts check + `isNaN` → skip with warning                                 |
| Commas inside quoted description      | `splitCsvRow()` state machine handles correctly                           |
| Trailing `Value Date:` in description | Passed as-is to embedding — `text-embedding-3-small` handles the noise    |
| Truncation at MAX_CSV_ROWS            | `break` after limit, warning added to result                              |

---

## 6. Error Handling Matrix

| Error Condition                       | Route  | HTTP Status | Response / SSE Event                                                                             |
| ------------------------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------------ |
| Unauthenticated                       | Both   | 401         | `{ error: "Unauthorized" }`                                                                      |
| No file in formData                   | Upload | 400         | `{ error: "No files provided" }`                                                                 |
| Invalid MIME type + no .csv extension | Upload | 400         | `{ error: "Invalid file type. Only CSV files are supported." }`                                  |
| File exceeds 5MB                      | Upload | 400         | `{ error: "File size exceeds 5MB limit" }`                                                       |
| Missing required CSV headers          | Upload | 400         | `{ error: "Invalid CSV format: missing required headers (Date, Amount, Description, Balance)" }` |
| No expense rows after filtering       | Upload | 400         | `{ error: "No expense transactions found in CSV" }`                                              |
| Invalid Zod body                      | Parse  | 400         | `{ error: "Invalid request", details: [...] }`                                                   |
| Session not found                     | Parse  | 404         | `{ error: "Import session not found" }`                                                          |
| Ownership mismatch                    | Parse  | 403         | `{ error: "Forbidden" }`                                                                         |
| No transactions in session            | Parse  | 400         | `{ error: "No transactions found in session" }`                                                  |
| Per-month mapExpenseData() error      | Parse  | 200 (SSE)   | `{ type: 'error', message, month }` — stream continues                                           |
| All months fail                       | Parse  | 200 (SSE)   | `{ type: 'complete', status: 'FAILED', ... }`                                                    |
| Unhandled exception in stream         | Parse  | 200 (SSE)   | `{ type: 'error', message }` — stream closed                                                     |

> **Key principle**: Errors before the SSE stream opens return JSON responses with HTTP status codes. Errors inside the stream emit SSE `error` events and the stream continues (per-month errors) or closes (fatal errors).

---

## 7. Security Checklist

| Item                           | Implementation                                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Authentication — upload route  | `const session = await auth(); if (!session?.user?.id) return 401`                              |
| Authentication — parse route   | Same pattern                                                                                    |
| Ownership check — parse route  | `if (importSession.userId !== userId) return 403`                                               |
| MIME validation                | Check against `ALLOWED_CSV_MIME_TYPES` OR `.csv` extension — do not accept arbitrary file types |
| File size limit                | `file.size > MAX_CSV_FILE_SIZE` → 400                                                           |
| Row count limit                | Cap at `MAX_CSV_ROWS` with warning (not error) — prevents DoS via large files                   |
| JSON body validation           | Zod `CsvParseRequestSchema.safeParse()`                                                         |
| No sensitive data in responses | Catch internal errors, log server-side, return generic message to client                        |
| `after()` error isolation      | Embedding log failures are caught and logged; they do not affect the SSE stream                 |
| No secrets in client           | `AI_API_KEY`, `AI_PROVIDER` are server-side only env vars                                       |

---

## 8. Testing Notes

### Unit Tests for `parseCsvText()`

| Test Case                          | Input                         | Expected Output                           |
| ---------------------------------- | ----------------------------- | ----------------------------------------- |
| Valid CommBank CSV                 | `commbank-sample.csv` content | All 10 rows parsed, credits skipped       |
| Quoted fields with internal commas | `"DEFT PAYMENTS, Ref 123"`    | Single description field, comma preserved |
| Credit row (`+15928.82` amount)    | Amount `"+15928.82"`          | Row skipped                               |
| Debit row (`"-57.58"` amount)      | Amount `"-57.58"`             | Row included, amount `= 57.58`            |
| Malformed date                     | `"32/13/2025"`                | Row skipped, warning added                |
| Missing Description column         | Row with 2 columns            | Row skipped, warning added                |
| Empty rows                         | `\n\n` between data rows      | Empty rows filtered out                   |
| Truncation                         | 1001 rows in CSV              | 1000 rows returned, 1 warning             |
| Missing headers                    | No header row                 | `headersValid: false`, no transactions    |
| Month extraction                   | `"28/06/2025"`                | `month: 6, year: 2025`                    |

### E2E Tests (`e2e/cashflow/csv-import.spec.ts`)

The suite verifies:

- CSV Import button visible on `/cashflow/expense` page
- Modal opens with file upload zone
- `commbank-sample.csv` fixture can be uploaded
- Parse/Process button enabled after upload
- Processing state visible during parse
- Parsed transactions displayed (`WOOLWORTHS 1294 HORNSBY`, `TRANSPORTFORNSW TAP SYDNEY`)
- Semantic categories assigned (WOOLWORTHS → Food/Groceries)
- Confidence score visible
- Category dropdowns present for user review
- Save button creates expense entries
- Success message shown after save
- Modal closes after completion
