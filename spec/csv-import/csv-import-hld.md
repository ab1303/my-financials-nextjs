# CSV Import Phase 2 — High Level Design (HLD)

**Location:** `spec/csv-import/csv-import-hld.md`  
**Date:** May 12, 2026  
**Project:** My Financials Next.js (T3 Stack)  
**Phase:** 2 — CSV/OFX Import with Semantic Category Matching

---

## 1. Problem Statement

Manual entry of expense data is error-prone and time-consuming for users managing their finances. While AI-powered image import exists, many users receive or download transaction data as CSV files (e.g., from CommBank). There is currently no way to semantically categorize these CSV transactions at import time.  
**CSV Import Phase 2** enables users to upload CommBank CSV exports, parse them in-memory, and automatically map each transaction to the correct expense category using the same AI embedding pipeline as image import. This streamlines expense tracking, reduces manual work, and ensures consistent categorization.

---

## 2. Goals

1. **User:** Allow authenticated users to upload CommBank CSV files and import up to 1000 expense transactions per file.
2. **System:** Parse CSV files in-memory, validate structure, and extract debit transactions only.
3. **System:** For each transaction, use the merchant description as input to the shared embedding-based category matching pipeline.
4. **System:** Group transactions by month and process each group as a batch, emitting progress via SSE.
5. **System:** Track import session state and embedding token usage in the database.
6. **DevOps:** Ensure no sensitive data is stored or exposed; all processing is in-memory and session-scoped.
7. **System:** Provide robust error handling and clear feedback for invalid files, parse errors, or embedding failures.

---

## 3. Non-Goals

- **No support for non-CommBank CSV formats** (other banks, OFX, QIF, etc.)
- **No binary file storage** (no S3, Vercel Blob, or local disk for CSVs)
- **No manual category override UI** (all categorization is automatic)
- **No changes to database schema** (uses existing models only)
- **No support for credit transactions** (only debits/expenses are imported)
- **No direct editing of parsed transactions before import** (handled in later phases)

---

## 4. Architecture Overview

```
+-------------------+         +-------------------+
|                   |         |                   |
|  AI Image Import  |         |   CSV Import      |
|  (existing)       |         |   (Phase 2)       |
|                   |         |                   |
+--------+----------+         +---------+---------+
         |                              |
         v                              v
/api/ai-import/upload         /api/csv-import/upload
         |                              |
         v                              v
/api/ai-import/parse          /api/csv-import/parse
         |                              |
         v                              v
extractExpenseData()         parseCsvRows()
         |                              |
         +----------+  +----------------+
                    |  |
                    v  v
             mapExpenseData()
                    |
                    v
     matchCategoryWithEmbedding()  (shared)
                    |
                    v
     +------------------------------+
     |   Shared Embedding Layer     |
     |                              |
     |  ensureCategoryEmbeddings()  |
     |  findBestEmbeddingMatch()    |
     |  text-embedding-3-small      |
     |  (AI SDK / GitHub / OpenAI)  |
     +------------------------------+
                    |
                    v
     +------------------------------+
     |         Database             |
     |  AIImportSession             |
     |  AIUsageLog                  |
     |  Expense / ExpenseEntry      |
     |  ExpenseCategory (read-only) |
     +------------------------------+
```

---

## 5. Component Inventory

| File/Module                                                 | Status       | Purpose                                                                         |
| ----------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| `src/app/api/csv-import/upload/route.ts`                    | **New**      | CSV file upload, validation, in-memory parsing, session creation                |
| `src/app/api/csv-import/parse/route.ts`                     | **New**      | SSE streaming, month grouping, mapExpenseData(), usage logging                  |
| `src/server/services/ai-import/_types.ts`                   | **Modified** | Adds `CsvTransaction`, `CsvParseResult`, `CsvUploadResponse`, `CsvParseRequest` |
| `src/server/services/ai-import/validation.ts`               | **Modified** | Adds `CsvParseRequestSchema` (Zod)                                              |
| `src/server/services/ai-import/expense-mapper.service.ts`   | Unchanged    | Reused as-is — handles embedding matching + DB writes                           |
| `src/server/services/ai-import/category-matcher.service.ts` | Unchanged    | Shared embedding matching logic                                                 |
| `src/server/services/ai-import/embedding.service.ts`        | Unchanged    | Shared embedding cache + cosine similarity                                      |
| `src/constants/ai-pricing.ts`                               | Unchanged    | `EMBEDDING_MODEL_NAME`, `calculateEmbeddingCost()`                              |
| `src/server/auth/index.ts`                                  | Unchanged    | Auth check pattern                                                              |
| `src/server/db/client.ts`                                   | Unchanged    | Prisma client                                                                   |
| `prisma/schema.prisma`                                      | Unchanged    | No schema changes                                                               |

