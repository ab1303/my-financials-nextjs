# CSV LLM Classification — Implementation Findings

> **Date**: 2026-05-13  
> **Phase**: Phase 1.5 complete (Review UI + Override Persistence)  
> **Status**: Working — bugs fixed, migration applied

---

## 1. What Was Built

A 4-step CSV Import Wizard:

```
Upload → AI Classify (SSE) → Review & Override → Results
```

| Step | Component | Notes |
|------|-----------|-------|
| Upload | `CSVUploadStep.tsx` | Parses CommBank CSV, stores in `AIImportSession` |
| Classify | `CSVClassifyingStep.tsx` | Streams SSE from `/api/csv-import/classify` — LLM classifies per-month batches |
| Review | `TransactionReviewTable.tsx` | User can override any category before saving |
| Results | `CSVResultsStep.tsx` | Shows records created, months processed, session ID |

**Key routes:**
- `POST /api/csv-import/classify` — SSE stream, LLM classifies all transactions  
- `POST /api/csv-import/confirm` — saves `ExpenseEntry` records + upserts `TransactionCategoryOverride`

---

## 2. What Is `TransactionCategoryOverride`?

### Short answer
It is **seed data for Phase 2** — not used by Phase 1 at all.

### Why it exists

Every time a user confirms an import, the app records every `bank description → category` pair in this table. The `source` column tracks whether the LLM got it right (`llm_confirmed`) or the user corrected it (`user_override`).

```
e.g.
"rebel sport online"          → "Fitness"         (user_override — LLM said "Shopping")
"woolworths 1294 hornsby"     → "Groceries"        (llm_confirmed)
"cmp3nm abc studio"           → "Fitness"          (user_override — LLM had no knowledge)
```

### The Phase 2 connection

Phase 2 (see `spec/csv-categorisation-rag-examples/`) will embed these pairs into a **vector store (pgvector)**. Future imports will:

1. Vector-search `TransactionCategoryOverride` first — if a similar merchant was seen before, use the stored category  
2. Only call the LLM if no confident match is found

This solves the "private business" problem the user raised:
> *"There is a private Fitness studio I go to — its not a popular franchise"*

After the first import + override, Phase 2 would recognise that merchant automatically. **Phase 1 plants the seed; Phase 2 grows it.**

### Schema

```prisma
model TransactionCategoryOverride {
  id          String   @id @default(cuid())
  userId      String
  description String   // lowercased, trimmed bank transaction description
  category    String   // confirmed expense category name
  source      String   // "llm_confirmed" | "user_override"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, description])   // upsert key — one record per user+description
  @@index([userId])
}
```

Key design decision: `@@unique([userId, description])` — overrides are **per-user**, not global. Your fitness studio override doesn't affect other users.

---

## 3. Bugs Found & Fixed

### Bug A — "Import Failed" shown despite 107 records saved

