# Semantic Category Matching - Implementation Context & Dependencies

> **Created**: 2026-05-12  
> **Phase**: Pre-implementation planning  
> **Related Specs**: semantic-category-matching-hld.md, semantic-category-matching-lld.md  
> **Dependencies**: CSV Import Phase 2 (completed), AI Image Import (existing),
>                   CSV Categorisation LLM Classification (Phase 1),
>                   CSV Categorisation RAG (Phase 2)

---

## ⚠️ Important Revision: CSV Categorisation Limitation Discovered

> **Revision date**: 2026-05-13
> **Trigger**: Integration testing with real CommBank July 2025 CSV export

### What Was Discovered

Integration testing revealed that the embedding cosine similarity approach **does NOT work** for raw CommBank transaction descriptions passed directly to `matchCategoryWithEmbedding()`.

**Actual similarity scores observed** (far below 0.75 threshold):

| Raw Description | Top Match | Score | Correct Category |
|-----------------|-----------|-------|-----------------|
| `WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441...` | Shopping | 0.27 | Groceries ❌ |
| `NETFLIX.COM Melbourne AU AUS Card xx5441...` | Shopping | 0.24 | Entertainment ❌ |
| `Direct Debit 077380 DEFT PAYMENTS DEFT...` | Cash | 0.30 | Home ❌ |

### Root Cause

Mapping merchant brand names to category names requires **world knowledge** — the model must know that Woolworths is a grocery chain, that Netflix is an entertainment service, and that DEFT PAYMENTS is a strata/rent platform. This knowledge cannot be recovered from cosine similarity between surface text.

`matchCategoryWithEmbedding()` was designed to match already-extracted category labels (e.g., `"grocery shopping"`, `"streaming service"`) against DB category names — which is exactly what the AI Image Import pipeline provides via GPT-4o Vision. The function works correctly and as designed for this purpose (similarity scores of 0.75+ observed).

### The Architectural Bug

The CSV import pipeline in `src/app/api/csv-import/parse/route.ts` was incorrectly bypassing the LLM extraction step, passing `tx.description` directly as `categoryName`:

```typescript
// WRONG — this was always broken; discovered via integration testing
categoryName: tx.description,  // "WOOLWORTHS 1294 HORNSBY NS AUS..."
```

The AI Image Import pipeline works correctly because GPT-4o first extracts a clean category label (`"Groceries"`) before calling `matchCategoryWithEmbedding()`.

### What This Means for This Spec

**The `embedding.service.ts` and `matchCategoryWithEmbedding()` remain correct and valuable.** They are the right tool for the label→DB-category matching step and should not be changed. The 0.75 threshold is correct for their intended use case.

The fix is to add an upstream LLM classification step for CSV imports — not to modify the embedding service.

### Two New Approaches Planned

| Phase | Approach | Document |
|-------|----------|----------|
| Phase 1 (immediate) | LLM Classification — batch prompt to classify raw descriptions | `spec/csv-categorisation-llm-classification/csv-categorisation-llm-classification.md` |
| Phase 2 (long-term) | RAG with User Examples — retrieve past categorised transactions as few-shot context | `spec/csv-categorisation-rag-examples/csv-categorisation-rag-examples.md` |

The `semantic-category-matching` feature (this spec) is a **prerequisite** for both approaches: it handles the final label→DB-category lookup step after the LLM or RAG layer produces a clean category label.

### Pipeline Comparison (Updated)

```
Image Import (WORKS):
  Screenshot → GPT-4o Vision → "grocery shopping" → matchCategoryWithEmbedding() → Groceries ✓

CSV Import (WAS BROKEN):
  Raw description → [skip] → matchCategoryWithEmbedding("WOOLWORTHS 1294...") → 0.27 → wrong ❌

CSV Import (PHASE 1 FIX):
  Raw description → LLM classify → "Groceries" → matchCategoryWithEmbedding("Groceries") → ✓

CSV Import (PHASE 2 TARGET):
  Raw description → pgvector retrieve similar past txns → "Groceries" (direct or LLM few-shot)
                 → matchCategoryWithEmbedding("Groceries") → ✓
```



Semantic embedding-based category matching replaces the static `SEMANTIC_MAPPINGS` dictionary with AI embeddings via OpenAI's `text-embedding-3-small` model. This enables automatic, accurate categorization of transactions for two input pipelines:

