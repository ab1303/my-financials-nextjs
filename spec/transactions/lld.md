# Transactions Feature — Low Level Design

**Version:** 1.0  
**Status:** Implementation-Ready  
**Reference:** `hld.md` for architecture; `transactions-context.md` for full detail  

---

## How to Use This Document for Agent Delegation

Each Phase is a delegation unit. Each task within a phase is an agent sub-task.  
When delegating: pass `hld.md` (architecture context) + the **specific task section below**.

```
Phase A — Build (all additive, low risk)
  A1  Prisma model + migration
  A2  csv-parser.service.ts update (prerequisite for A3–A5)
  A3  csv-classifier.service.ts extension
  A4  csv-confirm.service.ts (new)
  A5  3 CSV API routes
  A6  3 AI API routes
  A7  Transactions page + layout (Server Components)
  A8  CSV wizard components
  A9  AI wizard components

Phase B — Navigation
  B1  SideNav.tsx update

Phase C — Expense page migration (do AFTER A+B are tested)
  C1  ExpenseTableClient.tsx cleanup
  C2  Delete old component directories

Phase D — Old API route retirement (AFTER C stable)
  D1  Delete old API routes
```

---

## ⚠️ Critical Prerequisites (Read Before Any Task)

### Schema Discrepancies in Existing Code

The existing route code references models that **do not match** `prisma/schema.prisma`. New code must use the correct accessors below.

| Old Code Uses | Correct Prisma Accessor | Note |
|---|---|---|
| `prisma.aIImportSession` | `prisma.importSession` | Model name is `ImportSession` |
| `prisma.transactionCategoryOverride` | `prisma.merchantCategoryMap` | Unique: `@@unique([userId, description])` |
| `prisma.expense` | Does not exist | Use `prisma.expenseLedger` + `prisma.monthlyExpenseSummary` |
| `prisma.expenseEntry` | Does not exist | Use `prisma.monthlyExpenseSummary` directly |
| `prisma.aIUsageLog` | ✅ Correct | Prisma lowercases first char of `AI` → `aI` |
| `prisma.importImage` | ✅ Correct | |

### Do NOT call `mapExpenseData()` from new routes
`expense-mapper.service.ts` uses the wrong model names above. New routes write to `expenseLedger` and `monthlyExpenseSummary` directly using the patterns in §A4.

---

## Phase A — Build

---

### Task A1: Prisma Model + Migration

**File to edit:** `prisma/schema.prisma`  
**After:** `MerchantCategoryMap` model  

#### New enums (add before the Transaction model)

```prisma
enum TransactionTypeEnum {
  DEBIT
  CREDIT
}

enum TransactionSourceEnum {
  LLM_CLASSIFIED
  USER_OVERRIDE
}

enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
}
```

#### New model

```prisma
model Transaction {
  id              String                  @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                 @db.Money
  type            TransactionTypeEnum
  category        String
  source          TransactionSourceEnum
  status          TransactionStatusEnum   @default(PENDING)
  confirmedAt     DateTime?

  bankAccount     BankAccount?            @relation(fields: [bankAccountId], references: [id])
  bankAccountId   String?
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

#### Back-references (add to existing models)

```prisma
// model User — add after existing relations:
transactions  Transaction[]

// model BankAccount — add after existing relations:
transactions  Transaction[]

// model ImportSession — add after existing relations:
transactions  Transaction[]
```

#### Migration command

```bash
pnpm prisma migrate dev --name add_transaction_model
```

> ⚠️ Stop the dev server before running Prisma commands (prevents EPERM on Windows).

---

### Task A2: csv-parser.service.ts — Add DEBIT/CREDIT type

**File:** `src/server/services/ai-import/csv-parser.service.ts`  
**Why:** Currently strips amount sign (stores positive absolute). The `DEBIT`/`CREDIT` type is lost. This is a prerequisite for all CSV classification and confirm tasks.

#### Change to `CsvTransaction` type in `src/server/services/ai-import/_types.ts`

```typescript
// BEFORE:
export interface CsvTransaction {
  date: string;
  amount: number;
  description: string;
  month: number;
  year: number;
}

