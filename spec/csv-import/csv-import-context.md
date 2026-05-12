# Context: CSV Import API Routes (Phase 2)

> Produced for: `src/app/api/csv-import/upload/route.ts` and `src/app/api/csv-import/parse/route.ts`  
> Reference codebase: `C:\My Github\my-financials-nextjs`  
> Generated: 2026-05-12

---

## 1. Route Architecture Pattern (from ai-import reference)

### 1.1 Upload Route Pattern (`/api/ai-import/upload/route.ts`)

```
POST /api/ai-import/upload

1. Auth check
   const session = await auth();
   if (!session?.user?.id) return 401

2. Parse formData
   const formData = await request.formData();
   const files = formData.getAll('files') as File[];
   Guard: files.length === 0 → 400
   Guard: files.length > MAX_IMAGES_PER_SESSION → 400

3. For each file (in a try/catch per file):
   a. validateMimeType(file.type)        — throws on invalid
   b. validateFileSize(buffer.length)    — throws on >10MB
   c. validateImageDimensions(buffer)    — throws on bad image
   d. storageAdapter.uploadImage(buffer, mimeType, userId, fileName)
   e. prisma.importImage.create({ userId, sessionId: '', fileName, fileSize, mimeType, storageUrl, storageProvider })
   f. setImageExpiration(importImage.id)
   Push to uploadedImages[] OR push error to errors[]

4. If uploadedImages.length === 0: return 400 { error, details: errors }

5. Build UploadResponse: { imageIds: string[], images: [{ imageId, fileName, fileSize, mimeType }] }

6. Fire-and-forget: deleteExpiredImages().catch(...)

7. Return:
   - 207 if partial success (some failed): { ...response, warnings: errors }
   - 200 if all succeeded: response
```

**Import paths used:**

```typescript
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import {
  getStorageAdapter,
  getStorageProviderEnum,
} from '@/server/services/ai-import/image-storage.adapter';
import {
  setImageExpiration,
  deleteExpiredImages,
} from '@/server/services/ai-import/cleanup.service';
import {
  validateMimeType,
  validateFileSize,
  validateImageDimensions,
  MAX_IMAGES_PER_SESSION,
} from '@/server/services/ai-import/validation';
import type { UploadResponse } from '@/server/services/ai-import/_types';
```

---

### 1.2 Parse Route Pattern (`/api/ai-import/parse/route.ts`)

```
POST /api/ai-import/parse

1. Auth check → 401 if no session

2. Parse + validate JSON body with UploadRequestSchema (Zod)
   → 400 with error.errors if invalid

3. Context validation based on importType
   EXPENSE: require context.calendarId + context.month
   BANK_ASSET: require context.snapshotDate

4. Create AIImportSession:
   prisma.aIImportSession.create({ userId, importType, status: 'PROCESSING', metadata: { context } })

5. Link images to session:
   prisma.importImage.updateMany({ where: { id: { in: imageIds } }, data: { sessionId } })

6. Build + return ReadableStream with Content-Type: text/event-stream

7. Inside stream.start(controller):
   For each imageId (indexed loop for imageIndex):
     a. Emit: { type: 'progress', message, imageIndex, totalImages }
     b. prisma.importImage.findUnique({ where: { id: imageId } }) → 404-style error event if missing
     c. storage.getImageBuffer(image.storageUrl)
     d. extractExpenseData(imageBuffer, []) → extractionResult
     e. after(async () => { log vision AIUsageLog })
     f. Emit: { type: 'extraction', imageId, message, entriesExtracted, confidence }
     g. mapResult = await mapExpenseData(extractionResult, calendarId, month, userId, imageId)
     h. if (mapResult.embeddingUsage.totalTokens > 0):
           after(async () => { log embedding AIUsageLog with model: EMBEDDING_MODEL_NAME })
     i. Emit: { type: 'saved', imageId, message, recordsCreated, status }

   After loop:
     Compute finalStatus (COMPLETED/PARTIAL/FAILED), overallConfidence
     prisma.aIImportSession.update({ status, overallConfidence, recordsCreated, metadata })
     Emit: { type: 'complete', sessionId, status, totalRecordsCreated, overallConfidence, successCount, totalImages }
     controller.close()

8. SSE response headers:
   'Content-Type': 'text/event-stream'
   'Cache-Control': 'no-cache'
   'Connection': 'keep-alive'
```

**Key SSE event shapes emitted:**

