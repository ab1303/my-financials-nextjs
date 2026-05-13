# CSV Transaction Categorisation — Approach 1: LLM Classification

> **Created**: 2026-05-13
> **Phase**: Pre-implementation planning
> **Status**: Recommended — immediate fix
> **Related Specs**: csv-import-context.md, csv-import-hld.md, CSV_CATEGORY_MATCHING_TEST.md,
> csv-categorisation-rag-examples/csv-categorisation-rag-examples.md (Phase 2)
> **Dependencies**: semantic-category-matching (prerequisite — handles final label→DB-category step)

---

## 1. Overview

### 1.1 Problem

The CSV import pipeline is broken for category matching. Integration testing (May 2026)
confirmed cosine similarity scores of 0.24–0.30 when raw CommBank transaction descriptions
(e.g. `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441"`) are passed directly to the embedding
matcher. The root cause is that mapping merchant brand names to category names requires
**world knowledge** — Woolworths is a grocery chain — not text surface similarity.

The architectural bug is in `src/app/api/csv-import/parse/route.ts` (lines 94–97), where
raw `tx.description` is passed as `categoryName` without any LLM extraction step:

```typescript
// BUG: raw bank description used as if it were an extracted category label
const entries = monthTransactions.map((tx) => ({
  categoryName: tx.description, // ← WRONG
  amount: tx.amount,
}));
```

### 1.2 Solution

Insert an LLM classification step before `mapExpenseData()`. The LLM receives the full
batch of raw descriptions and the user's category list, and returns a clean `categoryName`
for each transaction (e.g. `"Groceries"`). The existing `matchCategoryWithEmbedding()`
function then handles the final label→DB-category lookup exactly as it does for the
working image import pipeline.

### 1.3 Why LLM Classification Is the Right Immediate Approach

- Leverages world knowledge already embedded in the model (merchant→category mappings)
- No training data, no schema changes, no new infrastructure
- Mirrors the working pattern established by the AI Image Import pipeline
- One LLM call per month batch (~50 transactions) — not per transaction
- Ships in days, not weeks

---

## 2. How It Works

### 2.1 Batch Classification

For each month's transactions:

1. Collect all `CsvTransaction.description` values into a single batch
2. Call the LLM once with: the full description list + the user's category list
3. LLM returns `[{ description, category }]` pairs using its world knowledge
4. Map results back to `ExpenseExtractionResult.entries` format
5. Pass to existing `mapExpenseData()` — **unchanged**

### 2.2 Why Batching Per Month

- CommBank CSV exports group naturally by month in the existing pipeline
- A month of transactions is ~50 rows — well within context window limits
- Matches the existing SSE streaming structure (one `progress` → `saved` cycle per month)
- Minimises LLM API calls (1 per month vs 1 per transaction)

---

## 3. Architecture

### 3.1 Current (Broken) Flow

```
CSV Upload
  → AIImportSession (metadata.transactions[])
  → /api/csv-import/parse (SSE)
      → Group by month
      → [BUG] entries = tx.description as categoryName
      → mapExpenseData()
          → matchCategoryWithEmbedding(rawBankDescription)
          → cosine similarity: 0.24–0.30  ← FAILS (wrong categories)
          → ExpenseEntry created with wrong category
```

### 3.2 New (Fixed) Flow

```
CSV Upload
  → AIImportSession (metadata.transactions[])
  → /api/csv-import/parse (SSE)
      → Group by month
      → [NEW] classifyTransactions(monthTxs, categories)
          → csv-classifier.service.ts
              → LLM: batch prompt with descriptions + category list
              → "WOOLWORTHS 1294 HORNSBY..." → "Groceries"
              → "NETFLIX.COM Melbourne AU..." → "Entertainment"
              → "DEFT PAYMENTS DEFT..."       → "Home"
              → returns ExpenseExtractionResult
      → mapExpenseData()                      ← UNCHANGED
          → matchCategoryWithEmbedding("Groceries")
          → cosine similarity: 0.90+  ✓
          → ExpenseEntry created with correct category
```