// AFTER — add type field:
export interface CsvTransaction {
  date: string;
  amount: number;         // always positive absolute value
  type: 'DEBIT' | 'CREDIT';  // ← NEW
  description: string;
  month: number;
  year: number;
}
```

#### Change to `parseCommBankCsv()` in `csv-parser.service.ts`

When building each `CsvTransaction`, derive `type` from the raw CSV amount before making it absolute:

```typescript
// Raw amount from CSV (CommBank format: negative = debit, positive = credit)
const rawAmount = parseFloat(rawAmountStr);
const type: 'DEBIT' | 'CREDIT' = rawAmount < 0 ? 'DEBIT' : 'CREDIT';
const amount = Math.abs(rawAmount);

// Then construct:
const tx: CsvTransaction = { date, amount, type, description, month, year };
```

#### Downstream consumers to update

After changing `CsvTransaction`, check and update all usages of `CsvTransaction` that may break from the new `type` field. The field is additive but TypeScript will require it to be set in any place that constructs a `CsvTransaction` manually.

---

### Task A3: csv-classifier.service.ts — Add credit classification

**File:** `src/server/services/ai-import/csv-classifier.service.ts`

Add a new exported function `classifyCreditTransactions()`. Do NOT modify `classifyTransactions()` — it must remain backward compatible for the old CSV wizard during Phase A/B.

```typescript
import { IncomeSourceEnumType } from '@prisma/client';

// Valid credit classification labels
const CREDIT_LABELS = [
  ...Object.values(IncomeSourceEnumType),  // EMPLOYMENT, STOCKS, BONDS, RENTAL, BUSINESS, FREELANCE, OTHER
  'Transfer',
  'Excluded',
];

export async function classifyCreditTransactions(
  transactions: CsvTransaction[],  // all type === 'CREDIT'
): Promise<ClassifiedCreditTransaction[]>
```

**LLM prompt contract:**  
Send the list of credit transactions with descriptions and amounts. Ask the LLM to assign each one an `IncomeSourceEnumType` value, `"Transfer"`, or `"Excluded"`. Return structured JSON matching `ClassifiedCreditTransaction[]`.

**Return type** (`ClassifiedCreditTransaction` — defined in `_types.ts`):
```typescript
export interface ClassifiedCreditTransaction {
  id: string;
  description: string;
  amount: number;        // positive absolute value
  date: string;
  llmCategory: string;   // one of CREDIT_LABELS
  confirmedCategory: string;  // same as llmCategory initially
  overridden: boolean;   // false initially
  type: 'CREDIT';
}
```

---

### Task A4: csv-confirm.service.ts (New Service)

**File:** `src/server/services/transactions/csv-confirm.service.ts`  
**Also create:** `src/server/services/transactions/_types.ts`

#### `_types.ts`

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

#### `ClassifiedTransactionV2` — add to `src/server/services/ai-import/_types.ts`

```typescript
export interface ClassifiedTransactionV2 extends ClassifiedTransaction {
  type: 'DEBIT';
}
```

#### `csv-confirm.service.ts` — expense write pattern

```typescript
// Resolve calendarYearId from month string "YYYY-MM":
const [yearStr, monthStr] = monthKey.split('-');
const year = parseInt(yearStr);
const month = parseInt(monthStr);

const calendarYear = await prisma.calendarYear.findFirst({
  where: {
    type: 'FISCAL',
    OR: [
      { fromYear: year, fromMonth: { lte: month } },
      { toYear: year, toMonth: { gte: month } },
    ],
  },
});
if (!calendarYear) throw new Error(`No fiscal year found for ${monthKey}`);

// Ensure ExpenseLedger exists:
let ledger = await prisma.expenseLedger.findUnique({
  where: { calendarId_userId: { calendarId: calendarYear.id, userId } },
});
if (!ledger) {
  ledger = await prisma.expenseLedger.create({
    data: { calendarId: calendarYear.id, userId },
  });
}

