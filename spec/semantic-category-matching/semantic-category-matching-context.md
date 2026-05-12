# Semantic Category Matching - Implementation Context & Dependencies

> **Created**: 2026-05-12  
> **Phase**: Pre-implementation planning  
> **Related Specs**: semantic-category-matching-hld.md, semantic-category-matching-lld.md  
> **Dependencies**: CSV Import Phase 2 (completed), AI Image Import (existing)

---

## 1. Feature Overview

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

**Question**: How should `estimatedCostUSD` be calculated in `AIUsageLog`?

- **Current State** (CSV Phase 2): Set to 0 in parse route
- **Options**:
  - A) Calculate inline in embedding service based on token count and pricing
  - B) Defer to separate billing service
  - C) Use fixed cost per embedding (e.g., $0.02 per 1M tokens)

**Decision Required Before Implementation**: Where does cost calculation live?

---

### 4.2 Cache Invalidation Strategy

**Question**: When categories change in the database, how do we know to regenerate embeddings?

- **Current Approach**: Fingerprint-based (sorted category names → hash)
- **Trigger Points**:
  - Admin creates new ExpenseCategory
  - Admin renames ExpenseCategory
  - Admin deletes ExpenseCategory

**Decision Required**: 
- Do we poll the database on every parse request to check fingerprint?
- Or require manual cache clear on admin action (e.g., webhook, admin endpoint)?
- What's acceptable latency for detecting category changes?

---

### 4.3 Fallback & Error Handling Strategy

**Question**: If embedding API fails during a parse request, what happens?

- **Current Spec**: "Graceful degradation — fall back to Levenshtein fuzzy matching"
- **Scenarios**:
  - API timeout (>5s)
  - Rate limit exceeded
  - 500 error from AI provider
  - Invalid embedding response

**Decision Required**:
- Retry logic: How many retries? Backoff strategy?
- Timeout threshold: When to abandon API call and use fuzzy match?
- SSE event: Emit warning to user if using degraded matching?

---

### 4.4 Memory & Performance Constraints

**Question**: Is in-memory embedding cache acceptable for scale?

**Calculation**:
- ~50 categories × 384 dimensions (text-embedding-3-small) × 4 bytes (float32) = ~76 KB
- **Verdict**: Negligible memory footprint ✅

**Follow-up**: 
- If users have custom categories (future feature), could we exceed 1000 categories?
- Should we implement pagination/lazy-loading for very large category sets?

---

### 4.5 API Rate Limiting

**Question**: Does GitHub Models API have rate limits?

**Current Info**: Using `https://models.inference.ai.azure.com` endpoint

**Decision Required**:
- What are the rate limits for `text-embedding-3-small`?
- Should we implement client-side rate limiting or retry-with-backoff?
- Does embedding cache help mitigate this? (Yes — hits cache for same category set)

---

### 4.6 Similarity Threshold for Matching

**Question**: What minimum cosine similarity (0–1) triggers a successful match?

- **Proposed**: 0.75 (moderate-to-high similarity)
- **Rationale**: 
  - <0.5 = likely false positive (e.g., "Pharmacy" vs "Pharmacy" different merchant formats)
  - 0.5–0.7 = ambiguous, defer to fuzzy match
  - 0.7+ = likely correct

**Decision Required**: Validate threshold with test data before deployment

---

### 4.7 Concurrency & Initialization Lock

**Question**: Should `ensureCategoryEmbeddings()` use a lock to prevent parallel API calls?

- **Scenario**: Multiple requests hit `/api/csv-import/parse` simultaneously, both try to initialize embeddings
- **Solution**: Module-level lock (e.g., `Promise`-based or `AsyncLock`)
- **Trade-off**: Adds complexity but prevents duplicate API calls

**Decision Required**: Is this necessary, or accept duplicate initialization cost?

---

### 4.8 Backward Compatibility with Existing Imports

**Question**: Should we re-match historical expense records with embeddings?

- **Spec**: "Re-matching historical imports: Existing expense records stay as-is. Only new imports use embeddings."
- **Implication**: Old imports labeled "Other" stay "Other" unless user manually re-categorizes
- **Future**: Could implement batch re-matching as separate feature

**Assumption**: Accept this limitation ✅

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

## 6. Risk & Mitigation Summary

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Embedding API latency** | 200ms/entry × 1000 entries = 200s parse time | Cache hits + parallel batch embedding (if API supports) |
| **Cache eviction during request** | Category changes mid-parse | Atomic fingerprint check at parse start |
| **Concurrent API calls** | Double billing if not locked | Lazy-init with concurrency lock |
| **API failures** | Transactions fail to categorize | Graceful fallback to Levenshtein |
| **Memory spike** | OOM on large category sets | Monitor memory; threshold alert |
| **Rate limiting** | Requests rejected by API | Implement retry-with-backoff |

---

## 7. Success Metrics (Post-Implementation)

- [ ] >95% accuracy on test dataset (existing + new banking terms)
- [ ] Median latency < 200ms per transaction
- [ ] p99 latency < 500ms (accounting for API variability)
- [ ] Zero OOM events on production
- [ ] Graceful fallback triggered <1% of requests (API uptime target)

---

## 8. File Checklist for Implementation

- [ ] `src/server/services/ai-import/embedding.service.ts` — **NEW**
- [ ] `src/server/services/ai-import/category-matcher.service.ts` — **MODIFY** (replace SEMANTIC_MAPPINGS)
- [ ] `src/server/services/ai-import/expense-mapper.service.ts` — **VERIFY** (should work if matcher signature unchanged)
- [ ] `src/__tests__/unit/embedding.service.test.ts` — **NEW** (TDD)
- [ ] `src/__tests__/unit/category-matcher.test.ts` — **MODIFY** (update existing tests)
- [ ] `src/__tests__/integration/csv-import-parse.test.ts` — **VERIFY** (should pass with embeddings)
- [ ] `src/__tests__/integration/ai-import-parse.test.ts` — **VERIFY** (should pass with embeddings)
- [ ] `.env-example` — **UPDATE** (add AI_EMBEDDING_MODEL)

---

## 9. Next Steps

1. **Resolve Assumptions** (Sections 4.1–4.8): Clarify decisions before coding
2. **Implement Unit Tests First** (TDD): embedding.service.test.ts with mocked AI SDK
3. **Implement Core Service**: embedding.service.ts
4. **Update Category Matcher**: Replace SEMANTIC_MAPPINGS logic
5. **Run Integration Tests**: Verify CSV and AI Image Import pipelines still work
6. **Load Testing**: Validate performance against large CSVs (500–1000 rows)
7. **Deployment**: Follow existing CI/CD pipeline; monitor embedding API usage