1. **AI Image Import**: Screenshot-extracted category labels → Embeddings → Category matching
2. **CSV/OFX Import (Primary)**: Raw merchant transaction descriptions → Embeddings → Category matching

**Success Criteria**:
- >95% correct matching on common banking terms
- Latency < 200ms per entry
- In-memory caching (no vector DB)
- Graceful fallback to Levenshtein fuzzy matching

---

## 2. Files to Create/Modify

### 2.1 New Service Files

#### `src/server/services/ai-import/embedding.service.ts` (NEW)
- **Role**: Core embedding generation, caching, and cosine similarity computation
- **Exports**:
  - `getEmbeddingProvider()` — Factory returns embedding model (mirrors `getAIProvider()`)
  - `cosineSimilarity(a, b)` — Pure function for vector similarity
  - `ensureCategoryEmbeddings(categories)` — Lazy-load and cache category embeddings
  - `findBestCategoryMatch(text, categories)` — Embed text and find highest-similarity category
- **Dependencies**:
  - `ai` package (v0.x)
  - `@ai-sdk/openai`
  - `Prisma.expenseCategory.findMany()` for all categories
  - `AIUsageLog` model for token tracking

**Key Concerns**:
- Module-level singleton cache (`CachedEmbeddings` interface)
- Fingerprint-based cache invalidation (detects category changes)
- Concurrent lazy-initialization (lock pattern to prevent parallel API calls)

---

#### `src/server/services/ai-import/category-matcher.service.ts` (EXISTING - MODIFY)
- **Current State**: Uses hardcoded `SEMANTIC_MAPPINGS` + Levenshtein fallback
- **Changes**:
  - Replace dictionary lookup with `findBestCategoryMatch(text)` from embedding service
  - Add threshold check: only match if similarity > 0.75 (threshold TBD)
  - Keep Levenshtein fallback for embedding API failures
  - Update `matchCategoryWithSemantics()` function signature (may need to handle async if not already)
- **Dependencies**:
  - New embedding service
  - Existing `Prisma.expenseCategory.findMany()` calls

---

### 2.2 Integration Points (No File Changes, Configuration Only)