// Upsert MonthlyExpenseSummary (aggregate per category per month):
const existing = await prisma.monthlyExpenseSummary.findFirst({
  where: { expenseLedgerId: ledger.id, categoryId, month },
});
if (existing) {
  await prisma.monthlyExpenseSummary.update({
    where: { id: existing.id },
    data: { amount: { increment: amount } },
  });
} else {
  await prisma.monthlyExpenseSummary.create({
    data: { month, amount, categoryId, expenseLedgerId: ledger.id },
  });
}

// Create Transaction audit record:
await prisma.transaction.create({
  data: {
    date: new Date(tx.date),
    description: tx.description,
    amount: tx.amount,
    type: 'DEBIT',
    category: tx.confirmedCategory,
    source: tx.overridden ? 'USER_OVERRIDE' : 'LLM_CLASSIFIED',
    status: 'CONFIRMED',
    confirmedAt: new Date(),
    userId,
    bankAccountId,
    importSessionId,
  },
});
```

#### `csv-confirm.service.ts` — income write pattern

```typescript
// Ensure IncomeLedger exists:
let incomeLedger = await prisma.incomeLedger.findUnique({
  where: { calendarId_userId: { calendarId: calendarYear.id, userId } },
});
if (!incomeLedger) {
  incomeLedger = await prisma.incomeLedger.create({
    data: { calendarId: calendarYear.id, userId },
  });
}

// Create IncomeRecord:
await prisma.incomeRecord.create({
  data: {
    dateEarned: new Date(tx.date),
    amount: String(tx.amount),
    source: tx.confirmedCategory as IncomeSourceEnumType,
    incomeLedgerId: incomeLedger.id,
  },
});

// Create Transaction audit record:
await prisma.transaction.create({
  data: {
    date: new Date(tx.date),
    description: tx.description,
    amount: tx.amount,
    type: 'CREDIT',
    category: tx.confirmedCategory,
    source: tx.overridden ? 'USER_OVERRIDE' : 'LLM_CLASSIFIED',
    status: 'CONFIRMED',
    confirmedAt: new Date(),
    userId,
    bankAccountId,
    importSessionId,
  },
});
```

#### Excluded credit pattern

```typescript
// For credits where confirmedCategory === 'Transfer' || 'Excluded':
await prisma.transaction.create({
  data: {
    ...baseFields,
    type: 'CREDIT',
    status: 'EXCLUDED',
    confirmedAt: new Date(),
  },
});
// NO MonthlyExpenseSummary or IncomeRecord written.
```

#### Exported functions

```typescript
export async function confirmDebitTransactions(
  debitMonths: DebitMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult>

export async function confirmCreditTransactions(
  creditMonths: CreditMonth[],
  userId: string,
  bankAccountId: string,
  importSessionId: string,
): Promise<TransactionSaveResult>
```

---

### Task A5: 3 CSV API Routes

#### Auth + import pattern (copy to all 3 routes)

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
```

#### SSE response pattern (copy to classify route)

```typescript
const encoder = new TextEncoder();
const stream = new ReadableStream({
  async start(controller) {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ... })}\n\n`));
      controller.close();
    } catch (err) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`));
      controller.close();
    }
  },
});
return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
});
```

---

#### A5.1 `POST /api/transactions/csv/upload`

**File:** `src/app/api/transactions/csv/upload/route.ts`  
**Source:** Copy from `src/app/api/csv-import/upload/route.ts`; apply changes below.

**Request:** `multipart/form-data` — `file: File` + `bankAccountId: string`

**Changes from source:**
1. Parse `bankAccountId = formData.get('bankAccountId') as string`
2. Validate: non-empty string; verify `prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId } })`
3. Return `404` if account not found
4. Use `prisma.importSession.create` (NOT `prisma.aIImportSession`)
5. Store `bankAccountId` in `metadata`
6. Include `bankAccountId` and `bankAccountName` in success response