```typescript
{ type: 'progress',   message: string,  imageIndex: number,   totalImages: number }
{ type: 'extraction', imageId: string,  message: string,      entriesExtracted: number,  confidence: number }
{ type: 'saved',      imageId: string,  message: string,      recordsCreated: number,    status: 'success'|'partial'|'failed' }
{ type: 'complete',   sessionId: string, status: ImportStatusEnum, totalRecordsCreated: number, overallConfidence: number, successCount: number, totalImages: number }
{ type: 'error',      imageId?: string, message: string }
```

---

## 2. CSV-Specific Differences from AI Import

| Aspect                       | AI Image Import                                                           | CSV Import                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Upload file type             | `image/png`, `image/jpeg`, `image/webp`, `image/heic`                     | `text/csv` (or `application/octet-stream` if browser omits MIME)                                                                       |
| Storage adapter              | Required (local/S3) — stores binary image for vision API                  | **Not required** — CSV is parsed in memory; content stored in session metadata as JSON                                                 |
| `ImportImage` DB record      | Required (binary reference, expiresAt, storageUrl)                        | **Not required** — no `ImportImageId` linkage unless audit trail is desired; `ExpenseEntry.importImageId` remains null for CSV imports |
| Data extraction              | GPT-4o vision API → `extractExpenseData()` → `{ categoryName, amount }[]` | CSV parser → `{ merchantDescription, amount, date, month }[]` — no vision API call                                                     |
| `AIUsageLog` for extraction  | Two rows: vision (`gpt-4o`) + embedding (`text-embedding-3-small`)        | **One row only**: embedding only (`text-embedding-3-small`), no vision row                                                             |
| `context` shape              | `{ calendarId, month }`                                                   | `{ calendarId }` — month is derived **per-row** from CSV date column `DD/MM/YYYY`                                                      |
| Confidence                   | Returned by GPT-4o (`extractionResult.confidence`)                        | Always `1.0` — amounts are exact from bank statement                                                                                   |
| `usage` in extraction result | Populated by GPT-4o token counts                                          | `{ promptTokens: 0, completionTokens: 0, totalTokens: 0 }` — zero, no vision API                                                       |

**Critical architectural insight**: The CSV parse route constructs a synthetic `ExpenseExtractionResult` per month group and passes it directly to `mapExpenseData()`. The merchant description string (e.g., `"WOOLWORTHS 1294 HORNSBY NS AUS"`) takes the role of `entry.categoryName`. The embedding service handles both AI-extracted labels and raw merchant strings identically — `text-embedding-3-small` encodes semantic meaning rather than surface patterns.

---

## 3. CSV Parsing Requirements

### 3.1 CommBank CSV Format

File: `e2e/fixtures/commbank-sample.csv`

```
Date,Amount,Description,Balance
28/06/2025,"-57.58","WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 26/06/2025","+15928.82"
27/06/2025,"-8.40","TRANSPORTFORNSW TAP SYDNEY AUS Card xx5441 Value Date: 25/06/2025","+16124.21"
25/06/2025,"-1260.00","Direct Debit 077380 DEFT PAYMENTS DEFT 28408579","+16110.29"
```

**Column structure** (4 columns, comma-separated):

- `Date` — format `DD/MM/YYYY`, unquoted
- `Amount` — decimal, quoted, negative = debit/expense (e.g. `"-57.58"`), positive = credit
- `Description` — merchant string, quoted, may contain commas internally
- `Balance` — decimal, quoted, prefixed with `+` or `-` (e.g., `"+15928.82"`)

### 3.2 Parsing Rules

1. **Filter expenses only**: Keep rows where parsed `amount < 0`. Positive-amount rows (credits/income) should be skipped for expense import.
2. **Amount normalisation**: Strip surrounding double-quotes, then strip leading `+`/`-` sign. `parseFloat(raw.replace(/["+]/g, ''))` then `Math.abs()` to get a positive expense amount.
3. **Date → month extraction**: Parse `DD/MM/YYYY`. Month is the numeric middle segment (1–12). Example: `"28/06/2025"` → month `6`.
4. **Description cleaning**: The raw description contains trailing location/card noise: `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 26/06/2025"`. Pass the **full description** as-is to the embedding service — `text-embedding-3-small` handles the noise well. The LLD (section 6.2, note) explicitly states: "In practice, `'WOOLWORTHS'` embeds closest to `'Food'` regardless of trailing location/card text."
5. **Header row**: First row is always `Date,Amount,Description,Balance` — skip it.
6. **Empty rows**: Skip rows where `Description` is empty or `Amount` is `0`.
7. **Month grouping for `mapExpenseData()`**: Group parsed rows by month number before calling `mapExpenseData()`. Call `mapExpenseData()` once per distinct month in the CSV. This preserves the `month` field accuracy in `ExpenseEntry` records and is consistent with the existing service contract.