#### `.env-example` (UPDATE)
- Add `AI_EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- Verify `AI_PROVIDER` and `AI_API_KEY` already documented

---

## 3. System Integration Map

### 3.1 CSV Import Pipeline Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  CSV Upload & Parse Flow (Phase 2 - Already Implemented)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/csv-import/upload/route.ts                                │
│  ├─ Parse CSV, create AIImportSession                           │
│  └─ Store raw transaction descriptions                          │
│                                                                 │
│  /api/csv-import/parse/route.ts (SSE Streaming)                 │
│  ├─ Loop through transactions by month                          │
│  ├─ Call mapExpenseData()                                       │
│  │  └─ [NEW INTEGRATION POINT]                                  │
│  │     findBestCategoryMatch(merchantDescription)               │
│  │     ├─ Embed merchant text                                   │
│  │     ├─ Compare against cached category embeddings            │
│  │     └─ Return best match or "Other"                          │
│  ├─ Create ExpenseEntry with matched category                  │
│  └─ Emit SSE events (progress, saved, error)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**File**: `src/server/services/ai-import/expense-mapper.service.ts`
- **Current**: `mapExpenseData()` iterates transactions, categorizes each
- **Change**: Pass `merchantDescription` to embedding-based matcher instead of hardcoded dictionary
- **Async**: May need to verify if `mapExpenseData()` is already async (likely yes if calling embeddings API)

---

### 3.2 AI Image Import Pipeline Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Image Import Flow (Existing - Backward Compatible)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/ai-import/parse/route.ts                                  │
│  ├─ Call GPT-4o Vision to extract category labels               │
│  └─ For each extracted label:                                   │
│     └─ Call matchCategoryWithSemantics(label)                   │
│        └─ [BEHAVIOR CHANGE]                                     │
│           Now uses embeddings instead of SEMANTIC_MAPPINGS      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**File**: `src/server/services/ai-import/category-matcher.service.ts`
- **Current**: `matchCategoryWithSemantics(extractedLabel)` uses static dictionary
- **Change**: Use `findBestCategoryMatch(extractedLabel)` with embeddings
- **Backward Compat**: Keep existing behavior for fallback

---

### 3.3 Database Schema Requirements

**No Prisma schema changes needed** — Uses existing models:

| Model | Usage |
|-------|-------|
| `ExpenseCategory` | List of all possible categories for embedding generation |
| `AIUsageLog` | Log embedding API token usage (importType=EXPENSE, promptTokens, completionTokens, totalTokens, estimatedCostUSD) |
| `AIImportSession` | Already tracks import metadata |
| `Expense` / `ExpenseEntry` | Already store categorization results |

---

## 4. Unresolved Assumptions & Questions

### 4.1 Cost Calculation for Token Usage

**DECISION**: Calculate inline in embedding service based on token count and fixed pricing model.

**Implementation**:
- Use OpenAI's pricing: **text-embedding-3-small = $0.02 per 1M input tokens**
- Formula: `estimatedCostUSD = (promptTokens / 1_000_000) * 0.02`
- Calculate in `embedding.service.ts` and return cost with token usage object
- Example: 1,000 tokens = $0.00002

**Location**: `embedding.service.ts` exports `AITokenUsage` type with embedded `estimatedCostUSD`

---

### 4.2 Cache Invalidation Strategy

**DECISION**: Use webhook from admin UI to trigger cache invalidation (ideal approach).

**Implementation**:
- Create `POST /api/admin/cache/invalidate-embeddings` endpoint
- Admin UI triggers this when creating/renaming/deleting ExpenseCategory
- Endpoint clears module-level cache singleton
- Also implements fingerprint check as safety net in `ensureCategoryEmbeddings()`

**Fallback**: If admin forgets to call webhook, fingerprint mismatch on next parse will auto-regenerate (slower but safe)

**Location**: 
- Endpoint: `src/app/api/admin/cache/invalidate-embeddings/route.ts`
- Cache clear: `embedding.service.ts` exports `clearEmbeddingCache()` function

---

### 4.3 Fallback & Error Handling Strategy

**DECISION**: Retry 3 times with exponential backoff, then fall back to Levenshtein fuzzy matching.

**Implementation**:
- Retry logic: `[1s, 2s, 4s]` exponential backoff
- Covers: API timeout, rate limits, 500 errors, invalid responses
- After 3 retries fail: silently fall back to Levenshtein
- Per-transaction fallback: One failed embedding doesn't block other transactions in SSE stream

**Retrying Function**: `embedding.service.ts` exports `findBestCategoryMatchWithRetry(text, categories, maxRetries=3)`

**Example Flow**:
```
Embedding attempt 1 → timeout → wait 1s
Embedding attempt 2 → 429 rate limit → wait 2s
Embedding attempt 3 → 500 error → wait 4s
All failed → Use Levenshtein on merchant text
Emit SSE warning (see 4.6)
```

---

### 4.4 Memory & Performance Constraints

**ASSUMPTION CONFIRMED**: In-memory embedding cache is acceptable.

**Calculation**:
- ~50 categories × 384 dimensions (text-embedding-3-small) × 4 bytes (float32) = ~76 KB
- **Verdict**: Negligible memory footprint ✅

**Scale Limits**:
- Current: ~50 categories (default) = ~76 KB
- Future (custom categories): Up to 1000 categories = ~1.5 MB (still acceptable)
- No pagination needed; load all category embeddings on cache init

---

### 4.5 API Rate Limiting

**ASSUMPTION**: GitHub Models API (`models.inference.ai.azure.com`) has rate limits but caching mitigates most.

**Mitigation Strategy**:
- **Cache hit rate**: Most requests hit category cache (reused across all users)
- **Cold start**: First parse request takes 1-2s for category embedding init (acceptable)
- **Retry logic**: 3-retry exponential backoff handles transient rate limits (see 4.3)
- **Monitor**: Log all embedding API failures to detect if rate limits are chronic

**No client-side rate limiter needed** — cache + retry logic sufficient

---

### 4.6 Similarity Threshold for Matching

**DECISION**: Minimum cosine similarity = **0.75** (moderate-to-high similarity).

**Rationale**:
- `<0.5` = likely false positive (unrelated terms)
- `0.5–0.7` = ambiguous, defer to fuzzy match
- `0.7+` = likely correct
- `0.75` = proven threshold in AI/ML embedding applications

**Implementation**: `embedding.service.ts` constant
```typescript
const SIMILARITY_THRESHOLD = 0.75;
```

**Post-launch Validation**: Monitor accuracy on real data; adjust if needed

> **⚠️ Revision (2026-05-13)**: The 0.75 threshold is correct and proven **for
> already-extracted category labels** (e.g. `"grocery shopping"`, `"streaming"`,
> `"chemist"`). It **cannot** be applied to raw bank transaction descriptions regardless
> of threshold value — even a threshold of 0.10 would return wrong categories, because
> the fundamental problem is that brand-name-to-category mapping requires world knowledge
> unavailable through text similarity alone. See the revision notice above for full
> context. The embedding service is not the right tool for classifying raw descriptions;
> an upstream LLM classification step is required (see Phase 1 spec).

---

### 4.7 Concurrency & Initialization Lock

**DECISION**: Implement concurrency lock to prevent duplicate initialization API calls.

**Implementation**:
- Use **Promise-based lock** at module level in `embedding.service.ts`
- Pattern: Check if initialization Promise exists, else create and cache it
- Multiple requests await the same Promise (no duplicate API calls)

**Code Pattern**:
```typescript
let initializationPromise: Promise<AITokenUsage> | null = null;