**Success response `200`:**
```typescript
{
  fileId: string;           // importSession.id
  fileName: string;
  fileSize: number;
  rowCount: number;
  bankAccountId: string;
  bankAccountName: string;
  transactions: CsvTransaction[];
}
```

---

#### A5.2 `POST /api/transactions/csv/classify` (SSE)

**File:** `src/app/api/transactions/csv/classify/route.ts`  
**Source:** Copy from `src/app/api/csv-import/classify/route.ts`; apply changes below.

**Request body:**
```typescript
{ fileId: string; calendarId: string; }
```

**Changes from source:**
1. Use `prisma.importSession.findUnique` (not `prisma.aIImportSession`)
2. After loading transactions from metadata, split:
   ```typescript
   const debits = transactions.filter(tx => tx.type === 'DEBIT');
   const credits = transactions.filter(tx => tx.type === 'CREDIT');
   ```
3. Classify debits per-month with existing `classifyTransactions()`
4. Classify credits per-month with new `classifyCreditTransactions()` from Task A3
5. Emit `debit_classified` events (same shape as existing `classified` event)
6. Emit `credit_classified` events (new)
7. In `done` event, add `incomeSourceLabels: string[]` to payload

**SSE events emitted:**
```typescript
{ type: 'debit_classified'; month: string; transactions: ClassifiedTransactionV2[]; usage: LlmUsage }
{ type: 'credit_classified'; month: string; transactions: ClassifiedCreditTransaction[]; usage: LlmUsage }
{ type: 'progress'; month: string; processed: number; total: number }
{ type: 'warning'; month: string; message: string }
{ type: 'done'; totalLlmTokens: number; model: string; categories: Array<{ id: string; name: string }>; incomeSourceLabels: string[] }
{ type: 'error'; message: string }
```

---

#### A5.3 `POST /api/transactions/csv/confirm`

**File:** `src/app/api/transactions/csv/confirm/route.ts`

**Request body:**
```typescript
{
  fileId: string;
  llmUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  debitMonths: DebitMonth[];
  creditMonths: CreditMonth[];
}
```

**Validation Zod schema:**
```typescript
const ConfirmRequestSchema = z.object({
  fileId: z.string().min(1),
  llmUsage: z.object({
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
  }),
  debitMonths: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    transactions: z.array(z.any()),
  })),
  creditMonths: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    transactions: z.array(z.any()),
  })),
});
```

**Processing:**
1. Load `importSession` — check ownership + extract `bankAccountId` from metadata
2. Call `confirmDebitTransactions()` from Task A4
3. Call `confirmCreditTransactions()` from Task A4
4. Log LLM usage: `prisma.aIUsageLog.create(...)` if `totalTokens > 0`
5. Update `importSession.status` = `COMPLETED | PARTIAL | FAILED`

**Success response `200`:**
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

### Task A6: 3 AI API Routes

#### A6.1 `POST /api/transactions/ai/upload`

**File:** `src/app/api/transactions/ai/upload/route.ts`  
**Source:** Copy from `src/app/api/ai-import/upload/route.ts`  

**Changes:**
1. Parse optional `bankAccountId = formData.get('bankAccountId') as string | null`
2. If provided, verify it belongs to `userId`
3. Store `bankAccountId` in `ImportSession` metadata
4. Echo `bankAccountId` in response

---

#### A6.2 `POST /api/transactions/ai/parse` (SSE)

**File:** `src/app/api/transactions/ai/parse/route.ts`  
**Source:** Copy from `src/app/api/ai-import/parse/route.ts`  

**Key change:** Do NOT write to `MonthlyExpenseSummary` during parse. Only extract.

**Request body:**
```typescript
{
  imageIds: string[];
  importType: 'EXPENSE';
  bankAccountId?: string;
  context: { calendarYearId: string; month: number; };
}
```

**SSE events (changed):**
```typescript
{ type: 'progress'; imageIndex: number; totalImages: number; currentImage: string }
// CHANGED: emit 'extracted' not 'saved'
{ type: 'extracted'; imageId: string; confidence: number; entries: Array<{ categoryName: string; amount: number }> }
{ type: 'error'; imageId: string; errorMessage: string }
{ type: 'complete'; sessionId: string; images: ExtractedImageResult[] }
// NO 'saved' event
```