---

## 6. Data Flow

### A. Upload Flow (`POST /api/csv-import/upload`)

```
1. Auth check → auth() → 401 if no session

2. Parse multipart/form-data
   → field name: 'files'
   → accept: single CSV file

3. CSV Validation:
   → MIME type: text/csv | application/csv | application/octet-stream | text/plain | .csv extension
   → File size: ≤ 5MB
   → Header row: must contain Date, Amount, Description, Balance
   → Row count: 1–1000 expense rows after filtering

4. In-memory parse → CsvTransaction[]
   → Filter: keep rows where Amount < 0 (debits only)
   → Normalise: amount = Math.abs(parseFloat(raw))
   → Extract: month = parseInt(dateParts[1]), year = parseInt(dateParts[2])

5. Create AIImportSession
   → status: 'PENDING'
   → metadata: { fileName, fileSize, transactions[] }

6. Return CsvUploadResponse
   → { fileId (= sessionId), fileName, fileSize, rowCount, transactions[] }
```

### B. Parse Flow (`POST /api/csv-import/parse`)

```
1. Auth check → 401 if no session

2. Validate JSON body → CsvParseRequestSchema
   → { fileId, importType: 'EXPENSE', context: { calendarId } }

3. Load AIImportSession by fileId
   → 404 if not found
   → 403 if session.userId !== current user

4. Extract transactions from session.metadata

5. Group transactions by month (Map<number, CsvTransaction[]>)
   → Sort months ascending

6. Open SSE stream
   → Content-Type: text/event-stream

7. For each month group:
   a. Emit progress event
   b. Build synthetic ExpenseExtractionResult
      { confidence: 1.0, entries: [{ categoryName: description, amount }] }
   c. await mapExpenseData(result, calendarId, month, userId, undefined)
   d. Emit saved event
   e. after(() => log AIUsageLog for embedding tokens)

8. Update AIImportSession (COMPLETED / PARTIAL / FAILED)

9. Emit complete event, close stream
```

---

## 7. API Contract

### A. Upload Route

**Endpoint:** `POST /api/csv-import/upload`  
**Request:** `multipart/form-data`, field `files`

**Response 200:**

```typescript
{
  fileId: string; // AIImportSession.id
  fileName: string;
  fileSize: number;
  rowCount: number;
  transactions: Array<{
    date: string; // 'DD/MM/YYYY'
    month: number; // 1–12
    year: number; // e.g. 2025
    description: string;
    amount: number; // positive absolute value
  }>;
}
```

**Error responses:** 401, 400

### B. Parse Route

**Endpoint:** `POST /api/csv-import/parse`  
**Request:** `application/json`

```typescript
{
  fileId: string;
  importType: 'EXPENSE';
  context: {
    calendarId: string;
  }
}
```

**Response:** `text/event-stream` (SSE)

**SSE Event Shapes:**

```typescript
{ type: 'progress',  message: string, monthsProcessed: number, totalMonths: number }
{ type: 'saved',     message: string, recordsCreated: number, month: number, status: 'success'|'partial'|'failed' }
{ type: 'complete',  sessionId: string, status: 'COMPLETED'|'PARTIAL'|'FAILED', totalRecordsCreated: number, overallConfidence: number, monthsProcessed: number }
{ type: 'error',     message: string, month?: number }
```

---

## 8. Database Impact

**No schema changes required.** All models already exist.