export async function ensureCategoryEmbeddings() {
  if (initializationPromise) {
    return initializationPromise; // Await existing init
  }
  initializationPromise = performEmbeddingInit();
  return initializationPromise;
}
```

**Benefit**: Saves API calls and cost during high-concurrency cold starts

---

### 4.8 Backward Compatibility & Historical Re-matching

**DECISION**: Implement batch re-matching feature for historical imports.

**Scope**: Separate from main embedding feature; can be implemented Phase 2.

**Implementation**:
- Create `POST /api/admin/expenses/re-match-categories` endpoint
- Takes list of ExpenseEntry IDs (or filters like "where category = 'Other'")
- Uses embedding-based matcher to recategorize
- Returns before/after category changes
- Writes to ExpenseEntry.category field (overwrites old match)
- Logs to AIUsageLog for cost tracking

**User Experience**:
- Admin can re-match all "Other" categorized expenses: `/api/admin/expenses/re-match-categories?filter=category_eq_other`
- Or target specific imports: `/api/admin/expenses/re-match-categories?importSessionId=abc123`

**Phase 2 (Future)**: May add user-facing UI for this

---

## 5. Implementation Dependency Graph

### 5.1 Sequential Order (Blockers)

```
1. embedding.service.ts
   └─ Pure logic: cosineSimilarity(), getEmbeddingProvider()
      └─ Can write tests without AI API (mock)

2. category-matcher.service.ts (MODIFY)
   └─ Depends on embedding.service
      └─ Integration test can mock embedding API

3. expense-mapper.service.ts (VERIFY)
   └─ Already integrates with category matcher
      └─ No changes needed if matcher interface unchanged

4. /api/csv-import/parse/route.ts (VERIFY)
   └─ Already calls mapExpenseData()
      └─ Should work automatically if expense-mapper returns correct categories

5. /api/ai-import/parse/route.ts (VERIFY)
   └─ Already calls matchCategoryWithSemantics()
      └─ Should work automatically with new embedding-based logic
```

### 5.2 Testing Dependencies

```
Unit Tests:
├─ embedding.service.test.ts
│  ├─ cosineSimilarity() [no mocks]
│  ├─ getEmbeddingProvider() [mock AI SDK]
│  └─ ensureCategoryEmbeddings() [mock Prisma + AI SDK]
│
├─ category-matcher.test.ts [MODIFY]
│  ├─ matchCategoryWithSemantics() [mock embedding service]
│  └─ Fallback logic [mock API failure]
│
└─ Integration Tests:
   ├─ csv-import-parse.test.ts [VERIFY]
   │  └─ End-to-end: CSV → embeddings → categories
   │
   └─ ai-import-parse.test.ts [VERIFY]
      └─ End-to-end: Screenshot → embeddings → categories