**After all images processed:** Set `ImportSession.status = 'PROCESSING'` (not `COMPLETED`).

---

#### A6.3 `POST /api/transactions/ai/confirm`

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
    entries: Array<{ categoryName: string; amount: number; confirmed: boolean; }>;
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

**Processing (for each `confirmed === true` entry):**
1. `matchCategoryWithEmbedding(categoryName)` from `category-matcher.service.ts`
2. Upsert `MonthlyExpenseSummary` (see prerequisite patterns above)
3. Create `Transaction(type: 'DEBIT', status: 'CONFIRMED', bankAccountId: nullable)`
4. Update `ImportSession.status = 'COMPLETED'`

**Success response `200`:**
```typescript
{ success: boolean; recordsCreated: number; sessionId: string; status: 'COMPLETED' | 'PARTIAL' | 'FAILED'; }
```

---

### Task A7: Page + Layout (Server Components)

#### `src/app/(authorized)/cashflow/transactions/layout.tsx`

```typescript
export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

#### `src/app/(authorized)/cashflow/transactions/page.tsx`

```typescript
import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db/client';
import TransactionsClient from './_components/TransactionsClient';

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
    include: { bank: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const accounts = bankAccounts.map((a) => ({
    id: a.id,
    name: a.accountName,        // verify field name in schema
    bankName: a.bank?.name ?? 'Unknown Bank',
  }));

  return <TransactionsClient bankAccounts={accounts} />;
}
```

#### `TransactionsClient.tsx` (Client Component wrapper)

```typescript
'use client';

import { useState } from 'react';
import CSVImportWizard from './_components/csv/CSVImportWizard';
import AIImportWizard from './_components/ai/AIImportWizard';

interface Props {
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
}

export default function TransactionsClient({ bankAccounts }: Props) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-6'>
      <h1 className='text-2xl font-semibold text-gray-900'>Transactions</h1>
      <p className='mt-1 text-sm text-gray-500'>Import and manage your bank transactions</p>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mt-8'>
        <ImportCard
          title='CSV Bank Statement'
          description='Import transactions from a CommBank CSV statement'
          icon='FileSpreadsheet'
          onClick={() => setCsvOpen(true)}
        />
        <ImportCard
          title='AI Receipt / Invoice'
          description='Extract expense data from receipt or invoice images'
          icon='ScanLine'
          onClick={() => setAiOpen(true)}
        />
      </div>

      <CSVImportWizard
        isOpen={csvOpen}
        onClose={() => setCsvOpen(false)}
        bankAccounts={bankAccounts}
      />
      <AIImportWizard
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        bankAccounts={bankAccounts}
      />
    </main>
  );
}
```

> **ImportCard** is a small presentational component — `title`, `description`, `icon` (lucide name string), `onClick`. Create inline in `TransactionsClient.tsx` or as a separate file.

---

### Task A8: CSV Wizard Components

All files live under `src/app/(authorized)/cashflow/transactions/_components/csv/`.

**Step 1 of implementation: copy source files, then apply diffs below.**

Source → destination mapping:
```
expense/_components/csv-import/CSVImportWizard.tsx   → csv/CSVImportWizard.tsx
expense/_components/csv-import/CSVUploadStep.tsx      → csv/CSVUploadStep.tsx
expense/_components/csv-import/CSVClassifyingStep.tsx → csv/CSVClassifyingStep.tsx
expense/_components/csv-import/CSVResultsStep.tsx     → csv/CSVResultsStep.tsx
expense/_components/csv-import/_types.ts              → csv/_types.ts
```

#### `CSVImportWizard.tsx` — diffs

```typescript
// REMOVE prop: calendarYearId
// ADD state:
const [bankAccountId, setBankAccountId] = useState<string | null>(null);
const [classifiedDebitMonths, setClassifiedDebitMonths] = useState<ClassifiedMonth[]>([]);
const [classifiedCreditMonths, setClassifiedCreditMonths] = useState<ClassifiedCreditMonth[]>([]);
const [incomeSourceLabels, setIncomeSourceLabels] = useState<string[]>([]);