### 3.3 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  /api/csv-import/parse/route.ts  (MODIFIED)                         │
│                                                                     │
│  for each month:                                                    │
│    CsvTransaction[]                                                 │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────┐                  │
│  │  csv-classifier.service.ts  (NEW)            │                  │
│  │                                              │                  │
│  │  classifyTransactions(txs, categories)       │                  │
│  │    → system prompt: category list            │                  │
│  │    → user prompt:   description batch        │                  │
│  │    → generateText() via AI SDK (gpt-4o-mini) │                  │
│  │    → parse JSON response                     │                  │
│  │    → returns ExpenseExtractionResult         │                  │
│  └────────────────────┬─────────────────────────┘                  │
│                       │  { entries: [{categoryName, amount}] }     │
│                       ▼                                             │
│  ┌──────────────────────────────────────────────┐                  │
│  │  expense-mapper.service.ts  (UNCHANGED)      │                  │
│  │                                              │                  │
│  │  mapExpenseData(result, calendarId, month)   │                  │
│  │    → matchCategoryWithEmbedding("Groceries") │                  │
│  │    → prisma.expenseEntry.create(...)         │                  │
│  └──────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. New File: `csv-classifier.service.ts`

**Path**: `src/server/services/ai-import/csv-classifier.service.ts`

### 4.1 Public API

```typescript
/**
 * Classify a batch of CSV transactions into user-defined expense categories.
 * Makes a single LLM call for the entire batch.
 *
 * @param transactions  - CsvTransaction[] for one month
 * @param categories    - ExpenseCategory[] from Prisma (active only)
 * @returns             - ExpenseExtractionResult ready for mapExpenseData()
 */
export async function classifyTransactions(
  transactions: CsvTransaction[],
  categories: ExpenseCategory[],
): Promise<ExpenseExtractionResult>;
```

### 4.2 Implementation Notes

- Uses `generateText` from the `ai` SDK — same import as `ai-vision.service.ts`
- Uses `getAIProvider()` — identical factory to `ai-vision.service.ts` (reads `AI_VISION_MODEL`, `AI_API_KEY`, `AI_BASE_URL`, `AI_PROVIDER` env vars)
- Model: `gpt-4o-mini` (default via `AI_VISION_MODEL`) — sufficient for text classification; no vision capability required
- JSON extraction: same `text.match(/\[[\s\S]*\]/)` pattern as vision service

### 4.3 Prompt Design

**System prompt** (sent once per batch call):

```
You are a financial transaction classifier for an Australian personal finance app.

Your task: classify each bank transaction description into exactly one of the
following expense categories.

Available categories:
- Groceries
- Home
- Entertainment
- Utilities
- Health & Medical
- Vehicle & Transport
- Eating out & takeaway
- Shopping
- Sport & Fitness
- Education
- Childcare
- Gifts & Donations
- Cash

Rules:
- Respond ONLY with a JSON array. No other text.
- Use ONLY the exact category names listed above.
- If genuinely uncertain, use the closest match — never return null or "Other".
- Woolworths, Coles, Aldi, IGA → Groceries
- Netflix, Spotify, Disney+, gaming → Entertainment
- DEFT PAYMENTS, strata, rent → Home
- Chemist Warehouse, pharmacies, medical centres → Health & Medical
```

**User prompt** (the batch):

```
Classify each of the following Australian bank transaction descriptions.
Return a JSON array with one object per transaction in this exact format:
[{"description": "<original>", "category": "<category name>"}]

Transactions:
1. WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441 Value Date: 29/07/2025
2. NETFLIX.COM Melbourne AU AUS Card xx5441 Value Date: 02/07/2025
3. Direct Debit 077380 DEFT PAYMENTS DEFT 28408579 Value Date: 01/07/2025
...
```

### 4.4 Response Parsing

LLM response is parsed to `ExpenseExtractionResult`:

```typescript
// Map [{ description, category }] → ExpenseExtractionResult.entries
entries: classified.map((item, idx) => ({
  categoryName: item.category, // extracted label ("Groceries")
  amount: transactions[idx]!.amount, // from original CsvTransaction
}));
```

### 4.5 Graceful Fallback

If the LLM call fails (network error, rate limit, invalid JSON):

```typescript
// Fall back: use raw description as categoryName
// matchCategoryWithEmbedding() will return "Other" (sub-threshold)
// SSE warning event emitted: "LLM classification failed, falling back to description matching"
return {
  success: false,
  confidence: 0,
  entries: transactions.map((tx) => ({
    categoryName: tx.description,
    amount: tx.amount,
  })),
  warnings: [`CSV classification failed: ${error.message}`],
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
};
```