**Root cause:** `TransactionCategoryOverride` migration was never run (table didn't exist in DB). The `upsert` threw a Prisma error, which was caught by the **month-level** try-catch, incrementing `failedMonths`. For a single-month file, `failedMonths === months.length` → status `FAILED`.

**The contradiction:** `mapExpenseData` had already succeeded and created 107 entries + incremented `totalSavedMonths` before the upsert ran. So the response correctly returned 107 records created, but status `FAILED`.

**Fix 1:** Migration `20260513062907_add_transaction_category_override` created and applied.  
**Fix 2:** Wrapped the upsert loop in its **own** `try/catch` (separate from the month save try/catch). Upsert failures now log a warning server-side but **never mark a month as failed**. Only `mapExpenseData` failures increment `failedMonths`.

```typescript
// confirm/route.ts — after this fix:
try {
  const mapResult = await mapExpenseData(...);       // ← month fails if this throws
  totalSavedMonths++;
  totalEntries += mapResult.entriesCreated;

  try {
    for (const tx of month.transactions) {
      await prisma.transactionCategoryOverride.upsert(...);  // ← best-effort only
    }
  } catch (overrideError) {
    console.warn('Could not save category overrides:', overrideError.message);
    // does NOT increment failedMonths
  }
} catch (monthError) {
  failedMonths++;   // ← only real save failures reach here
}
```

### Bug B — AI Spend page showed "No AI usage recorded"

**Root cause 1:** `csv-classifier.service.ts` used `usage.inputTokens` and `usage.outputTokens` — properties that **don't exist** in the Vercel AI SDK. The correct properties are `promptTokens` and `completionTokens`. These were always `0`, so the AI usage log was logged with `promptTokens: 0`, `completionTokens: 0`.

```typescript
// BEFORE (wrong — inputTokens/outputTokens don't exist in Vercel AI SDK)
promptTokens: usage.inputTokens ?? 0,
completionTokens: usage.outputTokens ?? 0,
totalTokens: usage.totalTokens ?? 0,

// AFTER (correct)
promptTokens: usage.promptTokens ?? 0,
completionTokens: usage.completionTokens ?? 0,
totalTokens: usage.totalTokens ?? 0,
```

**Root cause 2:** `estimatedCostUSD` was hardcoded to `0` in the confirm route. Fixed to calculate actual cost:

```typescript
const estimatedCostUSD =
  (llmUsage.promptTokens / 1_000_000) * 0.15 +   // gpt-4o-mini input price
  (llmUsage.completionTokens / 1_000_000) * 0.60; // gpt-4o-mini output price
```

**Root cause 3 (defensive fix):** The `aIUsageLog.create` call was inside the outer try-catch with no local error handling. If it failed, the whole confirm route returned 500 — silently swallowing the main result. Wrapped in its own try-catch so a logging failure never kills the import.

---

## 4. Known Remaining Issues / Tech Debt

### 4.1 `mapExpenseData` is wrong for CSV imports

`mapExpenseData` was designed for image imports. For each expense entry it calls `matchCategoryWithEmbedding()` — making **one OpenAI embedding API call per transaction** (107 calls for a 107-row CSV). This is:
- Slow (sequential, not batched)
- Expensive (embedding tokens not tracked in AI usage log)
- Unnecessary — for CSV imports the LLM already returned exact category names; no embedding matching needed

**Recommended fix:** The CSV confirm route should bypass `mapExpenseData` and write `ExpenseEntry` records directly, looking up the `categoryId` from the `categoryMap` using the confirmed category name (exact match). The `matchCategoryWithEmbedding` fallback is only needed when category names might be approximate (image imports).

### 4.2 Duplicate `ClassifiedMonth` type definition

`ClassifiedMonth` is defined in two places:
- `src/components/csv-import/TransactionReviewTable.tsx` (exported)
- `src/app/(authorized)/cashflow/expense/_components/csv-import/_types.ts`

They are structurally identical but TypeScript treats them as separate types. Should be consolidated into `_types.ts` and imported by the component.

### 4.3 AI usage log date filter (timezone display)

The AI Spend page default date range appears as "30/04/2026 to 30/05/2026" for a user in AEST (+10). This is technically correct (the `toDateStr` uses `.toISOString()` which converts to UTC, so "May 1 AEST" becomes "April 30 UTC"), but visually confusing. The dates shown in the date picker don't match the user's mental model of "this calendar month".

---

## 5. Phase 2 Prerequisite Checklist

Before Phase 2 (vector RAG) can be built, Phase 1.5 must have been used enough times to populate `TransactionCategoryOverride` with real data. Key things to check:

- [ ] `TransactionCategoryOverride` records are accumulating — run a few CSV imports
- [ ] `source = 'user_override'` rows exist (user has corrected at least some LLM suggestions)
- [ ] The data quality looks good (no junk descriptions, categories match DB categories)

Phase 2 will add pgvector to the schema, embed each `TransactionCategoryOverride` row during the confirm step, and add a vector-search pre-pass in the classify route.

---

## 6. Files Modified in This Phase

| File | Change |
|------|--------|
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVImportWizard.tsx` | Full rewrite: 3-step → 4-step, dark mode, no backdrop close, state reset |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVClassifyingStep.tsx` | **New** — SSE consumer for classify route |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/_types.ts` | Added `ClassifiedMonth`, `CSVClassifyingStepProps`, 4-step union |
| `src/app/(authorized)/cashflow/expense/_components/csv-import/CSVUploadStep.tsx` | Fixed: render `{tx.date}` raw (CommBank dates are DD/MM/YYYY, not ISO) |
| `src/components/csv-import/TransactionReviewTable.tsx` | **New** — review table, category dropdowns, confirm button, dark mode |
| `src/app/api/csv-import/classify/route.ts` | `done` event includes `model` + `categories` fields |
| `src/app/api/csv-import/confirm/route.ts` | Separated upsert errors, real cost calculation, defensive logging |
| `src/server/services/ai-import/csv-classifier.service.ts` | Fixed token property names (`inputTokens` → `promptTokens`) |
| `prisma/schema.prisma` | Added `TransactionCategoryOverride` model |
| `prisma/migrations/20260513062907_add_transaction_category_override/` | **New** migration |