// ADD prop to wizard interface:
bankAccounts: Array<{ id: string; name: string; bankName: string }>;

// UPDATE fetch targets:
// upload:   /api/transactions/csv/upload
// classify: /api/transactions/csv/classify
// confirm:  /api/transactions/csv/confirm
```

#### `CSVUploadStep.tsx` — diffs

Add bank account selector **above** the file dropzone:
```tsx
<div className='space-y-2 mb-6'>
  <label className='text-sm font-medium text-gray-700'>Bank Account <span className='text-red-500'>*</span></label>
  <select
    value={selectedBankAccountId ?? ''}
    onChange={(e) => onBankAccountChange(e.target.value)}
    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
    required
  >
    <option value=''>Select a bank account</option>
    {bankAccounts.map((acc) => (
      <option key={acc.id} value={acc.id}>{acc.bankName} — {acc.name}</option>
    ))}
  </select>
</div>
```

Disable "Import CSV" button when `!selectedBankAccountId || !file`.

#### `CSVClassifyingStep.tsx` — diffs

Update SSE handler to handle `credit_classified` event:
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

Update POST target to `/api/transactions/csv/classify`.

#### `CSVTransactionReviewTable.tsx` — NEW component

```typescript
interface CSVTransactionReviewTableProps {
  debitMonths: ClassifiedMonth[];
  creditMonths: ClassifiedCreditMonth[];
  categories: Array<{ id: string; name: string }>;
  incomeSourceLabels: string[];
  llmModel: string;
  onConfirm: (debitMonths: ClassifiedMonth[], creditMonths: ClassifiedCreditMonth[]) => Promise<void>;
  isConfirming: boolean;
}
```

**UI structure:**
```tsx
<div>
  {/* Tab bar */}
  <div className='flex border-b mb-4 gap-4'>
    <button
      className={activeTab === 'debits' ? 'border-b-2 border-teal-500 pb-2 font-medium' : 'pb-2 text-gray-500'}
      onClick={() => setActiveTab('debits')}
    >
      Expenses ({totalDebitCount})
    </button>
    <button
      className={activeTab === 'credits' ? 'border-b-2 border-teal-500 pb-2 font-medium' : 'pb-2 text-gray-500'}
      onClick={() => setActiveTab('credits')}
    >
      Income / Credits ({totalCreditCount})
      {excludedCount > 0 && <span className='ml-2 text-xs text-gray-400'>{excludedCount} excluded</span>}
    </button>
  </div>

  {/* Debit tab: reuse existing component */}
  {activeTab === 'debits' && (
    <TransactionReviewTable months={localDebitMonths} categories={categories} onUpdateMonths={setLocalDebitMonths} />
  )}

  {/* Credit tab: inline CreditReviewPanel */}
  {activeTab === 'credits' && (
    <CreditReviewPanel months={localCreditMonths} incomeSourceLabels={incomeSourceLabels} onUpdate={setLocalCreditMonths} />
  )}

  <div className='border-t pt-4 flex justify-end'>
    <button
      onClick={handleConfirmAll}
      disabled={isConfirming}
      className='px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50'
    >
      {isConfirming ? 'Saving…' : 'Confirm & Import All'}
    </button>
  </div>
</div>
```

**`CreditReviewPanel` table columns:**
- Date | Description | Amount | LLM Suggested | Your Classification (dropdown from `incomeSourceLabels`)
- Row highlight: `amber` if `overridden === true`; `line-through text-gray-400` if category is `"Excluded"`

#### `_types.ts`

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
  bankAccountId: string;
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

export { ClassifiedTransactionV2, ClassifiedCreditTransaction, ClassifiedCreditMonth, ClassifiedMonth };
```

---

### Task A9: AI Wizard Components

All files under `src/app/(authorized)/cashflow/transactions/_components/ai/`.

