# CSV Transaction Categorisation — LLM Classification & Review
## High Level Design (HLD)

**Location:** `spec/csv-categorisation-llm-classification/csv-categorisation-llm-classification-hld.md`
**Date:** 2026-05-13
**Status:** Ready for implementation
**Parent Spec:** [csv-categorisation-llm-classification.md](./csv-categorisation-llm-classification.md)
**Related:**
- [csv-import-hld.md](../csv-import/csv-import-hld.md) — upstream CSV parse pipeline
- [semantic-category-matching-hld.md](../semantic-category-matching/semantic-category-matching-hld.md) — downstream embedding matcher
- [csv-categorisation-rag-examples.md](../csv-categorisation-rag-examples/csv-categorisation-rag-examples.md) — Phase 2

---

## 1. Problem Statement

The CSV import pipeline persists incorrect expense categories because raw bank
descriptions (e.g. `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441"`) are passed
directly to the embedding matcher as if they were category labels. Cosine
similarity scores of 0.24–0.30 result in wrong or no matches.

Two compounding issues exist:

1. **LLM classification gap**: No step converts merchant descriptions to category
   labels using world knowledge. The LLM knows "Woolworths" is a grocery chain;
   the embedding matcher does not.

2. **No user correction mechanism**: Even after LLM classification is added,
   misclassifications (e.g. `REBEL SPORT → Shopping` instead of `Sport & Fitness`)
   and unknown private merchants (e.g. `JOE'S FITNESS STUDIO CASTLE HILL`) are
   silently persisted. Users have no way to review or override before data is saved.

---

## 2. Goals

1. **Classify** raw bank transaction descriptions into user-defined expense
   categories using a single batched LLM call per month.
2. **Present** classified results to the user in a Review UI before any data
   is saved to the database.