---

## 5. Changes to `csv-import/parse/route.ts`

The only change required is replacing the broken `entries` construction with a call to
`classifyTransactions()`.

### 5.1 Before (Broken)

```typescript
// Lines 94–97 — ARCHITECTURAL BUG
const entries = monthTransactions.map((tx) => ({
  categoryName: tx.description, // raw bank description ← WRONG
  amount: tx.amount,
}));

const result: ExpenseExtractionResult = {
  success: true,
  confidence: 1.0,
  entries,
  warnings: [],
  usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
};
```

### 5.2 After (Fixed)

```typescript
// NEW: classify descriptions via LLM before passing to expense mapper
const result = await classifyTransactions(monthTransactions, categories);

// LLM usage is now tracked (non-zero tokens)
// result.entries[i].categoryName = "Groceries" (not raw description)
```

### 5.3 Categories Pre-fetch

`categories` (active `ExpenseCategory[]`) should be fetched once before the month loop
and passed to both `classifyTransactions()` and `mapExpenseData()` to avoid N+1 DB queries.

---

## 6. Pros and Cons

### 6.1 Pros

| Benefit                        | Detail                                                     |
| ------------------------------ | ---------------------------------------------------------- |
| World knowledge                | LLM knows Woolworths = grocery chain without training data |
| No new infrastructure          | Uses existing `AI_API_KEY` + `AI_VISION_MODEL` env vars    |
| Batched efficiency             | One LLM call per ~50 transactions (per month)              |
| Same pattern as image pipeline | Mirrors the working `extractExpenseData()` flow            |
| Ships immediately              | No schema changes, no new services, no data bootstrap      |
| Self-documenting prompts       | Category list is visible in the prompt; easy to tune       |

### 6.2 Cons

| Drawback                  | Mitigation                                               |
| ------------------------- | -------------------------------------------------------- |
| LLM cost per import       | ~$0.0003 per month import (see §7) — negligible          |
| Non-deterministic         | Occasional wrong category; improves with clearer prompts |
| Rate limits at batch size | Cap batch at 100 transactions; split if needed           |
| Model must support text   | `gpt-4o-mini` supports text; not image-only. ✓           |
| No personalisation        | Doesn't learn user preferences (→ Phase 2, RAG)          |

---

## 7. Cost Estimate

| Parameter                      | Value                   |
| ------------------------------ | ----------------------- |
| Model                          | `gpt-4o-mini`           |
| Input token price              | $0.15 / 1M tokens       |
| Output token price             | $0.60 / 1M tokens       |
| Transactions per month import  | ~100                    |
| Tokens per description         | ~20 input               |
| System prompt + category list  | ~200 tokens (amortised) |
| Total input tokens per import  | ~2,200                  |
| Total output tokens per import | ~500                    |
| **Estimated cost per import**  | **~$0.0006**            |

A user importing 12 months of history costs approximately **$0.007 total**.

---

## 8. Integration Test Approach

### 8.1 Unit Tests (Mocked LLM)

**File**: `src/__tests__/unit/csv-classifier.service.test.ts`

```typescript
// Mock generateText to return fixture JSON
// Assert: classifyTransactions() returns correct ExpenseExtractionResult shape
// Assert: entries[i].categoryName is mapped from LLM response
// Assert: entries[i].amount comes from original CsvTransaction
// Assert: fallback returns description as categoryName on LLM failure
```

### 8.2 Integration Test (Real LLM)

**File**: `src/__tests__/integration/csv-category-matching.integration.test.ts`

Update the existing test (currently testing embedding-only approach) to:

1. Run `classifyTransactions()` on the July 2025 CommBank fixture (117 transactions)
2. Assert >90% of transactions receive the correct category
3. Assert spot-check transactions match expected categories:

| Description                            | Expected            |
| -------------------------------------- | ------------------- |
| `WOOLWORTHS 1294 HORNSBY NS AUS...`    | Groceries           |
| `NETFLIX.COM Melbourne AU...`          | Entertainment       |
| `Direct Debit 077380 DEFT PAYMENTS...` | Home                |
| `TRANSPORT NSW ETOLL PARRAMATTA...`    | Vehicle & Transport |
| `CHEMIST WAREHOUSE HORNSBY NS...`      | Health & Medical    |