Source → destination:
```
expense/_components/ai-import/AIImportWizard.tsx    → ai/AIImportWizard.tsx
expense/_components/ai-import/UploadStep.tsx         → ai/UploadStep.tsx
expense/_components/ai-import/ProcessingStep.tsx     → ai/ProcessingStep.tsx
expense/_components/ai-import/ResultsStep.tsx        → ai/ResultsStep.tsx
expense/_components/ai-import/ConfidenceBadge.tsx    → ai/ConfidenceBadge.tsx  (verbatim)
expense/_components/ai-import/_types.ts              → ai/_types.ts
expense/_components/ai-import/_schema.ts             → ai/_schema.ts
```

#### `AIImportWizard.tsx` — diffs

```typescript
// REMOVE prop: calendarYearId
// ADD props:
bankAccounts: Array<{ id: string; name: string; bankName: string }>;

// ADD state:
const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
const [extractedImages, setExtractedImages] = useState<ExtractedImageResult[]>([]);
const [sessionId, setSessionId] = useState<string | null>(null);

// UPDATE step sequence:
type WizardStep = 'upload' | 'processing' | 'review' | 'results';
// (add 'review' between 'processing' and 'results')
```

#### `UploadStep.tsx` — diffs

1. Remove `context.month` display banner
2. Add optional bank account selector above upload zone:
```tsx
<div className='mb-4'>
  <label className='block text-sm font-medium text-gray-700 mb-1'>
    Bank Account <span className='text-gray-400 text-xs'>(optional)</span>
  </label>
  <select value={selectedBankAccountId ?? ''} onChange={(e) => onBankAccountChange(e.target.value || null)}
    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm'>
    <option value=''>Unknown / Not applicable</option>
    {bankAccounts.map((acc) => (
      <option key={acc.id} value={acc.id}>{acc.bankName} — {acc.name}</option>
    ))}
  </select>
</div>
```
3. Allow "Start Import" with `files.length > 0` even if no bank account selected.

#### `ProcessingStep.tsx` — diffs

1. POST to `/api/transactions/ai/upload` (with optional `bankAccountId` in formData)
2. POST to `/api/transactions/ai/parse`
3. Handle `extracted` SSE event (not `saved`):
   ```typescript
   case 'extracted':
     setExtractedImages(prev => [...prev, { imageId: event.imageId, confidence: event.confidence, entries: event.entries, status: 'success' }]);
     break;
   case 'complete':
     onComplete(event.sessionId, extractedImages);  // go to review step
     break;
   ```
4. On `complete`: call `onComplete(sessionId, extractedImages)` — NOT `onComplete(importSessionResult)`

#### `ReviewStep.tsx` — NEW

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

**UI:** For each image, show `ConfidenceBadge` + table of entries:
| `[✓]` checkbox | Category (dropdown from `categories`) | Amount (editable `<input type="number">`) |

"Confirm & Save" button POSTs to `/api/transactions/ai/confirm`.

#### `_types.ts`

```typescript
export interface ExtractedImageResult {
  imageId: string;
  fileName: string;
  confidence: number;
  entries: Array<{ id: string; categoryName: string; amount: number; confirmed: boolean; }>;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export interface AIImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: Array<{ id: string; name: string; bankName: string }>;
  onImportComplete?: () => void;
}

export interface ReviewStepProps { ... }  // see above

export interface AIImportSessionResult {
  sessionId: string;
  recordsCreated: number;
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
}

export type WizardStep = 'upload' | 'processing' | 'review' | 'results';
```

---

## Phase B — Navigation

### Task B1: SideNav.tsx

**File:** `src/layouts/SideNav.tsx`

**Change 1** — add to `lucide-react` import:
```typescript
ArrowLeftRight,
```

**Change 2** — update `cashflowItems` array:
```typescript
const cashflowItems: NavItem[] = [
  { name: 'Income', href: '/cashflow/income', icon: DollarSign },
  { name: 'Donations', href: '/cashflow/donations', icon: Gift },
  { name: 'Expenses', href: '/cashflow/expense', icon: Receipt },
  { name: 'Transactions', href: '/cashflow/transactions', icon: ArrowLeftRight },  // ← ADD
  { name: 'Bank Interest', href: '/cashflow/bank-interest', icon: Percent },
];
```