3. **Allow** per-transaction category overrides; persist the user's confirmed
   classification (not the LLM's guess).
4. **Store** every confirmed `description → category` pair in a
   `TransactionCategoryOverride` table, providing the data foundation for Phase 2
   RAG-based classification.
5. **Preserve** the existing `mapExpenseData()` and
   `matchCategoryWithEmbedding()` pipeline unchanged — classification feeds into
   it, does not replace it.

---

## 3. Non-Goals

- **No changes to the embedding matching pipeline** (`matchCategoryWithEmbedding()`)
- **No vector store / pgvector** in this phase (Phase 2 only)
- **No auto-learning from corrections** in this phase (Phase 2 only)
- **No support for income/credit transactions** (debits only, as per existing pipeline)
- **No bulk re-classification of previously imported transactions** (Phase 2)
- **No OFX or non-CommBank formats** (existing scope constraint)

---

## 4. Architecture Overview

### 4.1 Phase Relationship

```
Phase 1 — LLM Classifier Service
  Raw descriptions → classifyTransactions() → category labels
  (One LLM call per month batch, ~50 transactions)

Phase 1.5 — Review UI & Override Persistence (this phase, builds on Phase 1)
  classify SSE route → ClassifiedTransaction[] → Review UI
  → user confirms/overrides → confirm POST
  → mapExpenseData() saves ExpenseEntries
  → TransactionCategoryOverride upsert

Phase 2 — RAG (future, separate spec)
  vector search TransactionCategoryOverride embeddings first
  → confident match: skip LLM
  → else: LLM with few-shot examples from matched records
  (Phase 2 modifies classifyTransactions() only; routes and UI unchanged)
```

### 4.2 System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CSV Import Page (Client)                                               │
│                                                                         │
│  1. Upload CSV → /api/csv-import/upload (existing)                      │
│  2. Start classify → /api/csv-import/classify (NEW, SSE)                │
│  3. Render TransactionReviewTable (NEW)                                  │
│  4. User reviews / overrides                                             │
│  5. Confirm → POST /api/csv-import/confirm (NEW)                        │
│  6. Navigate to expenses view                                            │
└─────────────────────────────────────────────────────────────────────────┘
                    │                         │
                    ▼                         ▼
   /api/csv-import/classify        /api/csv-import/confirm
         (SSE, NEW)                      (POST, NEW)
                    │                         │
                    ▼                         │
   csv-classifier.service.ts                  │
         (NEW)                                │
                    │                         │
          ┌─────────┘                         │
          │  LLM (gpt-4o-mini)                │
          │  generateText() via AI SDK        │
          └──────────────────┐                │
                             │                │
                             ▼                ▼
                    ClassifiedTransaction[]
                             │
                             │         ┌────────────────────────────┐
                             │         │  expense-mapper.service.ts  │
                             │         │  (UNCHANGED)                │
                             │         │  mapExpenseData()           │
                             │         │    → matchCategoryWith      │
                             │         │      Embedding()            │
                             │         │    → ExpenseEntry.create()  │
                             │         └────────────────────────────┘
                             │                         │
                             │                         ▼
                             │         ┌────────────────────────────┐
                             └────────►│  TransactionCategoryOverride│
                                       │  (NEW Prisma model)         │
                                       │  description → category     │
                                       │  source: user_override |    │
                                       │          llm_confirmed      │
                                       └────────────────────────────┘
```

### 4.3 Component Inventory

| File / Module | Status | Purpose |
|---|---|---|
| `src/app/api/csv-import/classify/route.ts` | **New** | SSE: classify only, emit `classified` events |
| `src/app/api/csv-import/confirm/route.ts` | **New** | POST: save confirmed classifications, upsert overrides |
| `src/server/services/ai-import/csv-classifier.service.ts` | **New** | `classifyTransactions()` — LLM batch classification |
| `src/components/csv-import/TransactionReviewTable.tsx` | **New** | Review UI: per-month table, category dropdowns, overrides |
| `prisma/schema.prisma` | **Modified** | Add `TransactionCategoryOverride` model |
| `src/server/services/ai-import/_types.ts` | **Modified** | Add `ClassifiedTransaction`, `ConfirmImportRequest` |
| `src/app/api/csv-import/parse/route.ts` | **Deprecated** | Replaced by classify + confirm routes |
| `src/server/services/ai-import/expense-mapper.service.ts` | Unchanged | Reused as-is |
| `src/server/services/ai-import/category-matcher.service.ts` | Unchanged | Reused as-is |

---

## 5. Data Flow

### 5.1 Classify Flow (`POST /api/csv-import/classify`)

```
1. Auth check → 401 if no session

2. Validate JSON body: { fileId, calendarId }

3. Load AIImportSession by fileId
   → 404 if not found
   → 403 if session.userId ≠ current user

4. Fetch active ExpenseCategory[] from DB (once, not per month)

5. Group transactions from session.metadata by month

6. Open SSE stream (Content-Type: text/event-stream)

7. For each month group:
   a. Emit: { type: 'progress', month, processed, total }
   b. Call classifyTransactions(monthTxs, categories)
      → LLM returns [{ description, category }]
      → Map to ClassifiedTransaction[] (with UUIDs, llmCategory, confirmedCategory)
   c. Emit: { type: 'classified', month, transactions: ClassifiedTransaction[] }

8. Emit: { type: 'done' }
   Close SSE stream
   (Nothing written to DB)
```

### 5.2 Confirm Flow (`POST /api/csv-import/confirm`)

```
1. Auth check → 401 if no session

2. Validate JSON body: ConfirmImportRequest
   { calendarYearId, months: [{ month, transactions: ClassifiedTransaction[] }] }

3. Fetch active ExpenseCategory[] from DB (once)

4. For each month:
   a. Build ExpenseExtractionResult from confirmedCategory values
   b. Call mapExpenseData(result, calendarYearId, month, userId)
      → matchCategoryWithEmbedding(confirmedCategory)
      → prisma.expenseEntry.create()
   c. For each transaction: upsert TransactionCategoryOverride
      { userId, description (normalised), category, source }

5. Log AIUsageLog (LLM tokens from classify step, passed in request)

6. Update AIImportSession status → COMPLETED | PARTIAL | FAILED

7. Return { savedMonths, totalEntries }
```

### 5.3 LLM Classification (`csv-classifier.service.ts`)

```
Input:  CsvTransaction[], ExpenseCategory[]

1. Build system prompt: category list + classification rules
2. Build user prompt: numbered transaction descriptions
3. Call generateText(model, system, user) via AI SDK
4. Extract JSON array from response text (regex: /\[[\s\S]*\]/)
5. Map [{ description, category }] → ClassifiedTransaction[]
   → id: crypto.randomUUID()
   → llmCategory: item.category
   → confirmedCategory: item.category  (starts same as llmCategory)
   → overridden: false

Fallback (on any error):
   → Return ClassifiedTransaction[] with llmCategory = tx.description
   → Emit SSE warning event
```

---

## 6. API Contract

### 6.1 Classify Route

**Endpoint:** `POST /api/csv-import/classify`
**Request body:**
```json
{
  "fileId": "<AIImportSession.id>",
  "calendarId": "<CalendarYear.id>"
}
```

**Response:** `text/event-stream` (SSE)

| Event type | Payload |
|---|---|
| `progress` | `{ month: string, processed: number, total: number }` |
| `classified` | `{ month: string, transactions: ClassifiedTransaction[] }` |
| `warning` | `{ message: string }` |
| `done` | `{}` |
| `error` | `{ message: string }` |

### 6.2 Confirm Route

**Endpoint:** `POST /api/csv-import/confirm`
**Request body:** `ConfirmImportRequest` (see LLD §1)
**Response 200:**
```json
{
  "savedMonths": ["2025-07", "2025-08"],
  "totalEntries": 47
}
```
**Error responses:** 401, 400, 404, 403

---

## 7. Database Impact

| Model | Operation | Notes |
|---|---|---|
| `TransactionCategoryOverride` | **CREATE** (new model) | `@@unique([userId, description])` — upsert semantics |
| `AIImportSession` | READ (classify) + UPDATE (confirm) | Status updated to COMPLETED/PARTIAL/FAILED on confirm |
| `AIUsageLog` | CREATE (confirm step) | LLM token usage logged on confirm |
| `Expense` | CREATE if missing | Managed by `mapExpenseData()` |
| `ExpenseEntry` | CREATE per matched row | `importImageId: null` for CSV imports |
| `ExpenseCategory` | READ only | Fetched once before classify loop |

### New Prisma Model

```prisma
model TransactionCategoryOverride {
  id          String   @id @default(cuid())
  userId      String
  description String   // normalised: lowercased, trimmed
  category    String   // confirmed category name
  source      String   // "llm_confirmed" | "user_override"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, description])
}
```

---

## 8. Review UI

The `TransactionReviewTable` Client Component is rendered on the CSV import page
after the classify SSE stream completes. It presents all classified months in
collapsible sections.

### Key behaviours

| Behaviour | Detail |
|---|---|
| Category dropdown | Each row has a `<select>` populated from active `ExpenseCategory[]` |
| Override tracking | Changing a dropdown sets `overridden: true`, highlights the row in amber |
| ⚠ unknown merchant flag | Client-side heuristic: short, all-caps description with no known brand token |
| Accept All | Sets all `confirmedCategory = llmCategory`; enables Save button |
| Confirm & Save | POSTs `ConfirmImportRequest` to `/api/csv-import/confirm` |
| Loading state | Spinner while classify SSE is streaming |
| Per-month totals | Header shows transaction count and total debit amount per month |

### Unknown Merchant Heuristic

A lightweight client-side function flags rows that are likely private/local
businesses the LLM may have guessed incorrectly:

```
isLikelyUnknownMerchant(description):
  → words.length <= 4
  AND description == description.toUpperCase()
  AND words[0] not in KNOWN_BRAND_TOKENS
```

`KNOWN_BRAND_TOKENS` is a small static constant (Woolworths, Coles, Netflix, etc.)
co-located in the component. It is not a classification tool — it is a
"please review this row" signal only.

---

## 9. Security & Auth

| Check | Route | Implementation |
|---|---|---|
| Authentication | Both | `auth()` → 401 if no session |
| Session ownership | Both | `session.userId === request user` → 403 |
| Body validation | Both | Zod schemas |
| User isolation | Overrides | `@@unique([userId, description])` — per-user, not global |
| No secrets in responses | Both | Server-side error logging only |

---

## 10. Error Handling & Graceful Degradation

| Scenario | Behaviour |
|---|---|
| LLM call fails (network/rate limit) | Fallback: `llmCategory = tx.description`; SSE `warning` event |
| LLM returns malformed JSON | Same fallback as above |
| `classifyTransactions()` throws | Fallback; per-month `error` SSE event; other months continue |
| `mapExpenseData()` fails on confirm | Month skipped; session status `PARTIAL`; error in response |
| All months fail on confirm | Session status `FAILED`; error in response |
| Session not found at classify time | 404 JSON (before SSE starts) |
| Invalid `ConfirmImportRequest` | 400 JSON with Zod validation errors |

---

## 11. Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AI_API_KEY` | Yes | — | LLM API key |
| `AI_VISION_MODEL` | No | `gpt-4o-mini` | Model for text classification (no vision needed) |
| `AI_PROVIDER` | No | `github` | `github` \| `openai` |
| `AI_BASE_URL` | No | — | Custom base URL for provider |

No new environment variables required.

---

## 12. Related Documents

- [csv-categorisation-llm-classification.md](./csv-categorisation-llm-classification.md) — Feature spec (problem, prompt design, cost estimate)
- [csv-categorisation-llm-classification-lld.md](./csv-categorisation-llm-classification-lld.md) — Low Level Design (implementation detail)
- [csv-import-hld.md](../csv-import/csv-import-hld.md) — Upstream CSV parse pipeline
- [semantic-category-matching-hld.md](../semantic-category-matching/semantic-category-matching-hld.md) — Downstream embedding matcher
- [csv-categorisation-rag-examples.md](../csv-categorisation-rag-examples/csv-categorisation-rag-examples.md) — Phase 2 RAG