```

---

## 8. Resolved Decisions Summary

All 8 unresolved assumptions have been clarified with the following decisions:

| # | Assumption | Decision | Implementation Note |
|---|-----------|----------|---------------------|
| 1 | Token cost calculation | Calculate inline with $0.02/1M pricing | Formula: `(tokens / 1M) * 0.02` in embedding service |
| 2 | Cache invalidation trigger | Webhook from admin UI | New endpoint: `POST /api/admin/cache/invalidate-embeddings` |
| 3 | Embedding API failure handling | Retry 3x with 1s/2s/4s backoff, then fuzzy match | Per-transaction fallback in parse route |
| 4 | User notification on fallback | Emit SSE warning event | New event type: `categorization_degraded` |
| 5 | Similarity threshold | 0.75 cosine similarity | Module constant in embedding service |
| 6 | Concurrency lock on init | Yes, use Promise-based lock | Prevents duplicate API calls on cold start |
| 7 | Memory constraints | Acceptable (<1.5 MB for 1000 categories) | No pagination needed |
| 8 | Historical re-matching | Yes, implement Phase 2 feature | New endpoint: `POST /api/admin/expenses/re-match-categories` |

---

## 8. Implementation File Checklist (Updated)

- [ ] `src/server/services/ai-import/embedding.service.ts` — **NEW**
  - Includes: Provider factory, cosine similarity, category cache, retry logic, cost calculation, concurrency lock
  
- [ ] `src/server/services/ai-import/category-matcher.service.ts` — **MODIFY**
  - Replace `SEMANTIC_MAPPINGS` with embedding-based matching
  - Update signature if needed for async operations
  
- [ ] `src/app/api/admin/cache/invalidate-embeddings/route.ts` — **NEW**
  - Webhook endpoint to clear embedding cache on category updates
  
- [ ] `src/app/api/admin/expenses/re-match-categories/route.ts` — **NEW (Phase 2)**
  - Batch re-matching for historical imports
  
- [ ] `src/__tests__/unit/embedding.service.test.ts` — **NEW (TDD)**
  - Tests: cosineSimilarity, retry logic, cache behavior, concurrency lock, cost calculation
  
- [ ] `src/__tests__/unit/category-matcher.test.ts` — **MODIFY**
  - Update tests to use embedding service (mocked)
  
- [ ] `src/__tests__/integration/csv-import-parse.test.ts` — **VERIFY**
  - Ensure SSE events include new `categorization_degraded` event type
  
- [ ] `src/__tests__/integration/ai-import-parse.test.ts` — **VERIFY**
  - Ensure backward compatibility with existing behavior
  
- [ ] `.env-example` — **UPDATE**
  - Add `AI_EMBEDDING_MODEL=text-embedding-3-small`

---

## 9. Risk & Mitigation Summary (Updated)

| Risk | Impact | Mitigation (Post-Decision) |
|------|--------|----------|
| **Embedding API latency** | 200ms/entry × 1000 entries = 200s | Cache hits on subsequent parses; retry handles transient failures |
| **Cache invalidation timing** | Stale embeddings if categories change | Webhook trigger + fingerprint safety net ensures eventual consistency |
| **Concurrent cold-start requests** | Duplicate API calls on first parse | Promise-based concurrency lock ensures single API call |
| **Embedding API failures** | Transactions stuck mid-parse | 3-retry exponential backoff (1/2/4s), then fuzzy match fallback + SSE warning |
| **Memory scaling** | OOM on custom category explosion | Acceptable up to 1000 categories (~1.5 MB); monitor and alert if needed |
| **False negatives** | "Other" categorized due to low similarity | Threshold 0.75 balanced; fallback to fuzzy match if embedding inconclusive |
| **User confusion on degraded mode** | Silent fallback causes user distrust | SSE warning event keeps user informed when fuzzy match is used |

---

## 10. Success Metrics (Post-Implementation)

- [ ] >95% accuracy on test dataset (existing + new banking terms)
- [ ] Median latency < 200ms per transaction (with cache hit)
- [ ] p99 latency < 1000ms (accounting for API+retry variability)
- [ ] Cold-start embedding init < 2 seconds
- [ ] Graceful fallback triggered <1% of requests (API uptime target)
- [ ] Webhook cache invalidation works on category create/rename/delete
- [ ] SSE warning event emitted when fallback is used

---

## 11. Next Steps (All Assumptions Resolved)

1. ✅ **Assumptions Clarified** (Sections 4.1–4.8): All 8 decisions documented
2. **Implement Unit Tests First** (TDD): embedding.service.test.ts with mocked AI SDK
3. **Implement Core Service**: embedding.service.ts (with retry logic, cache, concurrency lock, cost calc)
4. **Update Category Matcher**: Replace SEMANTIC_MAPPINGS with embedding-based matching
5. **Create Admin Cache Endpoint**: `POST /api/admin/cache/invalidate-embeddings` (webhook trigger)
6. **Update Parse Routes**: Add `categorization_degraded` SSE event type
7. **Run Integration Tests**: Verify CSV and AI Image Import pipelines still work
8. **Load Testing**: Validate performance with large CSVs (500–1000 rows)
9. **Phase 2 (Future)**: Implement batch re-matching endpoint
