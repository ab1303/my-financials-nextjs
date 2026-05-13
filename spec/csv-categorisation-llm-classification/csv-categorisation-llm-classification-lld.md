# CSV Transaction Categorisation — LLM Classification & Review
## Low Level Design (LLD)

**Location:** `spec/csv-categorisation-llm-classification/csv-categorisation-llm-classification-lld.md`
**Date:** 2026-05-13
**Parent:** [csv-categorisation-llm-classification-hld.md](./csv-categorisation-llm-classification-hld.md)
**Spec:** [csv-categorisation-llm-classification.md](./csv-categorisation-llm-classification.md)
**Scope:** Phase 1 (LLM classifier service) + Phase 1.5 (classify route, confirm route, Review UI, Prisma model)

---

## Table of Contents

1. [Type Additions](#1-type-additions)
2. [Prisma Schema Addition](#2-prisma-schema-addition)
3. [LLM Classifier Service](#3-llm-classifier-service)
4. [Classify Route (SSE)](#4-classify-route-sse)
5. [Confirm Route (POST)](#5-confirm-route-post)
6. [Zod Schema Additions](#6-zod-schema-additions)
7. [TransactionReviewTable Component](#7-transactionreviewtable-component)
8. [CSV Import Page Update](#8-csv-import-page-update)
9. [Error Handling Matrix](#9-error-handling-matrix)
10. [Testing Notes](#10-testing-notes)

---

## 1. Type Additions

**File:** `src/server/services/ai-import/_types.ts`

Append to the existing file:

```typescript
/**
 * A single transaction after LLM classification.
 * Holds both the LLM suggestion and the user's final confirmed category.
 * Sent from the classify SSE route to the client; returned in ConfirmImportRequest.
 */
export interface ClassifiedTransaction {
  /** Stable client-side key; generated server-side via crypto.randomUUID() */
  id: string;
  /** Original bank description string from CsvTransaction */
  description: string;
  /** Positive absolute amount */
  amount: number;
  /** ISO date string, e.g. "2025-07-29" */
  date: string;
  /** Category name returned by LLM */
  llmCategory: string;
  /**
   * Category name the user will confirm.
   * Initialised to llmCategory; updated if user overrides in Review UI.
   */
  confirmedCategory: string;
  /** true if user changed confirmedCategory away from llmCategory */
  overridden: boolean;
}

/**
 * Request body for POST /api/csv-import/confirm.
 * Carries all user-confirmed classifications for one full CSV import.
 */
export interface ConfirmImportRequest {
  /** AIImportSession.id from the original upload */
  fileId: string;
  /** Target CalendarYear.id for expense creation */
  calendarYearId: string;
  /** LLM token usage from the classify step, for AIUsageLog */
  llmUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  months: {
    /** "YYYY-MM" e.g. "2025-07" */
    month: string;
    transactions: ClassifiedTransaction[];
  }[];
}
```

---

## 2. Prisma Schema Addition

**File:** `prisma/schema.prisma`

Add after the existing `AIUsageLog` model:

```prisma
model TransactionCategoryOverride {
  id          String   @id @default(cuid())
  userId      String
  /// Normalised description: description.toLowerCase().trim()
  description String
  /// Confirmed category name, e.g. "Sport & Fitness"
  category    String
  /// "llm_confirmed" | "user_override"
  source      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, description])
  @@index([userId])
}
```

Add the reverse relation to the `User` model:

```prisma
// In model User { ... }
transactionCategoryOverrides TransactionCategoryOverride[]
```

**Migration command** (run after stopping dev server):
```bash
pnpm prisma migrate dev --name add-transaction-category-override
```

---

## 3. LLM Classifier Service

**File:** `src/server/services/ai-import/csv-classifier.service.ts`

### 3.1 Imports

```typescript
import { generateText } from 'ai';
import { getAIProvider } from './ai-provider';  // existing factory, same as ai-vision.service.ts
import type { CsvTransaction, ClassifiedTransaction } from './_types';
import type { ExpenseCategory } from '@prisma/client';
```

### 3.2 Public API

```typescript
/**
 * Classify a batch of CSV transactions into user-defined expense categories.
 * Makes a single LLM call for the entire batch.
 *
 * @param transactions  CsvTransaction[] for one calendar month
 * @param categories    Active ExpenseCategory[] from Prisma
 * @returns             ClassifiedTransaction[] ready for Review UI
 */
export async function classifyTransactions(
  transactions: CsvTransaction[],
  categories: ExpenseCategory[],
): Promise<{
  classified: ClassifiedTransaction[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}>
```

### 3.3 System Prompt Builder

```typescript
function buildSystemPrompt(categories: ExpenseCategory[]): string {
  const categoryList = categories.map((c) => `- ${c.name}`).join('\n');

  return `You are a financial transaction classifier for an Australian personal finance app.

Your task: classify each bank transaction description into exactly one of the following expense categories.

Available categories:
${categoryList}

Rules:
- Respond ONLY with a JSON array. No other text, no markdown, no explanation.
- Use ONLY the exact category names listed above.
- If genuinely uncertain, use the closest match — never return null or "Other".
- One object per transaction, preserving input order.

Common Australian merchant mappings:
- Woolworths, Coles, Aldi, IGA, Harris Farm → Groceries
- Netflix, Spotify, Disney+, Stan, Apple TV → Entertainment
- DEFT PAYMENTS, strata levy, Body Corp → Home
- Chemist Warehouse, Priceline, medical centres, pathology → Health & Medical
- Transport NSW, Opal, toll roads, petrol stations → Vehicle & Transport
- Uber Eats, DoorDash, restaurants, cafes → Eating out & takeaway`;
}
```

### 3.4 User Prompt Builder

```typescript
function buildUserPrompt(transactions: CsvTransaction[]): string {
  const lines = transactions
    .map((tx, i) => `${i + 1}. ${tx.description}`)
    .join('\n');

  return `Classify each of the following Australian bank transaction descriptions.
Return a JSON array with one object per transaction in this exact format:
[{"description": "<original description>", "category": "<category name>"}]

Transactions:
${lines}`;
}
```

### 3.5 Main Function Implementation

```typescript
export async function classifyTransactions(
  transactions: CsvTransaction[],
  categories: ExpenseCategory[],
): Promise<{
  classified: ClassifiedTransaction[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const zeroUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  if (transactions.length === 0) {
    return { classified: [], usage: zeroUsage };
  }

  try {
    const provider = getAIProvider();
    const { text, usage } = await generateText({
      model: provider,
      system: buildSystemPrompt(categories),
      prompt: buildUserPrompt(transactions),
    });

    // Extract JSON array from response (handles leading/trailing prose)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('LLM response contained no JSON array');

    const parsed = JSON.parse(jsonMatch[0]) as { description: string; category: string }[];

    const classified: ClassifiedTransaction[] = transactions.map((tx, idx) => {
      const llmCategory = parsed[idx]?.category ?? tx.description;
      return {
        id: crypto.randomUUID(),
        description: tx.description,
        amount: tx.amount,
        date: tx.date,
        llmCategory,
        confirmedCategory: llmCategory,
        overridden: false,
      };
    });

    return {
      classified,
      usage: {
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
      },
    };
  } catch (error) {
    // Graceful fallback: use raw description as category
    // matchCategoryWithEmbedding() will return lowest-confidence match
    const classified: ClassifiedTransaction[] = transactions.map((tx) => ({
      id: crypto.randomUUID(),
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      llmCategory: tx.description,
      confirmedCategory: tx.description,
      overridden: false,
    }));

    return { classified, usage: zeroUsage };
  }
}
```

---

## 4. Classify Route (SSE)

**File:** `src/app/api/csv-import/classify/route.ts`

### 4.1 Imports

```typescript
import { NextRequest } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { classifyTransactions } from '@/server/services/ai-import/csv-classifier.service';
import type { CsvTransaction } from '@/server/services/ai-import/_types';
import { ClassifyRequestSchema } from '@/server/services/ai-import/validation';
```

### 4.2 SSE Event Types

```typescript
type SseEvent =
  | { type: 'progress'; month: string; processed: number; total: number }
  | { type: 'classified'; month: string; transactions: ClassifiedTransaction[]; usage: TokenUsage }
  | { type: 'warning'; message: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

function emit(controller: ReadableStreamDefaultController, event: SseEvent): void {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}
```

### 4.3 Route Handler

```typescript
export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await request.json();
  const parsed = ClassifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
  }

  const { fileId, calendarId } = parsed.data;

  const importSession = await prisma.aIImportSession.findUnique({ where: { id: fileId } });
  if (!importSession) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
  }
  if (importSession.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const categories = await prisma.expenseCategory.findMany({
    where: { userId: session.user.id, isActive: true },
  });

  // Group transactions by month from session metadata
  const transactions = (importSession.metadata as { transactions: CsvTransaction[] }).transactions;
  const byMonth = new Map<string, CsvTransaction[]>();
  for (const tx of transactions) {
    const key = `${tx.year}-${String(tx.month).padStart(2, '0')}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(tx);
  }
  const monthKeys = [...byMonth.keys()].sort();

  const stream = new ReadableStream({
    async start(controller) {
      let processed = 0;
      const total = monthKeys.length;

      for (const month of monthKeys) {
        const monthTxs = byMonth.get(month)!;
        emit(controller, { type: 'progress', month, processed, total });

        try {
          const { classified, usage } = await classifyTransactions(monthTxs, categories);
          emit(controller, { type: 'classified', month, transactions: classified, usage });
        } catch {
          emit(controller, {
            type: 'warning',
            message: `Classification failed for ${month} — using raw descriptions as fallback`,
          });
          // Emit fallback (raw descriptions)
          const fallback = monthTxs.map((tx) => ({
            id: crypto.randomUUID(),
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            llmCategory: tx.description,
            confirmedCategory: tx.description,
            overridden: false,
          }));
          emit(controller, { type: 'classified', month, transactions: fallback, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } });
        }

        processed++;
      }

      emit(controller, { type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

---

## 5. Confirm Route (POST)

**File:** `src/app/api/csv-import/confirm/route.ts`

### 5.1 Imports

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { prisma } from '@/server/db/client';
import { mapExpenseData } from '@/server/services/ai-import/expense-mapper.service';
import { ConfirmImportRequestSchema } from '@/server/services/ai-import/validation';
import type { ExpenseExtractionResult } from '@/server/services/ai-import/_types';
```

### 5.2 Route Handler

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ConfirmImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { fileId, calendarYearId, llmUsage, months } = parsed.data;

  const importSession = await prisma.aIImportSession.findUnique({ where: { id: fileId } });
  if (!importSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (importSession.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const categories = await prisma.expenseCategory.findMany({
    where: { userId: session.user.id, isActive: true },
  });

  const savedMonths: string[] = [];
  let totalEntries = 0;

  for (const { month, transactions } of months) {
    try {
      // Build ExpenseExtractionResult from confirmed categories
      const result: ExpenseExtractionResult = {
        success: true,
        confidence: 1.0,
        entries: transactions.map((tx) => ({
          categoryName: tx.confirmedCategory,
          amount: tx.amount,
        })),
        warnings: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };

      const monthNumber = parseInt(month.split('-')[1]!, 10);
      const saved = await mapExpenseData(result, calendarYearId, monthNumber, session.user.id, undefined);
      totalEntries += saved?.length ?? 0;
      savedMonths.push(month);

      // Upsert TransactionCategoryOverride for each transaction
      await Promise.all(
        transactions.map((tx) =>
          prisma.transactionCategoryOverride.upsert({
            where: {
              userId_description: {
                userId: session.user.id!,
                description: tx.description.toLowerCase().trim(),
              },
            },
            update: {
              category: tx.confirmedCategory,
              source: tx.overridden ? 'user_override' : 'llm_confirmed',
            },
            create: {
              userId: session.user.id!,
              description: tx.description.toLowerCase().trim(),
              category: tx.confirmedCategory,
              source: tx.overridden ? 'user_override' : 'llm_confirmed',
            },
          }),
        ),
      );
    } catch (error) {
      // Log but continue — partial save
      console.error(`[confirm] Failed to process month ${month}:`, error);
    }
  }

  // Log LLM token usage
  if (llmUsage.totalTokens > 0) {
    await prisma.aIUsageLog.create({
      data: {
        sessionId: fileId,
        model: process.env.AI_VISION_MODEL ?? 'gpt-4o-mini',
        promptTokens: llmUsage.promptTokens,
        completionTokens: llmUsage.completionTokens,
        totalTokens: llmUsage.totalTokens,
        imageId: null,
      },
    });
  }

  // Update session status
  const status = savedMonths.length === months.length ? 'COMPLETED'
    : savedMonths.length > 0 ? 'PARTIAL'
    : 'FAILED';

  await prisma.aIImportSession.update({
    where: { id: fileId },
    data: { status },
  });

  return NextResponse.json({ savedMonths, totalEntries });
}
```

---

## 6. Zod Schema Additions

**File:** `src/server/services/ai-import/validation.ts`

Append:

```typescript
export const ClassifyRequestSchema = z.object({
  fileId: z.string().min(1),
  calendarId: z.string().min(1),
});

const ClassifiedTransactionSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  llmCategory: z.string(),
  confirmedCategory: z.string().min(1),
  overridden: z.boolean(),
});

export const ConfirmImportRequestSchema = z.object({
  fileId: z.string().min(1),
  calendarYearId: z.string().min(1),
  llmUsage: z.object({
    promptTokens: z.number().int().min(0),
    completionTokens: z.number().int().min(0),
    totalTokens: z.number().int().min(0),
  }),
  months: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        transactions: z.array(ClassifiedTransactionSchema).min(1),
      }),
    )
    .min(1),
});
```

---

## 7. TransactionReviewTable Component

**File:** `src/components/csv-import/TransactionReviewTable.tsx`

### 7.1 Props Interface

```typescript
interface TransactionReviewTableProps {
  /** Months returned from classify SSE, in order received */
  months: ClassifiedMonth[];
  /** Active categories for the dropdown */
  categories: ExpenseCategory[];
  /** Called when user clicks "Confirm & Save" */
  onConfirm: (months: ClassifiedMonth[]) => Promise<void>;
  /** Whether confirm is in progress */
  isConfirming: boolean;
}

interface ClassifiedMonth {
  month: string;                       // "2025-07"
  transactions: ClassifiedTransaction[];
  totalUsage: TokenUsage;
}
```

### 7.2 Component Structure

```tsx
'use client';

export default function TransactionReviewTable({
  months,
  categories,
  onConfirm,
  isConfirming,
}: TransactionReviewTableProps) {
  const [localMonths, setLocalMonths] = useState<ClassifiedMonth[]>(months);

  // Update a single transaction's confirmedCategory
  function handleOverride(
    monthIdx: number,
    txIdx: number,
    newCategory: string,
  ) {
    setLocalMonths((prev) =>
      prev.map((m, mi) =>
        mi !== monthIdx ? m : {
          ...m,
          transactions: m.transactions.map((tx, ti) =>
            ti !== txIdx ? tx : {
              ...tx,
              confirmedCategory: newCategory,
              overridden: newCategory !== tx.llmCategory,
            },
          ),
        },
      ),
    );
  }

  // Accept all: reset all confirmedCategory to llmCategory
  function handleAcceptAll() {
    setLocalMonths((prev) =>
      prev.map((m) => ({
        ...m,
        transactions: m.transactions.map((tx) => ({
          ...tx,
          confirmedCategory: tx.llmCategory,
          overridden: false,
        })),
      })),
    );
  }

  const overrideCount = localMonths
    .flatMap((m) => m.transactions)
    .filter((tx) => tx.overridden).length;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-gray-800'>
          Review Classified Transactions
        </h2>
        <div className='flex gap-3'>
          <button onClick={handleAcceptAll} className='...'>
            Accept All
          </button>
          <button
            onClick={() => onConfirm(localMonths)}
            disabled={isConfirming}
            className='...'
          >
            {isConfirming ? 'Saving...' : `Confirm & Save →`}
          </button>
        </div>
      </div>

      {overrideCount > 0 && (
        <p className='text-sm text-amber-600'>
          {overrideCount} override{overrideCount !== 1 ? 's' : ''} applied
        </p>
      )}

      {localMonths.map((m, mi) => (
        <MonthSection
          key={m.month}
          month={m}
          monthIdx={mi}
          categories={categories}
          onOverride={handleOverride}
        />
      ))}
    </div>
  );
}
```

### 7.3 MonthSection Sub-component

```tsx
function MonthSection({ month, monthIdx, categories, onOverride }: MonthSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const unknownCount = month.transactions.filter(
    (tx) => isLikelyUnknownMerchant(tx.description),
  ).length;

  return (
    <div className='rounded-lg border border-gray-200 bg-white shadow-sm'>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className='flex w-full items-center justify-between px-4 py-3'
      >
        <span className='font-medium text-gray-700'>
          {formatMonth(month.month)}
          <span className='ml-2 text-sm text-gray-400'>
            ({month.transactions.length} transactions)
          </span>
        </span>
        {unknownCount > 0 && (
          <span className='text-sm text-amber-600'>
            ⚠ {unknownCount} unknown merchant{unknownCount !== 1 ? 's' : ''}
          </span>
        )}
        <span>{collapsed ? '▶' : '▼'}</span>
      </button>

      {!collapsed && (
        <table className='w-full text-sm'>
          <thead className='bg-gray-50 text-xs text-gray-500 uppercase'>
            <tr>
              <th className='px-4 py-2 text-left'>Description</th>
              <th className='px-4 py-2 text-right'>Amount</th>
              <th className='px-4 py-2 text-left'>Category</th>
              <th className='px-4 py-2'></th>
            </tr>
          </thead>
          <tbody>
            {month.transactions.map((tx, ti) => (
              <tr
                key={tx.id}
                className={tx.overridden ? 'bg-amber-50' : ''}
              >
                <td className='px-4 py-2 text-gray-700'>
                  {isLikelyUnknownMerchant(tx.description) && (
                    <span title='Unknown merchant — please review' className='mr-1 text-amber-500'>⚠</span>
                  )}
                  {tx.description}
                </td>
                <td className='px-4 py-2 text-right text-gray-600'>
                  ${tx.amount.toFixed(2)}
                </td>
                <td className='px-4 py-2'>
                  <select
                    value={tx.confirmedCategory}
                    onChange={(e) => onOverride(monthIdx, ti, e.target.value)}
                    className='rounded border border-gray-300 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className='px-4 py-2 text-xs text-gray-400'>
                  {tx.overridden ? (
                    <span className='text-amber-600'>edited</span>
                  ) : (
                    <span className='text-green-600'>✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### 7.4 Unknown Merchant Heuristic

```typescript
// src/components/csv-import/known-brand-tokens.ts
export const KNOWN_BRAND_TOKENS = new Set([
  'WOOLWORTHS', 'COLES', 'ALDI', 'IGA', 'HARRIS',
  'NETFLIX', 'SPOTIFY', 'DISNEY', 'STAN', 'APPLE',
  'AMAZON', 'UBER', 'DOORDASH', 'MENULOG',
  'CHEMIST', 'PRICELINE',
  'TRANSPORT', 'OPAL',
  'PAYPAL', 'GOOGLE', 'MICROSOFT',
]);

export function isLikelyUnknownMerchant(description: string): boolean {
  const words = description.split(' ').filter(Boolean);
  if (words.length > 4) return false;
  if (description !== description.toUpperCase()) return false;
  return !KNOWN_BRAND_TOKENS.has(words[0]?.toUpperCase() ?? '');
}
```

---

## 8. CSV Import Page Update

**File:** `src/app/(authorized)/cashflow/csv-import/page.tsx` *(or the current import page path)*

The page manages classify SSE streaming and wires up the Review UI. Key state:

```typescript
'use client';

type ImportStage =
  | 'idle'
  | 'uploading'
  | 'classifying'
  | 'review'
  | 'confirming'
  | 'done'
  | 'error';

const [stage, setStage] = useState<ImportStage>('idle');
const [fileId, setFileId] = useState<string | null>(null);
const [classifiedMonths, setClassifiedMonths] = useState<ClassifiedMonth[]>([]);
const [totalUsage, setTotalUsage] = useState<TokenUsage>({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
```

### Classify SSE Consumer

```typescript
async function startClassify(fileId: string, calendarId: string) {
  setStage('classifying');
  const accumulated: ClassifiedMonth[] = [];
  const accUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const response = await fetch('/api/csv-import/classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId, calendarId }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    const lines = text.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const event = JSON.parse(line.slice(6));

      if (event.type === 'classified') {
        accumulated.push({ month: event.month, transactions: event.transactions, totalUsage: event.usage });
        accUsage.promptTokens += event.usage.promptTokens;
        accUsage.completionTokens += event.usage.completionTokens;
        accUsage.totalTokens += event.usage.totalTokens;
      }
      if (event.type === 'done') {
        setClassifiedMonths(accumulated);
        setTotalUsage(accUsage);
        setStage('review');
      }
      if (event.type === 'error') {
        toast.error(event.message);
        setStage('error');
      }
    }
  }
}
```

### Confirm Handler

```typescript
async function handleConfirm(confirmedMonths: ClassifiedMonth[]) {
  setStage('confirming');

  const body: ConfirmImportRequest = {
    fileId: fileId!,
    calendarYearId: selectedCalendarId,
    llmUsage: totalUsage,
    months: confirmedMonths.map((m) => ({
      month: m.month,
      transactions: m.transactions,
    })),
  };

  const res = await fetch('/api/csv-import/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    toast.error('Import failed. Please try again.');
    setStage('error');
    return;
  }

  const { savedMonths, totalEntries } = await res.json();
  toast.success(`Imported ${totalEntries} entries across ${savedMonths.length} months.`);
  setStage('done');
  router.push('/cashflow');
}
```

---

## 9. Error Handling Matrix

| Scenario | Layer | Behaviour |
|---|---|---|
| LLM API unreachable | `csv-classifier.service.ts` | Catch → fallback to raw descriptions; SSE `warning` emitted |
| LLM returns no JSON array | `csv-classifier.service.ts` | Same fallback |
| LLM array length mismatch | `csv-classifier.service.ts` | `parsed[idx]?.category ?? tx.description` — safe indexing |
| `classifyTransactions` throws | classify route | SSE `warning` + fallback `classified` event for that month |
| Session not found at classify | classify route | 404 JSON (before SSE starts) |
| Invalid `ConfirmImportRequest` | confirm route | 400 JSON with Zod flatten errors |
| `mapExpenseData()` throws | confirm route | Month skipped; session `PARTIAL`; continues to next month |
| All months fail on confirm | confirm route | Session `FAILED`; 200 JSON `{ savedMonths: [], totalEntries: 0 }` |
| Upsert override fails | confirm route | Logged server-side; does not block expense entry save |
| User not authenticated | Both routes | 401 JSON |
| Session ownership mismatch | Both routes | 403 JSON |

---

## 10. Testing Notes

### Phase 1 — Unit Tests

**File:** `src/__tests__/unit/csv-classifier.service.test.ts`

```typescript
// Mock generateText from 'ai'
// Test: correct ClassifiedTransaction[] shape returned
// Test: llmCategory matches mocked LLM response
// Test: confirmedCategory === llmCategory on initial classification
// Test: overridden: false on initial classification
// Test: amount comes from original CsvTransaction (not LLM)
// Test: fallback triggered when generateText throws
// Test: fallback uses tx.description as llmCategory
// Test: empty transactions array returns empty classified array
```

### Phase 1 — Integration Tests

**File:** `src/__tests__/integration/csv-category-matching.integration.test.ts`

```typescript
// Skip when AI_API_KEY absent (matches existing pattern)
// Fixture: July 2025 CommBank CSV (117 transactions)
// Assert: >90% of transactions classified into valid category names
// Spot checks:
//   WOOLWORTHS 1294 HORNSBY → Groceries
//   NETFLIX.COM → Entertainment
//   DEFT PAYMENTS → Home
//   TRANSPORT NSW → Vehicle & Transport
//   CHEMIST WAREHOUSE → Health & Medical
```

### Phase 1.5 — Component Tests

**File:** `src/__tests__/unit/TransactionReviewTable.test.tsx`

```typescript
// Render with mock classified months
// Test: category dropdown renders with correct value (llmCategory)
// Test: changing dropdown calls onOverride with correct args
// Test: overridden: true after category change
// Test: overridden row has amber highlight class
// Test: Accept All resets all to llmCategory
// Test: ⚠ flag renders for unknown merchant (short all-caps, no known brand)
// Test: ⚠ flag absent for Woolworths / Netflix rows
// Test: Confirm & Save button calls onConfirm with current localMonths state
```

### Phase 1.5 — API Route Tests

```typescript
// classify route: returns 401 when unauthenticated
// classify route: returns 404 when session not found
// classify route: returns 403 when session owned by different user
// classify route: streams 'classified' events for each month
// classify route: streams fallback when LLM fails
// confirm route: returns 400 for invalid body
// confirm route: upserts TransactionCategoryOverride records
// confirm route: source = 'user_override' when overridden: true
// confirm route: source = 'llm_confirmed' when overridden: false
// confirm route: session status → COMPLETED when all months saved
```