Skipped automatically when `AI_API_KEY` is absent (matches existing test pattern).

---

## 9. Phase 1.5 — User Review & Category Override

> **Status**: Required extension to Phase 1 before Phase 2 (RAG) can be meaningful.
> The LLM is not always right, and users know their own merchants. This phase adds a
> review step between classification and saving so users can correct mistakes before
> they are persisted.

### 9.1 Problem & Motivation

Phase 1 classifies and saves in a single pass. Two problems arise:

1. **Wrong LLM classifications** — e.g. `REBEL SPORT` → `Shopping` when the user
   considers it `Sport & Fitness`. These errors are silently persisted.
2. **Unknown private merchants** — e.g. `JOE'S FITNESS STUDIO CASTLE HILL` is a local
   business the LLM has no knowledge of. It will be guessed (often incorrectly) and saved.

Without a correction mechanism, wrong categories accumulate in the DB and Phase 2 RAG
would learn from bad data.

### 9.2 Revised Workflow (Two-Step Import)

Split the current single-pass route into two separate steps:

```
CURRENT (Phase 1 — single pass):
  POST /api/csv-import/parse (SSE)
    → classify + save in one shot

NEW (Phase 1.5 — two-step):
  Step 1 — Classify:
    POST /api/csv-import/classify (SSE)
      → classify transactions via LLM
      → emit classified results (NOT saved yet)
      → client shows Review UI

  Step 2 — Confirm & Save:
    POST /api/csv-import/confirm
      → accepts user-confirmed { description, category }[] pairs
      → calls mapExpenseData() to save ExpenseEntries
      → stores each confirmed pair in TransactionCategoryOverride table
```

### 9.3 New Route: `/api/csv-import/classify` (SSE)

Replaces the classification half of `parse/route.ts`. Emits SSE events:

```typescript
// Existing event types (unchanged)
{ type: 'progress', month, processed, total }
{ type: 'saved',    month, count }        // ← removed in this route
{ type: 'error',    message }

// New event type
{
  type: 'classified',
  month: string,                          // e.g. "2025-07"
  transactions: ClassifiedTransaction[],  // see §9.4
}
```

The route does **not** call `mapExpenseData()` — it only classifies and streams results back.

### 9.4 `ClassifiedTransaction` Type

```typescript
type ClassifiedTransaction = {
  id: string;            // UUID generated at classification time (client key)
  description: string;   // original bank description
  amount: number;
  date: string;          // ISO date string
  llmCategory: string;   // what the LLM suggested
  confirmedCategory: string; // starts equal to llmCategory; user may change it
  overridden: boolean;   // true if user changed it from llmCategory
};
```

### 9.5 New Route: `POST /api/csv-import/confirm`

Accepts the user-confirmed classification for one or more months and saves to DB.

**Request body:**
```typescript
type ConfirmImportRequest = {
  calendarYearId: string;
  months: {
    month: string;  // "2025-07"
    transactions: {
      description: string;
      confirmedCategory: string;
      amount: number;
      date: string;
      overridden: boolean;
    }[];
  }[];
};
```

**On receipt:**
1. For each month, call `mapExpenseData()` using `confirmedCategory` (not LLM output)
2. For each transaction, upsert a `TransactionCategoryOverride` record (see §9.6)
3. Return `{ savedMonths: string[], totalEntries: number }`

### 9.6 New Prisma Model: `TransactionCategoryOverride`

Stores the canonical `description → category` mapping as confirmed by the user.
This table is the **raw data source** for Phase 2 vector embeddings.

```prisma
model TransactionCategoryOverride {
  id          String   @id @default(cuid())
  userId      String
  description String   // normalised original description (lowercased, trimmed)
  category    String   // confirmed category name (e.g. "Sport & Fitness")
  source      String   // "llm_confirmed" | "user_override"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, description])
}
```

- `source = "llm_confirmed"` — LLM was correct and user accepted it
- `source = "user_override"` — user explicitly changed the LLM's suggestion
- `@@unique([userId, description])` — upsert semantics: later imports update the category