### 3.3 Synthetic `ExpenseExtractionResult` per month group

```typescript
const syntheticExtraction: ExpenseExtractionResult = {
  success: true,
  confidence: 1.0, // CSV amounts are exact
  entries: monthRows.map((row) => ({
    categoryName: row.description, // merchant description → embedding input
    amount: row.amount, // already positive absolute value
  })),
  warnings: [],
  usage: {
    // no vision API
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  },
};
```

---

## 4. Service Contracts

### 4.1 `mapExpenseData()`

**File**: `src/server/services/ai-import/expense-mapper.service.ts`

```typescript
export async function mapExpenseData(
  extractionResult: ExpenseExtractionResult,
  calendarId: string,
  month: number, // 1–12
  userId: string,
  importImageId?: string, // optional — pass undefined for CSV (no ImportImage record)
): Promise<ExpenseMapResult>;

export interface ExpenseMapResult {
  success: boolean;
  entriesCreated: number;
  confidence: number;
  warnings: string[];
  errors: string[];
  embeddingUsage: AITokenUsage; // accumulated across all entries
}
```

**What it does internally**: Fetches all active `ExpenseCategory` records, ensures the parent `Expense` record exists for `calendarId+userId`, then for each entry calls `matchCategoryWithEmbedding()` and creates an `ExpenseEntry`. The `importImageId` is passed directly to `ExpenseEntry.importImageId` (nullable FK). Pass `undefined` for CSV imports.

### 4.2 `matchCategoryWithEmbedding()`

**File**: `src/server/services/ai-import/category-matcher.service.ts`

```typescript
export async function matchCategoryWithEmbedding(
  extractedName: string, // merchant description or category label
  availableCategories: string[], // names of all active ExpenseCategory records
): Promise<{
  categoryName: string | null; // null if no match above threshold
  embeddingUsage: AITokenUsage;
}>;
```

**Tiered strategy** (in order):

1. Exact match (case-insensitive) — returns zero token usage
2. Substring match (bidirectional) — returns zero token usage
3. Embedding cosine similarity — calls `ensureCategoryEmbeddings()` then `findBestEmbeddingMatch()`, returns token usage
4. On embedding API failure — falls back to `matchCategory()` (Levenshtein), returns zero token usage

### 4.3 `ensureCategoryEmbeddings()`

**File**: `src/server/services/ai-import/embedding.service.ts`

```typescript
export async function ensureCategoryEmbeddings(
  categoryNames: string[],
): Promise<AITokenUsage>;
```

No-op (returns zero tokens) if the fingerprint matches the cached set. Otherwise calls `embedMany()` and populates the module-level cache. Concurrency-safe via a Promise lock.

### 4.4 `findBestEmbeddingMatch()`

**File**: `src/server/services/ai-import/embedding.service.ts`

```typescript
export async function findBestEmbeddingMatch(extractedName: string): Promise<{
  match: EmbeddingMatchResult;
  usage: AITokenUsage;
}>;

export interface EmbeddingMatchResult {
  matched: boolean;
  categoryName: string | null;
  similarity: number; // cosine similarity 0–1
  method: 'exact' | 'substring' | 'embedding' | 'fuzzy';
}
```

**Prerequisite**: `ensureCategoryEmbeddings()` must be called first. Throws `Error('Category embeddings not initialized...')` if cache is empty.

---

## 5. Database Models Needed

### 5.1 `AIImportSession` — create on parse start, update on completion

```prisma
model AIImportSession {
  id                String           @id @default(cuid())
  userId            String
  importType        ImportTypeEnum        // EXPENSE for CSV expense import
  status            ImportStatusEnum @default(PENDING)   // → PROCESSING → COMPLETED/PARTIAL/FAILED
  overallConfidence Float?                // 0.0–1.0; 1.0 for CSV (amounts are exact)
  recordsCreated    Int              @default(0)
  metadata          Json?                 // store parsed CSV rows here, or { context, rowResults }
  images            ImportImage[]         // empty [] for CSV imports
  usageLogs         AIUsageLog[]
  createdAt         DateTime
  updatedAt         DateTime
}
```

**Create call**:

```typescript
prisma.aIImportSession.create({
  data: {
    userId,
    importType: ImportTypeEnum.EXPENSE,
    status: 'PROCESSING',
    metadata: { context },
  },
});
```

