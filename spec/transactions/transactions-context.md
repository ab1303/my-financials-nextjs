# Transactions Feature — Implementation Context Document

**Version:** 1.0  
**Status:** Implementation-Ready  
**Target Path:** `src/app/(authorized)/cashflow/transactions/`  
**Spec Author:** Context Architect (generated from codebase analysis)

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Existing Code Inventory](#2-existing-code-inventory)
3. [Critical Schema Discrepancies (Must Read First)](#3-critical-schema-discrepancies-must-read-first)
4. [New Prisma Model](#4-new-prisma-model)
5. [API Route Specifications](#5-api-route-specifications)
6. [Component Specifications](#6-component-specifications)
7. [Data Flow](#7-data-flow)
8. [Type Definitions](#8-type-definitions)
9. [Migration Plan](#9-migration-plan)
10. [Navigation Change](#10-navigation-change)
11. [Out-of-Scope Guard (Phase 1)](#11-out-of-scope-guard-phase-1)

---

## 1. Feature Overview

### Problem Being Solved

Two import wizards — the CSV Import Wizard and the AI Image Import Wizard — are currently embedded as modal dialogs inside `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx`. This coupling creates three problems:

1. **Wrong location**: CSV imports process full bank statements (all transaction types), but live inside the Expense page which is purely debit-focused.
2. **Missing credit handling**: The CSV wizard silently drops credits (positive amounts from CommBank CSV). Credits represent income or transfers — both need routing.
3. **No universal entry point**: Users importing financial data have no single, discoverable home for that workflow. Each import type requires navigating to a specific section.

### Vision

`/cashflow/transactions` becomes the **universal import hub** for all bank-originated data. It is a first-class top-level page under the Cashflow nav group. The Expenses page shrinks to a pure aggregate reporting view with only an "Import transactions →" link.

### Decisions Already Locked (do not re-open)

| Decision | Detail |
|---|---|
| Route prefix | `/cashflow/transactions` |
| CSV bank account | **Required** — statement is account-scoped |
| AI image bank account | **Optional** — receipt/invoice may not tie to one account; defaults to "Unknown" |
| CSV credits | LLM classifies as `IncomeSourceEnumType` label OR `Transfer`/`Excluded`; confirmed credits feed `IncomeRecord` |
| CSV debits | LLM classifies as expense category name; confirmed debits feed `MonthlyExpenseSummary` (via existing `ExpenseLedger` pattern) |
| AI image route | Keeps existing upload → SSE parse flow; **adds** a new Review step before saving |
| Phase 1 scope | Import only (no transaction list view, no editing confirmed records) |
| Old wizard retirement | Wizards are **removed** from Expenses page after Transactions ships (migration plan in §9) |

---

## 2. Existing Code Inventory

### 2.1 Files to MOVE (wholesale copy → update paths)

| Current Path | New Path | What Changes |
|---|---|---|
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVImportWizard.tsx` | `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` | Add `bankAccountId` state; remove `calendarYearId` prop (wizard fetches its own calendar); update fetch targets to `/api/transactions/csv/*` |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVUploadStep.tsx` | `src/app/(authorized)/cashflow/transactions/_components/csv/CSVUploadStep.tsx` | Add bank account selector above dropzone; POST to `/api/transactions/csv/upload` with `bankAccountId` |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVClassifyingStep.tsx` | `src/app/(authorized)/cashflow/transactions/_components/csv/CSVClassifyingStep.tsx` | POST to `/api/transactions/csv/classify`; update SSE handler to handle new `credit_classified` event |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVResultsStep.tsx` | `src/app/(authorized)/cashflow/transactions/_components/csv/CSVResultsStep.tsx` | Minor: show debit/credit split in stats panel |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/_types.ts` | `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts` | Add `bankAccountId` to `CSVImportContext`; add `TransactionType` to `ClassifiedTransaction` (see §8) |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/AIImportWizard.tsx` | `src/app/(authorized)/cashflow/transactions/_components/ai/AIImportWizard.tsx` | Add `bankAccountId` (optional) state; add `review` step; wire to `/api/transactions/ai/*` |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/UploadStep.tsx` | `src/app/(authorized)/cashflow/transactions/_components/ai/UploadStep.tsx` | Add optional bank account selector; remove `context.month` display (no longer needed) |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/ProcessingStep.tsx` | `src/app/(authorized)/cashflow/transactions/_components/ai/ProcessingStep.tsx` | POST to `/api/transactions/ai/upload` and `/api/transactions/ai/parse`; do NOT save on parse — emit `extracted` data for review step |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/ResultsStep.tsx` | `src/app/(authorized)/cashflow/transactions/_components/ai/ResultsStep.tsx` | Minor cosmetic changes |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/_types.ts` | `src/app/(authorized)/cashflow/transactions/_components/ai/_types.ts` | Add `bankAccountId?: string` to context; add `ReviewStep` types; extend `WizardStep` to include `'review'` |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/_schema.ts` | `src/app/(authorized)/cashflow/transactions/_components/ai/_schema.ts` | Add `ReviewRequestSchema`; update `SSEEventSchema` to emit `extracted` not `saved` |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/ConfidenceBadge.tsx` | `src/app/(authorized)/cashflow/transactions/_components/ai/ConfidenceBadge.tsx` | No changes — copy verbatim |

### 2.2 Files to KEEP IN PLACE (shared, used by both old and new locations)

| Path | Role |
|---|---|
| `src/components/csv-import/TransactionReviewTable.tsx` | Review table for CSV debits — **reused as-is** from Transactions page. `ClassifiedMonth` and `ClassifiedTransaction` types exported from here. |
| `src/server/services/ai-import/csv-classifier.service.ts` | `classifyTransactions()` — called by new `/api/transactions/csv/classify`. Currently classifies ALL transactions as expense categories. **Must be extended** to return `type: 'DEBIT' \| 'CREDIT'` and classify credits separately (see §5.2). |
| `src/server/services/ai-import/category-matcher.service.ts` | `matchCategoryWithEmbedding()` and `matchCategory()` — reused by new confirm routes |
| `src/server/services/ai-import/validation.ts` | All validation constants and Zod schemas reused. New schemas for transactions routes added in same file or new `src/server/services/transactions/validation.ts` |
| `src/server/services/ai-import/_types.ts` | `ClassifiedTransaction`, `CsvTransaction`, `AITokenUsage` etc — **extended**, not replaced (see §8) |
| `src/server/services/ai-import/image-storage.adapter.ts` | Reused verbatim by new AI upload route |
| `src/server/services/ai-import/cleanup.service.ts` | `deleteExpiredImages()` / `setImageExpiration()` — reused verbatim |
| `src/server/services/ai-import/ai-vision.service.ts` | `extractExpenseData()` — reused by new AI parse route |

### 2.3 Files to MODIFY

| Path | What Changes |
|---|---|
| `src/layouts/SideNav.tsx` | Add `Transactions` item to `cashflowItems` array; add `pathname.startsWith('/cashflow/transactions')` to `defaultOpen` logic |
| `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` | Remove `AIImportWizard` and `CSVImportWizard` imports and state; remove both modal render blocks; replace import buttons with a single `<Link href="/cashflow/transactions">Import transactions →</Link>` |

### 2.4 Files to RETIRE (delete after migration)

| Path | Retirement Condition |
|---|---|
| `src/app/(authorized)/cashflow/expense/_components/csv-import/` (entire directory) | After Transactions page ships and `ExpenseTableClient.tsx` migration is confirmed working |
| `src/app/(authorized)/cashflow/expense/_components/ai-import/` (entire directory) | Same condition |
| `src/app/api/csv-import/upload/route.ts` | After all callers migrated to `/api/transactions/csv/upload` |
| `src/app/api/csv-import/classify/route.ts` | After migration |
| `src/app/api/csv-import/parse/route.ts` | After migration (this is an older route superseded by classify+confirm pattern) |
| `src/app/api/csv-import/confirm/route.ts` | After migration |
| `src/app/api/ai-import/upload/route.ts` | After migration to `/api/transactions/ai/upload` |
| `src/app/api/ai-import/parse/route.ts` | After migration to `/api/transactions/ai/parse` + `/api/transactions/ai/confirm` |

### 2.5 New Files to CREATE

```
src/app/(authorized)/cashflow/transactions/
  ├── page.tsx
  ├── layout.tsx
  └── _components/
      ├── csv/
      │   ├── CSVImportWizard.tsx
      │   ├── CSVUploadStep.tsx
      │   ├── CSVClassifyingStep.tsx
      │   ├── CSVTransactionReviewTable.tsx  ← NEW (wraps + extends existing TransactionReviewTable with credit support)
      │   ├── CSVResultsStep.tsx
      │   └── _types.ts
      └── ai/
          ├── AIImportWizard.tsx
          ├── UploadStep.tsx
          ├── ProcessingStep.tsx
          ├── ReviewStep.tsx                 ← NEW
          ├── ResultsStep.tsx
          ├── ConfidenceBadge.tsx
          ├── _types.ts
          └── _schema.ts

src/app/api/transactions/
  ├── csv/
  │   ├── upload/route.ts
  │   ├── classify/route.ts
  │   └── confirm/route.ts
  └── ai/
      ├── upload/route.ts
      ├── parse/route.ts
      └── confirm/route.ts

src/server/services/transactions/
  ├── csv-confirm.service.ts    ← debit → MonthlyExpenseSummary, credit → IncomeRecord
  └── _types.ts                 ← TransactionConfirmRequest, TransactionSaveResult
```

---

## 3. Critical Schema Discrepancies (Must Read First)

⚠️ **The existing route code references several Prisma models that do NOT match `prisma/schema.prisma`.** These must be resolved before or during the Transactions implementation.

### Discrepancy Table

| Route Code Uses | Schema Has | Prisma Accessor | Action |
|---|---|---|---|
| `prisma.aIImportSession` | `model ImportSession` | `prisma.importSession` | All new routes use `prisma.importSession`. Update existing `/api/csv-import/*` and `/api/ai-import/*` routes when retiring them. |
| `prisma.transactionCategoryOverride` (in `confirm/route.ts`) | `model MerchantCategoryMap` | `prisma.merchantCategoryMap` | New confirm routes use `prisma.merchantCategoryMap` with `@@unique([userId, description])` |
| `prisma.expense` (in `expense-mapper.service.ts`) | Does not exist | — | New `csv-confirm.service.ts` uses `prisma.expenseLedger` and `prisma.monthlyExpenseSummary` directly. **Do not call `mapExpenseData()` from new routes.** |
| `prisma.expenseEntry` (in `expense-mapper.service.ts`) | Does not exist | — | Same as above. `MonthlyExpenseSummary` is the correct aggregate model. |
| `prisma.aIUsageLog` | `model AIUsageLog` | `prisma.aIUsageLog` | ✅ Correct — Prisma lowercases only the first character of `AI` → `aI`. |
| `prisma.importImage` | `model ImportImage` | `prisma.importImage` | ✅ Correct. |

### Correct Expense Write Pattern (from schema)

```typescript
// Ensure ExpenseLedger exists for this user+calendar
let ledger = await prisma.expenseLedger.findUnique({
  where: { calendarId_userId: { calendarId, userId } },
});
if (!ledger) {
  ledger = await prisma.expenseLedger.create({
    data: { calendarId, userId },
  });
}

// Upsert MonthlyExpenseSummary (aggregate per category per month)
const existing = await prisma.monthlyExpenseSummary.findFirst({
  where: { expenseLedgerId: ledger.id, categoryId, month: monthNum },
});
if (existing) {
  await prisma.monthlyExpenseSummary.update({
    where: { id: existing.id },
    data: { amount: { increment: amount } },
  });
} else {
  await prisma.monthlyExpenseSummary.create({
    data: { month: monthNum, amount, categoryId, expenseLedgerId: ledger.id },
  });
}
```

### Correct Income Write Pattern (from schema)

```typescript
// Ensure IncomeLedger exists for this user+calendar
let incomeLedger = await prisma.incomeLedger.findUnique({
  where: { calendarId_userId: { calendarId, userId } },
});
if (!incomeLedger) {
  incomeLedger = await prisma.incomeLedger.create({
    data: { calendarId, userId },
  });
}

// Create IncomeRecord
await prisma.incomeRecord.create({
  data: {
    dateEarned: new Date(transaction.date),
    amount: String(transaction.amount),
    source: transaction.confirmedCategory as IncomeSourceEnumType,
    incomeLedgerId: incomeLedger.id,
  },
});
```

---

## 4. New Prisma Model

Add the following to `prisma/schema.prisma`. Place it after the `MerchantCategoryMap` model.

```prisma
// ─── Transactions ──────────────────────────────────────────────────────────

enum TransactionTypeEnum {
  DEBIT
  CREDIT
}

enum TransactionSourceEnum {
  LLM_CLASSIFIED   // AI assigned the category
  USER_OVERRIDE    // User changed the LLM suggestion before confirming
}

enum TransactionStatusEnum {
  PENDING     // Classified but not yet confirmed by user
  CONFIRMED   // User confirmed; downstream records written
  EXCLUDED    // User marked as transfer/excluded; no downstream record written
}

// Transaction — staging record for every line in a CSV or AI-extracted receipt
// A Transaction is created on confirm (not on classify). It is the audit trail.
model Transaction {
  id              String                  @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                 @db.Money          // Always positive absolute value
  type            TransactionTypeEnum
  category        String                  // Expense category name (DEBIT) or IncomeSourceEnumType label (CREDIT) or "Transfer" / "Excluded"
  source          TransactionSourceEnum
  status          TransactionStatusEnum   @default(PENDING)
  confirmedAt     DateTime?

  // Relations
  bankAccount     BankAccount?            @relation(fields: [bankAccountId], references: [id])
  bankAccountId   String?                 // Required for CSV imports; null for AI image imports ("Unknown")
  user            User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  importSession   ImportSession?          @relation(fields: [importSessionId], references: [id])
  importSessionId String?

  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}
```

### Relation back-references — add to existing models:

```prisma
// In model User (after existing relations):
transactions        Transaction[]

// In model BankAccount (after existing relations):
transactions        Transaction[]

// In model ImportSession (after existing relations):
transactions        Transaction[]
```

### Migration command:

```bash
pnpm prisma migrate dev --name add_transaction_model
```

### Design notes:

- `amount` is always a **positive absolute value**. The `type` field (DEBIT/CREDIT) carries the sign semantics.
- `category` is a plain string intentionally — it holds whatever the classifier returns (expense category name, `IncomeSourceEnumType` value like `"EMPLOYMENT"`, or `"Transfer"` / `"Excluded"`). No FK to `ExpenseCategory` to keep the model flexible.
- `bankAccountId` is nullable. For AI image imports where no account is selected, it remains `null`. The UI should display "Unknown" in this case.
- `importSessionId` links back to the `ImportSession` for audit purposes. Not required (nullable) in case transactions are ever created manually.
- `status = CONFIRMED` means: the downstream record has been written (`MonthlyExpenseSummary` for debits, `IncomeRecord` for credits). `EXCLUDED` means the user chose "Transfer / Skip" and no downstream record was written.

---

## 5. API Route Specifications

### Auth Pattern (copy for every new route)

```typescript
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  // ...
}
```

### SSE Response Pattern (copy for classify and parse routes)

```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    try {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'progress', ... })}\n\n`)
      );
      controller.close();
    } catch (err) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`)
      );
      controller.close();
    }
  },
});

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
});
```

---

### 5.1 `POST /api/transactions/csv/upload`

**File:** `src/app/api/transactions/csv/upload/route.ts`  
**Pattern:** Copy from `src/app/api/csv-import/upload/route.ts` — update model accessor and add `bankAccountId` validation.

**Request:** `multipart/form-data`
```
file          File     (CSV, max 5MB, max 1000 rows)
bankAccountId string   (required — cuid of user's BankAccount)
```

**Validation steps:**
1. Auth check (`session?.user?.id`)
2. Validate `file` is present and is CSV (MIME + extension check using `ALLOWED_CSV_MIME_TYPES` from `src/server/services/ai-import/validation.ts`)
3. Validate `fileSize <= MAX_CSV_FILE_SIZE` (5MB)
4. `bankAccountId` must be non-empty string
5. Verify `bankAccountId` exists and belongs to `userId`:
   ```typescript
   const account = await prisma.bankAccount.findFirst({
     where: { id: bankAccountId, userId },
   });
   if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
   ```
6. Parse CSV with `parseCommBankCsv(csvContent)` from `src/server/services/ai-import/csv-parser.service.ts`
7. Validate row count: `1 <= transactions.length <= MAX_CSV_ROWS` (1000)

**DB write:** `prisma.importSession.create` (NOT `prisma.aIImportSession`):
```typescript
const importSession = await prisma.importSession.create({
  data: {
    userId,
    importType: 'EXPENSE',
    status: 'PENDING',
    metadata: {
      fileName,
      fileSize,
      bankAccountId,
      transactions,   // CsvTransaction[] with type: DEBIT | CREDIT
    },
  },
});
```

**Success Response `200`:**
```typescript
{
  fileId: string;          // importSession.id
  fileName: string;
  fileSize: number;
  rowCount: number;
  bankAccountId: string;
  bankAccountName: string; // account.name for display
  transactions: CsvTransaction[];
}
```

**Error Responses:** `400` (validation), `401` (auth), `404` (account not found), `500`

---

### 5.2 `POST /api/transactions/csv/classify` (SSE)

**File:** `src/app/api/transactions/csv/classify/route.ts`  
**Pattern:** Copy from `src/app/api/csv-import/classify/route.ts` — extend to handle credits separately.

**Request body:**
```typescript
{
  fileId: string;     // importSession.id from upload step
  calendarId: string;
}
```

**Zod schema** (add to `src/server/services/ai-import/validation.ts`):
```typescript
export const TransactionClassifyRequestSchema = z.object({
  fileId: z.string().min(1),
  calendarId: z.string().min(1),
});
```

**Processing logic:**
1. Load `prisma.importSession.findUnique({ where: { id: fileId } })` — check ownership
2. Extract `transactions: CsvTransaction[]` from `importSession.metadata`
3. Split by transaction type:
   ```typescript
   const debits = transactions.filter(tx => tx.type === 'DEBIT');
   const credits = transactions.filter(tx => tx.type === 'CREDIT');
   ```
4. Fetch expense categories: `prisma.expenseCategory.findMany({ where: { isActive: true } })`
5. Classify **debits** per-month using `classifyTransactions(monthTxs, categories)` from `csv-classifier.service.ts`
6. Classify **credits** per-month using a new `classifyCreditTransactions(monthTxs)` helper that asks LLM to assign an `IncomeSourceEnumType` value (`EMPLOYMENT`, `STOCKS`, `BONDS`, `RENTAL`, `BUSINESS`, `FREELANCE`, `OTHER`) or `"Transfer"` or `"Excluded"`

> ⚠️ **Implementation Note on CsvTransaction sign:**  
> Currently `csv-parser.service.ts` stores `amount` as positive absolute. The `type` (DEBIT/CREDIT) is lost. Update `parseCommBankCsv()` so `CsvTransaction` gains a `type: 'DEBIT' | 'CREDIT'` field derived from the raw CSV amount sign (negative → DEBIT, positive → CREDIT) before it's made absolute. This is a **required prerequisite** for the Transactions feature.

**SSE Events:**
```typescript
{ type: 'debit_classified'; month: string; transactions: ClassifiedTransactionV2[]; usage: LlmUsage }
{ type: 'credit_classified'; month: string; transactions: ClassifiedCreditTransaction[]; usage: LlmUsage }
{ type: 'progress'; month: string; processed: number; total: number }
{ type: 'warning'; month: string; message: string }
{
  type: 'done';
  totalLlmTokens: number;
  model: string;
  categories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];   // IncomeSourceEnumType values + "Transfer" + "Excluded"
}
{ type: 'error'; message: string }
```

---

### 5.3 `POST /api/transactions/csv/confirm`

**File:** `src/app/api/transactions/csv/confirm/route.ts`

**Request body:**
```typescript
{
  fileId: string;
  calendarYearId: string;
  llmUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  debitMonths: Array<{
    month: string;                       // "YYYY-MM"
    transactions: ClassifiedTransactionV2[];
  }>;
  creditMonths: Array<{
    month: string;
    transactions: ClassifiedCreditTransaction[];
  }>;
}
```

**Processing — delegate to `csv-confirm.service.ts`:**

```typescript
// src/server/services/transactions/csv-confirm.service.ts

export async function confirmDebitTransactions(
  debitMonths: DebitMonth[],
  calendarYearId: string,
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult>

export async function confirmCreditTransactions(
  creditMonths: CreditMonth[],
  calendarYearId: string,
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult>
```

**`confirmDebitTransactions` logic (per month):**
1. Parse `monthNum` from `"YYYY-MM"` string
2. Build category lookup: `Map<categoryName, categoryId>`
3. For each transaction where `status !== 'EXCLUDED'`:
   - Find `categoryId` from category map
   - Upsert `MonthlyExpenseSummary` (see §3 correct pattern)
   - Create `Transaction` record with `type: 'DEBIT'`, `status: 'CONFIRMED'`
4. Upsert `MerchantCategoryMap` for each transaction (for future RAG)

**`confirmCreditTransactions` logic (per month):**
1. For each transaction where `confirmedCategory === 'Transfer' || confirmedCategory === 'Excluded'`:
   - Create `Transaction` record with `type: 'CREDIT'`, `status: 'EXCLUDED'`
   - **No** downstream record written
2. For each remaining credit transaction:
   - Upsert `IncomeLedger` (see §3 correct pattern)
   - Create `IncomeRecord` with `source: confirmedCategory as IncomeSourceEnumType`
   - Create `Transaction` record with `type: 'CREDIT'`, `status: 'CONFIRMED'`

**After processing:**
- Log LLM usage to `prisma.aIUsageLog` if `totalTokens > 0`
- Update `importSession.status` to `COMPLETED | PARTIAL | FAILED`

**Success Response `200`:**
```typescript
{
  success: boolean;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  debitsSaved: number;
  creditsSaved: number;
  creditsExcluded: number;
  totalEntries: number;
  errors: Array<{ month: string; message: string }>;
}
```

---

### 5.4 `POST /api/transactions/ai/upload`

**File:** `src/app/api/transactions/ai/upload/route.ts`  
**Pattern:** Copy from `src/app/api/ai-import/upload/route.ts`. No logic changes — adds optional `bankAccountId` stored in session metadata.

**Request:** `multipart/form-data`
```
files[]       File[]    (images, max 10, max 10MB each)
bankAccountId string?   (optional)
```

**Changes from existing route:**
1. Extract `bankAccountId = formData.get('bankAccountId') as string | null`
2. If provided, verify it belongs to `userId`
3. Store `bankAccountId` in session metadata

**Response:** Same shape as existing `/api/ai-import/upload` + echoed `bankAccountId?`

---

### 5.5 `POST /api/transactions/ai/parse` (SSE)

**File:** `src/app/api/transactions/ai/parse/route.ts`  
**Key difference from existing `/api/ai-import/parse`: do NOT save to DB during parse. Only extract and emit.**

**Request body:**
```typescript
{
  imageIds: string[];
  importType: 'EXPENSE';
  bankAccountId?: string;
  context: {
    calendarYearId: string;
    month: number;
  };
}
```

**SSE Events (changed from existing):**
```typescript
{ type: 'progress'; imageIndex: number; totalImages: number; currentImage: string }
{ type: 'extracted'; imageId: string; confidence: number; entries: Array<{ categoryName: string; amount: number }> }
{ type: 'error'; imageId: string; errorMessage: string }
{
  type: 'complete';
  sessionId: string;
  images: Array<{
    imageId: string;
    fileName: string;
    confidence: number;
    entries: Array<{ categoryName: string; amount: number }>;
    status: 'success' | 'failed';
  }>;
}
```

> Session status after parse: set to `PROCESSING` (not `COMPLETED` — not confirmed yet).

---

### 5.6 `POST /api/transactions/ai/confirm`

**File:** `src/app/api/transactions/ai/confirm/route.ts`

**Request body:**
```typescript
{
  sessionId: string;
  calendarYearId: string;
  month: number;
  bankAccountId?: string;
  images: Array<{
    imageId: string;
    entries: Array<{
      categoryName: string;
      amount: number;
      confirmed: boolean;
    }>;
  }>;
}
```

**Zod schema:**
```typescript
export const AIConfirmRequestSchema = z.object({
  sessionId: z.string().cuid(),
  calendarYearId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  bankAccountId: z.string().cuid().optional(),
  images: z.array(z.object({
    imageId: z.string().cuid(),
    entries: z.array(z.object({
      categoryName: z.string().min(1),
      amount: z.number().positive(),
      confirmed: z.boolean(),
    })).min(1),
  })).min(1),
});
```

**Processing logic:**
1. Verify `sessionId` exists and belongs to `userId`
2. For each image, for each entry where `confirmed === true`:
   - Match `categoryName` using `matchCategoryWithEmbedding()` from `category-matcher.service.ts`
   - Upsert `MonthlyExpenseSummary` (see §3 correct pattern)
   - Create `Transaction` record with `type: 'DEBIT'`, `status: 'CONFIRMED'`, `bankAccountId` (nullable)
3. Update `ImportSession.status = 'COMPLETED'`, `recordsCreated = total`

**Success Response `200`:**
```typescript
{
  success: boolean;
  recordsCreated: number;
  sessionId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
}
```

---

## 6. Component Specifications

### 6.1 `page.tsx` — Transactions Page (Server Component)

**Path:** `src/app/(authorized)/cashflow/transactions/page.tsx`

```typescript
export default async function TransactionsPage()
// Responsibilities:
// 1. auth() check → redirect if no session
// 2. Fetch bankAccounts:
//    prisma.bankAccount.findMany({
//      where: { userId },
//      include: { bank: { select: { name: true } } },
//      orderBy: { createdAt: 'asc' },
//    })
// 3. Pass bankAccounts to TransactionsClient ('use client' wrapper)
```

**UI structure:**
```tsx
<main className='px-4 sm:px-6 lg:px-8 py-6'>
  <h1>Transactions</h1>
  <p className='text-muted-foreground'>Import and manage your bank transactions</p>
  <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mt-8'>
    <ImportCard title="CSV Bank Statement" ... onClick={() => setCSVWizardOpen(true)} />
    <ImportCard title="AI Receipt / Invoice" ... onClick={() => setAIWizardOpen(true)} />
  </div>
</main>
```

> No `calendarYearId` passed from the server — the CSV wizard resolves this from transaction dates in the confirm step (see Appendix B).

---

### 6.2 `layout.tsx`

```typescript
export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
// Mirror the pattern of src/app/(authorized)/cashflow/layout.tsx
```

---

### 6.3 `CSVImportWizard.tsx`

**Props interface:**
```typescript
interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
  // REMOVED: calendarYearId
}
```

**State additions:**
```typescript
const [classifiedDebitMonths, setClassifiedDebitMonths] = useState<ClassifiedMonth[]>([]);
const [classifiedCreditMonths, setClassifiedCreditMonths] = useState<ClassifiedCreditMonth[]>([]);
const [incomeSourceLabels, setIncomeSourceLabels] = useState<string[]>([]);
```

**Step sequence:** `upload → classifying → review → results` (unchanged 4-step structure)

---

### 6.4 `CSVUploadStep.tsx`

**Props changes:**
```typescript
interface CSVUploadStepProps {
  file: UploadedCSVFile | null;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  selectedBankAccountId: string | null;
  onBankAccountChange: (id: string) => void;
  onFileSelected: (file: UploadedCSVFile) => void;
  onRemoveFile: () => void;
  onStartImport: () => void;
  isLoading?: boolean;
}
```

**UI addition — add ABOVE the dropzone:**
```tsx
<div className='space-y-2 mb-6'>
  <label className='text-sm font-medium text-gray-700'>Bank Account *</label>
  <select
    value={selectedBankAccountId ?? ''}
    onChange={(e) => onBankAccountChange(e.target.value)}
    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm'
    required
  >
    <option value=''>Select a bank account</option>
    {bankAccounts.map((acc) => (
      <option key={acc.id} value={acc.id}>{acc.bankName} — {acc.name}</option>
    ))}
  </select>
</div>
```

**Guard:** "Import CSV" button disabled if `!selectedBankAccountId || !file`.

---

### 6.5 `CSVClassifyingStep.tsx`

**Props changes:**
```typescript
interface CSVClassifyingStepProps {
  file: UploadedCSVFile;
  calendarId: string;
  onComplete: (
    debitMonths: ClassifiedMonth[],
    creditMonths: ClassifiedCreditMonth[],
    categories: Array<{ id: string; name: string }>,
    incomeSourceLabels: string[],
    model: string,
  ) => void;
  onError: (message: string) => void;
}
```

**SSE handling additions:**
```typescript
} else if (type === 'credit_classified') {
  classifiedCreditMonthsRef.current = [
    ...classifiedCreditMonthsRef.current,
    { month: event.month, transactions: event.transactions, totalUsage: event.usage },
  ];
} else if (type === 'done') {
  onComplete(
    classifiedDebitMonthsRef.current,
    classifiedCreditMonthsRef.current,
    event.categories,
    event.incomeSourceLabels,
    event.model,
  );
}
```

---

### 6.6 `CSVTransactionReviewTable.tsx` (NEW)

**Props:**
```typescript
interface CSVTransactionReviewTableProps {
  debitMonths: ClassifiedMonth[];
  creditMonths: ClassifiedCreditMonth[];
  categories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];  // ['EMPLOYMENT', 'STOCKS', ..., 'Transfer', 'Excluded']
  llmModel: string;
  onConfirm: (debitMonths: ClassifiedMonth[], creditMonths: ClassifiedCreditMonth[]) => Promise<void>;
  isConfirming: boolean;
}
```

**UI structure:**
```tsx
<div>
  {/* Tab switcher */}
  <div className='flex border-b mb-4'>
    <button onClick={() => setActiveTab('debits')}>Expenses ({totalDebitCount})</button>
    <button onClick={() => setActiveTab('credits')}>
      Income / Credits ({totalCreditCount})
      {excludedCreditCount > 0 && <span>{excludedCreditCount} excluded</span>}
    </button>
  </div>

  {/* Debit tab: reuse existing TransactionReviewTable unchanged */}
  {activeTab === 'debits' && (
    <TransactionReviewTable months={localDebitMonths} categories={categories} ... />
  )}

  {/* Credit tab: inline CreditReviewPanel */}
  {activeTab === 'credits' && (
    <CreditReviewPanel
      months={localCreditMonths}
      incomeSourceLabels={incomeSourceLabels}
      onCategoryChange={handleCreditCategoryChange}
    />
  )}

  <div className='border-t pt-4 flex justify-end'>
    <button onClick={handleConfirmAll} disabled={isConfirming}>
      {isConfirming ? 'Saving…' : 'Confirm & Import All'}
    </button>
  </div>
</div>
```

**`CreditReviewPanel` columns:** Date | Description | Amount | LLM Suggested | Your Classification  
**Row styles:** amber for `overridden === true`; gray-strikethrough for `Excluded`

---

### 6.7 `AIImportWizard.tsx` (Transactions version)

**Props changes:**
```typescript
interface AIImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
  // REMOVED: calendarYearId
}
```

**Step sequence extended:** `upload → processing → review → results`

**State additions:**
```typescript
const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
const [extractedImages, setExtractedImages] = useState<ExtractedImageResult[]>([]);
const [sessionId, setSessionId] = useState<string | null>(null);
```

---

### 6.8 `ReviewStep.tsx` (NEW — AI import only)

**Props:**
```typescript
interface ReviewStepProps {
  sessionId: string;
  extractedImages: ExtractedImageResult[];
  categories: Array<{ id: string; name: string }>;
  calendarYearId: string;
  month: number;
  bankAccountId?: string;
  onConfirm: (result: AIImportSessionResult) => void;
  onBack: () => void;
  isConfirming: boolean;
}
```

**UI:** List each image with extracted entries. Per entry: `[✓ checkbox]` | category dropdown | `$amount` (editable). `ConfidenceBadge` per image. "Confirm & Save" → POSTs to `/api/transactions/ai/confirm`.

---

### 6.9 `UploadStep.tsx` (Transactions AI version)

**Changes:**
1. Remove `context.month` display banner
2. Add optional bank account selector above upload zone:
   ```tsx
   <select value={selectedBankAccountId ?? ''} onChange={...}>
     <option value=''>Unknown / Not applicable</option>
     {bankAccounts.map(...)}
   </select>
   ```
3. `onStartImport` still allowed with `files.length > 0` and no bank account selected

---

### 6.10 `ProcessingStep.tsx` (Transactions AI version)

**Key changes:**
1. Upload POSTs to `/api/transactions/ai/upload` (with optional `bankAccountId` in formData)
2. Parse POSTs to `/api/transactions/ai/parse`
3. On `type === 'complete'` SSE: call `onComplete(sessionId, extractedImages)` — **not** `onComplete(importSessionResult)`
4. The `extracted` SSE event (not `saved`) populates extracted images state

---

## 7. Data Flow

### 7.1 CSV Import End-to-End

```
User selects bank account + drops CSV file
↓
CSVUploadStep → POST /api/transactions/csv/upload
  - Validates file + bankAccountId
  - Parses CommBank CSV → CsvTransaction[] (with DEBIT/CREDIT type)
  - Creates ImportSession { metadata: { transactions, bankAccountId } }
  - Returns { fileId, rowCount, bankAccountName }
↓
CSVClassifyingStep → POST /api/transactions/csv/classify (SSE)
  - Groups by month, splits debits / credits
  - DEBITS: classifyTransactions() → expense category names
  - CREDITS: classifyCreditTransactions() → IncomeSourceEnumType | "Transfer" | "Excluded"
  - Streams: debit_classified, credit_classified events per month
  - Streams: done { categories, incomeSourceLabels, model }
↓
CSVTransactionReviewTable
  - "Expenses" tab: TransactionReviewTable (existing, unchanged)
  - "Income/Credits" tab: CreditReviewPanel
  - Single "Confirm & Import All" button
↓
POST /api/transactions/csv/confirm
  - Confirmed DEBIT → Upsert ExpenseLedger → Upsert MonthlyExpenseSummary → Create Transaction(DEBIT, CONFIRMED)
  - Confirmed CREDIT (non-excluded) → Upsert IncomeLedger → Create IncomeRecord → Create Transaction(CREDIT, CONFIRMED)
  - Excluded CREDIT → Create Transaction(CREDIT, EXCLUDED) only
  - Upsert MerchantCategoryMap for each debit (future RAG)
  - Log AIUsageLog, update ImportSession
↓
CSVResultsStep — shows debit/credit split summary
```

### 7.2 AI Image Import End-to-End

```
User optionally selects bank account + drops receipt images
↓
UploadStep → optional bank account selection
↓
ProcessingStep → POST /api/transactions/ai/upload
  - Uploads files to storage (getStorageAdapter())
  - Creates ImportImage records
  - Returns { imageIds, bankAccountId? }
↓
ProcessingStep → POST /api/transactions/ai/parse (SSE)
  - Creates ImportSession { status: PROCESSING }
  - For each image: extractExpenseData() → GPT-4o Vision → logs AIUsageLog
  - Streams 'extracted' events (NOT 'saved') — no DB writes
  - Streams 'complete' { sessionId, images: [...extracted...] }
↓
ReviewStep ← NEW
  - Shows extracted entries per image with ConfidenceBadge
  - User can uncheck entries, edit amounts, change category
  - "Confirm & Save" → POST /api/transactions/ai/confirm
↓
POST /api/transactions/ai/confirm
  - For each confirmed entry: matchCategoryWithEmbedding() → Upsert MonthlyExpenseSummary → Create Transaction(DEBIT, CONFIRMED)
  - Update ImportSession { status: COMPLETED }
↓
ResultsStep — shows per-image confidence scores
```

---

## 8. Type Definitions

### 8.1 Extended types in `src/server/services/ai-import/_types.ts`

```typescript
// EXISTING — do not change (backward compat until old wizard is retired)
export interface ClassifiedTransaction { ... }

// NEW — for Transactions feature
export interface ClassifiedTransactionV2 extends ClassifiedTransaction {
  type: 'DEBIT';
}

export interface ClassifiedCreditTransaction {
  id: string;
  description: string;
  amount: number;        // positive absolute value
  date: string;
  llmCategory: string;   // IncomeSourceEnumType value | "Transfer" | "Excluded"
  confirmedCategory: string;
  overridden: boolean;
  type: 'CREDIT';
}

export interface ClassifiedCreditMonth {
  month: string;           // "YYYY-MM"
  transactions: ClassifiedCreditTransaction[];
  totalUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### 8.2 `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts`

```typescript
import type { ClassifiedTransactionV2, ClassifiedCreditTransaction, ClassifiedCreditMonth } from '@/server/services/ai-import/_types';
import type { ClassifiedMonth } from '@/components/csv-import/TransactionReviewTable';

export interface CsvTransactionWithType {
  date: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  description: string;
  month: number;
  year: number;
}

export interface CSVImportContext {
  importType: 'EXPENSE';
  bankAccountId: string;   // REQUIRED for CSV
}

export interface CSVImportResult {
  sessionId: string;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  debitsSaved: number;
  creditsSaved: number;
  creditsExcluded: number;
  totalEntries: number;
  errors: Array<{ month: string; message: string }>;
}

export interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export type CSVWizardStep = 'upload' | 'classifying' | 'review' | 'results';
```

### 8.3 `src/app/(authorized)/cashflow/transactions/_components/ai/_types.ts`

```typescript
export interface ExtractedImageResult {
  imageId: string;
  fileName: string;
  confidence: number;
  entries: Array<{
    id: string;
    categoryName: string;
    amount: number;
    confirmed: boolean;
  }>;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface AIImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export interface ReviewStepProps {
  sessionId: string;
  extractedImages: ExtractedImageResult[];
  categories: Array<{ id: string; name: string }>;
  calendarYearId: string;
  month: number;
  bankAccountId?: string;
  onConfirm: (result: AIImportSessionResult) => void;
  onBack: () => void;
  isConfirming: boolean;
}

export interface AIImportSessionResult {
  sessionId: string;
  recordsCreated: number;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
}

export type WizardStep = 'upload' | 'processing' | 'review' | 'results';
```

### 8.4 `src/server/services/transactions/_types.ts`

```typescript
import type { ClassifiedTransactionV2, ClassifiedCreditTransaction } from '@/server/services/ai-import/_types';

export interface DebitMonth {
  month: string;   // "YYYY-MM"
  transactions: ClassifiedTransactionV2[];
}

export interface CreditMonth {
  month: string;
  transactions: ClassifiedCreditTransaction[];
}

export interface MonthError {
  month: string;
  message: string;
}

export interface TransactionSaveResult {
  savedMonths: number;
  totalEntries: number;
  errors: MonthError[];
}
```

---

## 9. Migration Plan

### Phase A: Build (do first)
1. Add `Transaction` model to `prisma/schema.prisma` + back-references to `User`, `BankAccount`, `ImportSession`
2. Run `pnpm prisma migrate dev --name add_transaction_model`
3. Update `csv-parser.service.ts` to add `type: 'DEBIT' | 'CREDIT'` to `CsvTransaction` (**breaking change** — update `_types.ts` and downstream consumers)
4. Create `src/app/(authorized)/cashflow/transactions/` directory structure
5. Create 6 new API routes under `src/app/api/transactions/`
6. Create `src/server/services/transactions/csv-confirm.service.ts`
7. Extend `csv-classifier.service.ts`: add `classifyCreditTransactions()`
8. Build all new page and component files

### Phase B: Navigation
1. Modify `src/layouts/SideNav.tsx` — add Transactions item (see §10)

### Phase C: Expense page migration (do LAST, after Transactions is tested)
1. In `ExpenseTableClient.tsx`:
   - Remove `AIImportWizard` + `CSVImportWizard` imports, state, and render blocks
   - Replace import buttons with:
     ```tsx
     <Link href='/cashflow/transactions' className='inline-flex items-center gap-2 ...'>
       <ArrowRight className='h-4 w-4' />
       Import transactions
     </Link>
     ```
2. Delete `src/app/(authorized)/cashflow/expense/_components/csv-import/` (entire directory)
3. Delete `src/app/(authorized)/cashflow/expense/_components/ai-import/` (entire directory)

### Phase D: Old API route retirement
After Phase C is merged and stable:
- Delete `src/app/api/csv-import/` (entire directory — 4 routes)
- Delete `src/app/api/ai-import/upload/route.ts` and `/parse/route.ts`

> ⚠️ **Do NOT delete old routes simultaneously with Phase C.** Return `410 Gone` from old routes during the grace period to catch any in-flight or cached requests.

---

## 10. Navigation Change

**File:** `src/layouts/SideNav.tsx`

```typescript
// BEFORE:
const cashflowItems: NavItem[] = [
  { name: 'Income', href: '/cashflow/income', icon: DollarSign },
  { name: 'Donations', href: '/cashflow/donations', icon: Gift },
  { name: 'Expenses', href: '/cashflow/expense', icon: Receipt },
  { name: 'Bank Interest', href: '/cashflow/bank-interest', icon: Percent },
];

// AFTER:
const cashflowItems: NavItem[] = [
  { name: 'Income', href: '/cashflow/income', icon: DollarSign },
  { name: 'Donations', href: '/cashflow/donations', icon: Gift },
  { name: 'Expenses', href: '/cashflow/expense', icon: Receipt },
  { name: 'Transactions', href: '/cashflow/transactions', icon: ArrowLeftRight },  // ← NEW
  { name: 'Bank Interest', href: '/cashflow/bank-interest', icon: Percent },
];
```

**Import addition** (inside existing `lucide-react` import):
```typescript
ArrowLeftRight,
```

**`defaultOpen` addition:**
```typescript
// Add to the CashFlow navGroup defaultOpen condition:
pathname.startsWith('/cashflow/transactions') ||
```

---

## 11. Out-of-Scope Guard (Phase 1)

| What | Why deferred |
|---|---|
| Transaction list/table view on the Transactions page | Phase 1 = import only. The `Transaction` model is written for audit but not queried in UI yet. |
| Editing or deleting confirmed `Transaction` records | Corrections happen by re-importing. |
| Filtering/searching the Transaction table | No table in Phase 1. |
| Transaction deduplication (detecting already-imported rows) | Phase 2. Supported by `[userId, bankAccountId, date]` index. |
| Multi-bank account reconciliation view | Phase 2. |
| `ImportTypeEnum.TRANSACTION` Prisma enum value | Phase 1 reuses `EXPENSE` to avoid a breaking migration. Phase 2 adds a dedicated enum. |
| RAG-based auto-classification using MerchantCategoryMap | Written on confirm (Phase 1) but not read for LLM context (Phase 2). |
| CSV formats other than CommBank | Only `Date, Amount, Description, Balance` format supported. |
| Bulk import session history page | Phase 2. |

---

## Appendix A — Key File Relationships at a Glance

```
src/layouts/SideNav.tsx
  └── cashflowItems[] ← ADD 'Transactions' item

src/app/(authorized)/cashflow/transactions/
  ├── page.tsx          [Server Component — fetches bankAccounts]
  ├── layout.tsx        [passthrough]
  └── _components/
      ├── csv/
      │   ├── CSVImportWizard.tsx          → /api/transactions/csv/*
      │   ├── CSVUploadStep.tsx            → bank account selector + file upload
      │   ├── CSVClassifyingStep.tsx       → handles debit+credit SSE events
      │   ├── CSVTransactionReviewTable.tsx← NEW (tabs: debits | credits)
      │   │     └── uses TransactionReviewTable from @/components/csv-import/
      │   └── CSVResultsStep.tsx
      └── ai/
          ├── AIImportWizard.tsx           → 4-step: upload→processing→review→results
          ├── UploadStep.tsx               → optional bank account selector
          ├── ProcessingStep.tsx           → extracts but does NOT save
          ├── ReviewStep.tsx               ← NEW (confirm before save)
          ├── ResultsStep.tsx
          └── ConfidenceBadge.tsx          (copy verbatim)

src/app/api/transactions/
  ├── csv/
  │   ├── upload/route.ts     → ImportSession + validates bankAccountId
  │   ├── classify/route.ts   → SSE: debit + credit classification
  │   └── confirm/route.ts    → writes MonthlyExpenseSummary + IncomeRecord + Transaction
  └── ai/
      ├── upload/route.ts     → same as ai-import/upload + bankAccountId
      ├── parse/route.ts      → extracts only, emits 'extracted' not 'saved'
      └── confirm/route.ts    → writes MonthlyExpenseSummary + Transaction

src/server/services/
  ├── ai-import/
  │   ├── csv-classifier.service.ts  ← EXTEND: add classifyCreditTransactions()
  │   ├── csv-parser.service.ts      ← EXTEND: add type: DEBIT|CREDIT to CsvTransaction
  │   ├── category-matcher.service.ts← REUSE verbatim
  │   ├── expense-mapper.service.ts  ← DO NOT CALL from new routes (wrong model names)
  │   └── _types.ts                  ← EXTEND: add ClassifiedTransactionV2, ClassifiedCreditTransaction
  └── transactions/  ← NEW
      ├── csv-confirm.service.ts     → writes ExpenseLedger+MonthlyExpenseSummary, IncomeLedger+IncomeRecord
      └── _types.ts

src/components/csv-import/
  └── TransactionReviewTable.tsx     ← REUSE AS-IS for debit review tab
```

---

## Appendix B — calendarYearId Resolution in CSV Confirm

The existing CSV wizard accepted `calendarYearId` as a prop. In the new Transactions page, no fiscal year is pre-selected. The `calendarYearId` must be **resolved from the transaction dates** in the confirm step.

```typescript
// For each month being confirmed (e.g. "2024-07"):
const [yearStr, monthStr] = monthKey.split('-');
const year = parseInt(yearStr);
const month = parseInt(monthStr);

const calendarYear = await prisma.calendarYear.findFirst({
  where: {
    type: 'FISCAL',
    OR: [
      // Jul–Dec: fromYear = year, fromMonth <= month
      { fromYear: year, fromMonth: { lte: month } },
      // Jan–Jun: toYear = year, toMonth >= month
      { toYear: year, toMonth: { gte: month } },
    ],
  },
});
if (!calendarYear) throw new Error(`No fiscal year found for ${monthKey}`);
const calendarYearId = calendarYear.id;
```

This makes the wizard fully self-contained — no calendar year prop needed.

---

*End of context document. Total implementation scope: ~15 new files, ~5 modified files, ~12 files retired.*