> **Phase 2 note**: The `description` + `category` pair will be embedded into a vector
> store in Phase 2. The `TransactionCategoryOverride` table acts as the ground-truth
> catalogue that Phase 2 embeds. See §10 for the Phase 2 workflow change.

### 9.7 Review UI Component

**Path**: `src/components/csv-import/TransactionReviewTable.tsx`

A Client Component rendered after the classify SSE stream completes. Displays one
collapsible section per month.

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Review Classified Transactions                                  │
│  LLM has suggested categories below. Override any that are      │
│  incorrect before saving.                                        │
├──────────────────────────────────────────────────────────────────┤
│  July 2025  (23 transactions)                          [▼]       │
├────────────────────────┬──────────────┬────────────────┬────────┤
│  Description           │  Amount      │  Category      │ Flag   │
├────────────────────────┼──────────────┼────────────────┼────────┤
│  REBEL SPORT HORNSBY   │  -$129.00    │  [Shopping  ▾] │        │
│  WOOLWORTHS 1294       │  -$84.50     │  [Groceries ▾] │  ✓     │
│  JOE'S FITNESS STUDIO  │  -$60.00     │  [Shopping  ▾] │  ⚠     │
├────────────────────────┴──────────────┴────────────────┴────────┤
│  ⚠ 3 transactions have low-confidence classification            │
│                              [Accept All]  [Confirm & Save →]   │
└─────────────────────────────────────────────────────────────────┘
```

#### Behaviour

- Category column renders as a dropdown (`<select>`) populated from user's category list
- Changing a dropdown sets `overridden = true` and highlights the row
- **Accept All**: sets all `confirmedCategory = llmCategory`, enables Save button
- **Confirm & Save**: POSTs to `/api/csv-import/confirm`, shows progress, navigates on success
- `⚠` flag: shown when a description contains tokens that suggest a local/unknown merchant
  (heuristic: no known brand tokens, short description, all-caps with numbers — indicates
  a likely private business; prompts user to review that row)

#### Low-Confidence Heuristic (client-side, no LLM)

```typescript
function isLikelyUnknownMerchant(description: string): boolean {
  // Descriptions that are short, all-caps, contain no known brand signal
  // are likely local/private merchants the LLM guessed at
  const words = description.split(' ');
  return (
    words.length <= 4 &&
    description === description.toUpperCase() &&
    !KNOWN_BRAND_TOKENS.has(words[0]?.toUpperCase() ?? '')
  );
}
```

`KNOWN_BRAND_TOKENS` is a small static set (`WOOLWORTHS`, `COLES`, `ALDI`, `NETFLIX`, etc.)
in a co-located constants file. It is intentionally minimal — the purpose is to flag
rows worth reviewing, not to classify.

### 9.8 Updated Import Page Flow

```
CSV Upload Page
  → uploads file
  → calls /api/csv-import/classify (SSE)
      → per month: emits 'classified' event with ClassifiedTransaction[]
      → UI appends month section to Review Table
  → when stream ends: Review UI is fully populated
  → user reviews, overrides categories as needed
  → clicks "Confirm & Save"
  → POST /api/csv-import/confirm
      → mapExpenseData() saves ExpenseEntries
      → upserts TransactionCategoryOverride records
  → success → navigate to expenses view
```

### 9.9 Phase 1.5 Implementation Checklist

- [ ] **New route** `src/app/api/csv-import/classify/route.ts`
  - SSE: classify only, emit `classified` events, do NOT save
  - Reuses `classifyTransactions()` from `csv-classifier.service.ts`

- [ ] **New route** `src/app/api/csv-import/confirm/route.ts`
  - POST: accept confirmed classifications, call `mapExpenseData()`, upsert overrides

- [ ] **Prisma migration**: add `TransactionCategoryOverride` model

- [ ] **New component** `src/components/csv-import/TransactionReviewTable.tsx`
  - Per-month collapsible sections
  - Category dropdown overrides
  - Low-confidence `⚠` flag heuristic
  - Accept All + Confirm & Save actions

- [ ] **Update CSV import page** to use classify → review → confirm flow

---

## 10. Relationship to RAG Approach (Phase 2)

This document covers **Phase 1** (LLM classification) and **Phase 1.5** (user review &
override). Phase 2 (see `spec/csv-categorisation-rag-examples/csv-categorisation-rag-examples.md`)
adds a vector retrieval layer on top.

### 10.1 How Phase 1.5 Bootstraps Phase 2

Every row written to `TransactionCategoryOverride` in Phase 1.5 is a confirmed
`description → category` pair. Phase 2 will embed these pairs into a vector store
(pgvector or similar) during the confirm step — or as a background job afterwards.

### 10.2 Workflow Evolution Across Phases

```
Phase 1 (classify & save, no review):
  description → LLM → category label → mapExpenseData() → DB