**Update call after processing**:

```typescript
prisma.aIImportSession.update({
  where: { id: importSession.id },
  data: {
    status: finalStatus,
    overallConfidence,
    recordsCreated: totalRecordsCreated,
    metadata: { rowResults },
  },
});
```

---

### 5.2 `AIUsageLog` — one row per `mapExpenseData()` call (embedding usage only for CSV)

```prisma
model AIUsageLog {
  id               String          @id @default(cuid())
  sessionId        String          // → AIImportSession.id
  userId           String
  imageId          String?         // null for CSV imports (no ImportImage)
  importType       ImportTypeEnum  // EXPENSE
  model            String          // 'text-embedding-3-small' for CSV
  promptTokens     Int
  completionTokens Int             // always 0 for embeddings
  totalTokens      Int
  estimatedCostUSD Float
  createdAt        DateTime
}
```

---

### 5.3 `ExpenseEntry` — created by `mapExpenseData()`, one per CSV row

```prisma
model ExpenseEntry {
  id            String          @id @default(cuid())
  month         Int             // 1–12, derived from CSV Date column
  amount        Decimal @db.Money  // stored as string in Prisma: String(entry.amount)
  categoryId    String          // matched via embedding
  expenseId     String          // → Expense.id (created by mapExpenseData if missing)
  importImageId String?         // null for CSV imports
}
```

`mapExpenseData()` handles `Expense` parent record creation automatically via upsert logic.

---

### 5.4 `Expense` — parent record, managed by `mapExpenseData()`

```prisma
model Expense {
  id         String
  calendarId String
  userId     String
  @@unique([calendarId, userId])   // IMPORTANT: one Expense record per calendar+user
}
```

`mapExpenseData()` calls `prisma.expense.findUnique({ where: { calendarId_userId: { calendarId, userId } } })` and creates if missing.

---

### 5.5 `ExpenseCategory` — read-only, fetched by `mapExpenseData()`

```prisma
model ExpenseCategory {
  id       String  @id @default(cuid())
  name     String  @unique
  isActive Boolean @default(true)
}
```

`mapExpenseData()` fetches `prisma.expenseCategory.findMany({ where: { isActive: true } })` and builds the `categoryMap` and `availableCategories` array.

---

### 5.6 `ImportImage` — NOT needed for CSV imports

CSV imports do not create `ImportImage` records. The `ExpenseEntry.importImageId` FK will be `null` for CSV-imported entries. The audit trail (if required) should be tracked via `AIImportSession.metadata` and the `sessionId` association in `AIUsageLog`.

---

## 6. Request/Response Contracts (from e2e tests)

### 6.1 Upload Route — `POST /api/csv-import/upload`

**Request**:

```
Content-Type: multipart/form-data
Body: files field — single CSV file (File object)
  - Accept: text/csv or application/octet-stream
  - Field name: 'files' (matching ai-import pattern) OR 'file' (single-file variant)
```

**Implied by e2e**:

- File input `<input type="file" accept=".csv">` in the wizard modal
- `fileInput.setInputFiles('e2e/fixtures/commbank-sample.csv')`
- Parse/Process button becomes enabled after upload

**Response** (200 on success):

```typescript
{
  fileId: string; // temporary reference for the parse route (could be sessionId)
  fileName: string;
  rowCount: number; // number of expense rows parsed (for UI preview)
  transactions: Array<{
    date: string; // raw "DD/MM/YYYY"
    month: number; // 1–12 extracted from date
    description: string;
    amount: number; // positive absolute value
  }>;
}
```

Or, if following the ai-import pattern more closely:

```typescript
{
  imageIds: string[];   // single-element array with a session/file ID
  images: Array<{ imageId: string; fileName: string; fileSize: number; mimeType: string; }>;
}
```

---

### 6.2 Parse Route — `POST /api/csv-import/parse`

**Request body**:

```typescript
{
  fileId: string; // OR imageIds: string[] — reference from upload response
  importType: 'EXPENSE';
  context: {
    calendarId: string; // required — which calendar year to attach entries to
    // NOTE: month is derived per-row from CSV dates, not passed in context
  }
}
```

**Response**: `text/event-stream` (SSE), same headers as ai-import parse:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE event shapes** (implied by e2e progress indicators `processing|parsing|categorizing`):