**Change 3** — add to `defaultOpen` condition for the CashFlow nav group:
```typescript
pathname.startsWith('/cashflow/transactions') ||
```

---

## Phase C — Expense Page Migration

> ⚠️ Do this **after** Phase A and B are fully tested.

### Task C1: ExpenseTableClient.tsx cleanup

**File:** `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx`

1. Remove `AIImportWizard` import + its state variables + its render block
2. Remove `CSVImportWizard` import + its state variables + its render block  
3. Remove the import buttons from the toolbar
4. Add redirect link in place of buttons:
   ```tsx
   import Link from 'next/link';
   import { ArrowRight } from 'lucide-react';
   
   // Replace import buttons with:
   <Link
     href='/cashflow/transactions'
     className='inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm text-white hover:bg-teal-700'
   >
     <ArrowRight className='h-4 w-4' />
     Import transactions
   </Link>
   ```

### Task C2: Delete old component directories

After C1 is confirmed working:
```
Delete: src/app/(authorized)/cashflow/expense/_components/csv-import/  (entire directory)
Delete: src/app/(authorized)/cashflow/expense/_components/ai-import/   (entire directory)
```

---

## Phase D — Old API Route Retirement

> ⚠️ Do this **after Phase C is stable** in production.

### Task D1: Add 410 Gone responses (grace period)

Before deleting, update each old route to return:
```typescript
return NextResponse.json({ error: 'This endpoint has moved. Use /api/transactions/' }, { status: 410 });
```

Routes to update:
- `src/app/api/csv-import/upload/route.ts`
- `src/app/api/csv-import/classify/route.ts`
- `src/app/api/csv-import/parse/route.ts`
- `src/app/api/csv-import/confirm/route.ts`
- `src/app/api/ai-import/upload/route.ts`
- `src/app/api/ai-import/parse/route.ts`

### Task D2: Delete old routes (after grace period)

```
Delete: src/app/api/csv-import/     (entire directory)
Delete: src/app/api/ai-import/upload/route.ts
Delete: src/app/api/ai-import/parse/route.ts
```

> Note: `src/app/api/ai-import/confirm/route.ts` may still be needed if the old AI wizard is still referenced anywhere — verify before deleting.

---

## Appendix — Shared Code Locations

| What you need | Where it lives | Import |
|---|---|---|
| `classifyTransactions()` | `src/server/services/ai-import/csv-classifier.service.ts` | `@/server/services/ai-import/csv-classifier.service` |
| `matchCategoryWithEmbedding()` | `src/server/services/ai-import/category-matcher.service.ts` | `@/server/services/ai-import/category-matcher.service` |
| `parseCommBankCsv()` | `src/server/services/ai-import/csv-parser.service.ts` | `@/server/services/ai-import/csv-parser.service` |
| `extractExpenseData()` | `src/server/services/ai-import/ai-vision.service.ts` | `@/server/services/ai-import/ai-vision.service` |
| `getStorageAdapter()` | `src/server/services/ai-import/image-storage.adapter.ts` | `@/server/services/ai-import/image-storage.adapter` |
| `deleteExpiredImages()` | `src/server/services/ai-import/cleanup.service.ts` | `@/server/services/ai-import/cleanup.service` |
| `TransactionReviewTable` | `src/components/csv-import/TransactionReviewTable.tsx` | `@/components/csv-import/TransactionReviewTable` |
| `ALLOWED_CSV_MIME_TYPES`, `MAX_CSV_FILE_SIZE`, `MAX_CSV_ROWS` | `src/server/services/ai-import/validation.ts` | `@/server/services/ai-import/validation` |
| `prisma` client | `src/server/db/client.ts` | `@/server/db/client` |
| `auth()` | `src/server/auth.ts` | `@/server/auth` |