Phase 1.5 (classify → review → confirm, this spec):
  description → LLM → ClassifiedTransaction[]
                → Review UI (user overrides)
                → confirm POST
                    → mapExpenseData() → DB
                    → TransactionCategoryOverride upsert

Phase 2 (RAG on top of Phase 1.5 — workflow change):
  description → vector search TransactionCategoryOverride embeddings
      → if high-confidence match found: use stored category (skip LLM)
      → else: LLM with few-shot examples from matched records → category
              → Review UI → confirm POST (same as Phase 1.5)
                  → mapExpenseData() → DB
                  → TransactionCategoryOverride upsert
                  → embed new record into vector store
```

### 10.3 Phase 2 Entry Point

Phase 2 modifies only `classifyTransactions()` (in `csv-classifier.service.ts`).
The routes, Review UI, and confirm flow are **unchanged** — Phase 2 is entirely
encapsulated behind that one service function.

The `TransactionCategoryOverride` table introduced in Phase 1.5 becomes the vector
store's source of truth. Embeddings are stored alongside it (either as a
`descriptionEmbedding Bytes` column on the same model, or in a dedicated pgvector
table depending on the DB stack chosen for Phase 2).

**The phases are non-breaking and additive.** Phase 1.5 ships immediately. Phase 2 is
layered on top without modifying Phase 1 or 1.5 contracts.

---

## 11. Implementation Checklist

### Phase 1 — LLM Classifier Service

- [ ] `src/server/services/ai-import/csv-classifier.service.ts` — **NEW**
  - `classifyTransactions(transactions, categories): Promise<ExpenseExtractionResult>`
  - Uses `generateText` from `ai` SDK
  - Batch prompt with category list + descriptions
  - JSON response parsing + mapping to `ExpenseExtractionResult`
  - Graceful fallback on LLM failure

- [ ] `src/__tests__/unit/csv-classifier.service.test.ts` — **NEW**
  - Unit tests with mocked `generateText`

- [ ] `src/__tests__/integration/csv-category-matching.integration.test.ts` — **UPDATE**
  - Update to test LLM classification path (not embedding-only)
  - Assert >90% accuracy on July 2025 fixture

### Phase 1.5 — Review UI & Override Persistence

- [ ] `src/app/api/csv-import/classify/route.ts` — **NEW**
  - SSE: classify only, emit `classified` events, do NOT save
  - Reuses `classifyTransactions()` from csv-classifier service

- [ ] `src/app/api/csv-import/confirm/route.ts` — **NEW**
  - POST: accept confirmed `ClassifiedTransaction[]` per month
  - Call `mapExpenseData()` to save `ExpenseEntry` records
  - Upsert `TransactionCategoryOverride` for each transaction

- [ ] **Prisma migration**: add `TransactionCategoryOverride` model

- [ ] `src/components/csv-import/TransactionReviewTable.tsx` — **NEW**
  - Per-month collapsible sections
  - Category dropdown per row (override)
  - `⚠` flag for likely-unknown merchants (§9.7 heuristic)
  - Accept All + Confirm & Save actions

- [ ] **Update CSV import page** to use classify → review → confirm flow
  - Replace direct parse call with classify SSE stream
  - Render `TransactionReviewTable` after stream completes
  - Wire Confirm & Save to the confirm route

- [ ] `src/app/api/csv-import/parse/route.ts` — **DEPRECATE** (replaced by classify + confirm)

### Phase 2 — Vector RAG (future — separate spec)

- [ ] Embed `TransactionCategoryOverride` records into vector store on upsert
- [ ] Modify `classifyTransactions()` to query vector store before calling LLM
- [ ] See `spec/csv-categorisation-rag-examples/csv-categorisation-rag-examples.md`