```typescript
{ type: 'progress',   message: 'Parsing CSV rows...',                 rowsParsed: number,  totalRows: number }
{ type: 'extraction', message: 'Categorizing transactions...',         entriesExtracted: number }
{ type: 'saved',      message: 'Created N records',                   recordsCreated: number,  status: 'success'|'partial'|'failed' }
{ type: 'complete',   sessionId: string,  status: ImportStatusEnum,   totalRecordsCreated: number,  overallConfidence: number }
{ type: 'error',      message: string }
```

**E2E test assertions**:

- After parse: `page.getByText('WOOLWORTHS 1294 HORNSBY')` must be visible
- After parse: `page.getByText('TRANSPORTFORNSW TAP SYDNEY')` must be visible
- Categories displayed: WOOLWORTHS → `/food|groceries/i`
- Confidence score must be visible: `/confidence|accur|reliable|%/i`
- Category selectors (dropdowns) must be present for user editing
- Save button text: `/save|complete|import/i`
- After save: `/import complete|success|entries created/i` text visible
- Modal closes after save

---

## 7. Type Additions Needed

The following types do **not** exist in `_types.ts` and are needed for CSV import:

```typescript
// src/server/services/ai-import/_types.ts (additions)

/**
 * A single parsed row from a CommBank (or compatible) CSV file.
 */
export interface CsvTransaction {
  date: string; // raw "DD/MM/YYYY"
  month: number; // 1–12, extracted from date
  year: number; // e.g. 2025, extracted from date
  description: string; // raw merchant description string
  amount: number; // positive absolute value (already filtered to debits)
}

/**
 * Result of parsing a CSV file in the upload route.
 */
export interface CsvParseResult {
  fileName: string;
  rowCount: number;
  transactions: CsvTransaction[];
  warnings: string[]; // e.g. skipped rows, parse errors
}

/**
 * Request body for /api/csv-import/parse
 */
export interface CsvParseRequest {
  fileId: string; // session ID or temp file reference from upload
  importType: 'EXPENSE';
  context: {
    calendarId: string;
  };
}

/**
 * DTO for CSV upload API response
 */
export interface CsvUploadResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  transactions: CsvTransaction[];
}
```

**Note**: All existing types (`AITokenUsage`, `EmbeddingMatchResult`, `ExpenseExtractionResult`, `ExpenseMapResult`, `ImportTypeEnum`, `ImportStatusEnum`) are already defined and usable without changes.

---

## 8. Validation Requirements

### 8.1 CSV Upload Validation (new — does NOT reuse `validateMimeType()`)

`validateMimeType()` in `validation.ts` only allows image MIME types. New CSV-specific validation:

```typescript
const ALLOWED_CSV_MIME_TYPES = [
  'text/csv',
  'application/csv',
  'application/octet-stream', // browsers may omit MIME for .csv
  'text/plain', // some OSes use this for .csv
];

const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024; // 5MB — CSV files are text, 5MB is ample
const MAX_CSV_ROWS = 1000; // guard against pathologically large exports
const REQUIRED_CSV_HEADERS = ['Date', 'Amount', 'Description', 'Balance'];
```

**Validation steps**:

1. **MIME type**: Accept `text/csv`, `application/csv`, `application/octet-stream`, `text/plain`. Also verify by checking that the file extension is `.csv` from `file.name`.
2. **File size**: Max 5MB.
3. **Header check**: Parse first line, compare split values against `REQUIRED_CSV_HEADERS`. Return `400 { error: 'Invalid CSV format: missing required headers' }` if mismatch.
4. **Row count**: After filtering expense rows, if `0` return `400 { error: 'No expense transactions found in CSV' }`.
5. **Row count cap**: If rows exceed `MAX_CSV_ROWS`, return `400 { error: 'CSV file exceeds 1000 transaction limit' }`.

### 8.2 Parse Route Request Validation (Zod schema — new, parallel to `UploadRequestSchema`)

```typescript
// New schema for CSV parse route
export const CsvParseRequestSchema = z.object({
  fileId: z.string().min(1),
  importType: z.literal('EXPENSE'),
  context: z.object({
    calendarId: z.string().min(1),
  }),
});
```

The `UploadRequestSchema` from `validation.ts` is for image imports (validates `imageIds` as CUID array). Do **not** reuse it for the CSV parse route.

---

## 9. Token Usage & Cost Logging

### 9.1 Pattern (from `ai-import/parse/route.ts` — embedding branch)