| Model             | Operation                       | Notes                                                                   |
| ----------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `AIImportSession` | CREATE (upload), UPDATE (parse) | `metadata` stores parsed CSV rows; no `images` array                    |
| `AIUsageLog`      | CREATE per month group          | `imageId: null`, `model: 'text-embedding-3-small'`                      |
| `Expense`         | CREATE if missing               | Managed by `mapExpenseData()` via `calendarId_userId` unique constraint |
| `ExpenseEntry`    | CREATE per matched row          | `importImageId: null` for CSV imports                                   |
| `ExpenseCategory` | READ only                       | Fetched by `mapExpenseData()`, used for embedding matching              |
| `ImportImage`     | NOT used                        | CSV imports have no binary file storage                                 |

---

## 9. Security & Auth

| Check                   | Route      | Implementation                                      |
| ----------------------- | ---------- | --------------------------------------------------- |
| Authentication          | Both       | `auth()` from `@/server/auth` — 401 if no session   |
| Ownership               | Parse only | `session.userId === request user` — 403 if mismatch |
| MIME validation         | Upload     | Custom CSV validators (not image validators)        |
| File size limit         | Upload     | Max 5MB                                             |
| Row count limit         | Upload     | Max 1000 expense rows                               |
| Request body validation | Parse      | Zod `CsvParseRequestSchema`                         |
| No secrets in responses | Both       | Internal errors logged server-side only             |

---

## 10. Error Handling & Graceful Degradation

| Scenario                        | Behaviour                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Invalid CSV MIME type           | 400 with error message                                                                                |
| Missing required CSV headers    | 400 with error message                                                                                |
| No expense rows in file         | 400 with error message                                                                                |
| Embedding API unavailable       | `matchCategoryWithEmbedding()` falls back to Levenshtein; session marked `PARTIAL` if matches degrade |
| Per-month processing error      | SSE `error` event emitted; other months continue; session marked `PARTIAL`                            |
| All months fail                 | Session marked `FAILED`; SSE `complete` event with `status: 'FAILED'`                                 |
| Session not found at parse time | 404 JSON response (before SSE starts)                                                                 |
| Ownership check failure         | 403 JSON response (before SSE starts)                                                                 |

---

## 11. Environment Variables

| Variable                            | Required | Default                    | Purpose                       |
| ----------------------------------- | -------- | -------------------------- | ----------------------------- |
| `AI_API_KEY`                        | Yes      | —                          | API key for embedding service |
| `AI_PROVIDER`                       | No       | `'github'`                 | `'github'` or `'openai'`      |
| `AI_EMBEDDING_MODEL`                | No       | `'text-embedding-3-small'` | Embedding model               |
| `AI_EMBEDDING_SIMILARITY_THRESHOLD` | No       | `0.75`                     | Category match threshold      |

**No new environment variables required for Phase 2.**

---

## 12. Key Differences vs AI Image Import

| Aspect                  | AI Image Import             | CSV Import (Phase 2)                 |
| ----------------------- | --------------------------- | ------------------------------------ |
| Upload file type        | PNG/JPEG/WebP/HEIC          | text/csv                             |
| Binary storage          | Required (local/S3/Blob)    | Not required — in-memory only        |
| Data extraction         | GPT-4o Vision API           | Direct CSV parsing                   |
| Input to embedding      | AI-extracted category label | Raw merchant transaction description |
| `ImportImage` DB record | Required                    | Not used                             |
| `AIUsageLog` rows       | 2 (vision + embedding)      | 1 (embedding only)                   |
| Month context           | Passed in request body      | Derived per-row from CSV date column |
| Confidence              | GPT-4o confidence (0–1)     | Always 1.0 (amounts are exact)       |

---

## 13. Related Documents

- [spec/semantic-category-matching/semantic-category-matching-hld.md](../semantic-category-matching/semantic-category-matching-hld.md) — Embedding/category matching HLD
- [spec/semantic-category-matching/semantic-category-matching-lld.md](../semantic-category-matching/semantic-category-matching-lld.md) — Embedding service LLD
- [spec/csv-import/csv-import-lld.md](csv-import-lld.md) — Low Level Design (implementation detail)
- [e2e/cashflow/csv-import.spec.ts](../../e2e/cashflow/csv-import.spec.ts) — E2E test suite