```typescript
// After mapExpenseData() returns, inside the SSE stream:
if (mapResult.embeddingUsage.totalTokens > 0) {
  after(async () => {
    try {
      const embeddingCost = calculateEmbeddingCost(
        mapResult.embeddingUsage.totalTokens,
      );
      await prisma.aIUsageLog.create({
        data: {
          sessionId: importSession.id,
          userId,
          imageId: undefined, // null for CSV — no ImportImage
          importType: ImportTypeEnum.EXPENSE,
          model: EMBEDDING_MODEL_NAME, // 'text-embedding-3-small'
          promptTokens: mapResult.embeddingUsage.promptTokens,
          completionTokens: 0,
          totalTokens: mapResult.embeddingUsage.totalTokens,
          estimatedCostUSD: embeddingCost,
        },
      });
    } catch (logError) {
      console.error(
        '[csv-import/parse] Failed to log embedding usage:',
        logError,
      );
    }
  });
}
```

### 9.2 Key differences from image import logging

| Field                   | AI Image Import                                                              | CSV Import                    |
| ----------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| `model` (vision row)    | `AI_MODEL_NAME` (`'gpt-4o'`)                                                 | **No vision row**             |
| `model` (embedding row) | `EMBEDDING_MODEL_NAME`                                                       | `EMBEDDING_MODEL_NAME` (same) |
| `imageId`               | actual `ImportImage.id`                                                      | `undefined` / `null`          |
| `completionTokens`      | `extractionResult.usage.completionTokens` (for vision) / `0` (for embedding) | always `0`                    |
| `promptTokens`          | vision tokens + embedding tokens (separate rows)                             | embedding tokens only         |

### 9.3 `after()` import

```typescript
import { after } from 'next/server';
```

`after()` is used for non-blocking usage logging. It runs the callback after the current SSE chunk is flushed, ensuring the DB write does not block the SSE response. This is the exact same pattern used in the ai-import parse route.

### 9.4 Pricing constants

```typescript
import {
  EMBEDDING_MODEL_NAME, // 'text-embedding-3-small'
  calculateEmbeddingCost, // (tokens: number) => number in USD
} from '@/constants/ai-pricing';
```

**No vision cost** to calculate for CSV imports. Do not import `calculateEstimatedCost` or `AI_MODEL_NAME` in the CSV route.

---

## 10. Import Path Conventions

All exact import paths used in existing `ai-import` routes — replicate these exactly:

```typescript
// Auth
import { auth } from '@/server/auth';
// → exports: const { auth, handlers, signIn, signOut } = NextAuth(authConfig)

// Prisma client
import { prisma } from '@/server/db/client';
// → exports: export const prisma = global.prisma || new PrismaClient(...)

// Prisma enums (from generated client)
import { ImportStatusEnum, ImportTypeEnum } from '@prisma/client';

// AI pricing
import {
  EMBEDDING_MODEL_NAME,
  calculateEmbeddingCost,
} from '@/constants/ai-pricing';

// Shared types
import type {
  CsvUploadResponse,
  CsvTransaction,
  AITokenUsage,
} from '@/server/services/ai-import/_types';

// Expense mapper (reused as-is)
import {
  mapExpenseData,
  type ExpenseMapResult,
} from '@/server/services/ai-import/expense-mapper.service';

// after() for non-blocking DB writes
import { after } from 'next/server';

// Next.js route handler types
import { NextRequest, NextResponse } from 'next/server';
```

**The CSV routes do NOT need:**

- `getStorageAdapter` / `getStorageProviderEnum` (no binary storage)
- `setImageExpiration` / `deleteExpiredImages` (no expiry for CSV)
- `validateMimeType` / `validateImageDimensions` (image-specific — write new CSV validators)
- `extractExpenseData` / `ai-vision.service` (no GPT-4o vision call)
- `AI_MODEL_NAME` / `calculateEstimatedCost` (no vision tokens)

---

## 11. Suggested Implementation Sequence

1. **Add types** to `src/server/services/ai-import/_types.ts`: `CsvTransaction`, `CsvParseResult`, `CsvUploadResponse`, `CsvParseRequest`
2. **Add `CsvParseRequestSchema`** to `src/server/services/ai-import/validation.ts`
3. **Implement `src/app/api/csv-import/upload/route.ts`**: auth → parse formData → validate CSV → parse rows → store in `AIImportSession.metadata` → return `CsvUploadResponse`
4. **Implement `src/app/api/csv-import/parse/route.ts`**: auth → validate body → retrieve CSV rows from session → group by month → construct `ExpenseExtractionResult` per group → call `mapExpenseData()` → log embedding usage → SSE stream
5. **Run `pnpm run build`** and fix any type errors before declaring complete
