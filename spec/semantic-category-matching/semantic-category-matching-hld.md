# High Level Design: Semantic Embedding-based Category Matching

> **Version**: 1.1  
> **Date**: 2026-05-12  
> **Status**: Ready for Implementation  
> **Related**: [AI Image Import PRD](../ai-image-import/ai-image-import-prd.md), [AI Usage Logging HLD](../ai-usage-logging/ai-usage-logging-hld.md)
> **Context Mapping**: [Semantic Category Matching - Context & Dependencies](./semantic-category-matching-context.md)

---

## 1. Problem Statement

### 1.1 Original Context: AI Image Import

The AI Image Import feature was designed to extract expense category names from banking app screenshots using GPT-4o vision. After extraction, `matchCategoryWithSemantics()` in `src/server/services/ai-import/category-matcher.service.ts` maps these free-text labels to the application's `ExpenseCategory` records.

### 1.2 Updated Context: CSV / OFX Transaction Import (Primary Path)

CommBank (and other banking apps) enforce `FLAG_SECURE` / screenshot restrictions in their native apps, blocking the image import approach for spending summaries. The practical alternative is exporting transaction history as **CSV or OFX files** from the bank's web interface.

However, CSV/OFX exports contain **raw merchant transaction descriptions** (e.g. `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441"`, `"CHEMIST WAREHOUSE HORNSBY NS"`, `"TRANSPORTFORNSW TAP SYDNEY"`) — **not** pre-labelled category names. There is no category column in the exported data.

The semantic matching layer therefore serves two input paths:

| Input Source                  | Input Type                       | Example Input                                                    | Expected Category |
| ----------------------------- | -------------------------------- | ---------------------------------------------------------------- | ----------------- |
| AI Image Import (screenshots) | Extracted category label         | `"chemist"`, `"dining"`                                          | Healthcare, Food  |
| CSV / OFX Import              | Merchant transaction description | `"CHEMIST WAREHOUSE HORNSBY NS"`, `"WOOLWORTHS 1294 HORNSBY NS"` | Healthcare, Food  |

Both paths feed into the same embedding-based matching engine. The CSV/OFX path is the **primary use case** for CommBank users.

**Current implementation limitations:**

| Issue                    | Detail                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Hardcoded dictionary** | `SEMANTIC_MAPPINGS` contains ~40 hand-curated aliases (e.g., `petrol → Transportation`). Any term not in the dictionary falls through to Levenshtein fuzzy matching, which fails on semantic synonyms. |
| **Poor coverage**        | Terms like "chemist", "gym", "vet", "daycare", "tolls", "subscriptions", "childcare", "strata" have no mapping and no string-similarity to their correct category.                                     |
| **Maintenance burden**   | Every new banking app variation or category alias requires a code change, review, and deploy.                                                                                                          |
| **No adaptability**      | The system cannot handle new patterns — it is purely static. Adding a new `ExpenseCategory` in the database still requires updating the hardcoded dictionary in code.                                  |

**Example failures with current system:**

_From AI Image Import (screenshot-extracted labels):_

| Extracted Term | Expected Category     | Actual Result         |
| -------------- | --------------------- | --------------------- |
| `"chemist"`    | Healthcare            | ❌ No match → "Other" |
| `"gym"`        | Personal / Healthcare | ❌ No match → "Other" |
| `"tolls"`      | Transportation        | ❌ No match → "Other" |
| `"childcare"`  | Education             | ❌ No match → "Other" |
| `"strata"`     | Housing               | ❌ No match → "Other" |
| `"Netflix"`    | Entertainment         | ❌ No match → "Other" |

_From CSV / OFX Import (raw merchant descriptions):_

| Merchant Description                           | Expected Category | Actual Result         |
| ---------------------------------------------- | ----------------- | --------------------- |
| `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441"` | Food              | ❌ No match → "Other" |
| `"CHEMIST WAREHOUSE HORNSBY NS"`               | Healthcare        | ❌ No match → "Other" |
| `"TRANSPORTFORNSW TAP SYDNEY"`                 | Transportation    | ❌ No match → "Other" |
| `"TPG INTERNET PTY LTD NORTH RYDE"`            | Utilities         | ❌ No match → "Other" |
| `"DEFT PAYMENTS DEFT 28408579"`                | Housing           | ❌ No match → "Other" |
| `"FLEXISCHOOLS*ACC TOPUP"`                     | Education         | ❌ No match → "Other" |
| `"MICROSOFT*XBOX MSBILL.INFO AU"`              | Entertainment     | ❌ No match → "Other" |
| `"ALLIANZ INSURE C1 SYDNEY NS"`                | Insurance         | ❌ No match → "Other" |

## 2. Goals

| #   | Goal                                                                                                                  | Audience |
| --- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| G1  | Replace the static `SEMANTIC_MAPPINGS` dictionary with AI embedding-based semantic matching                           | System   |
| G2  | Achieve >95% correct category matching on common banking app terms without any hardcoded aliases                      | System   |
| G3  | Keep matching latency under 200ms per extraction entry (embedding lookup + cosine similarity)                         | System   |
| G4  | Reuse existing `AI_API_KEY` and `AI_PROVIDER` configuration — no new credentials required                             | DevOps   |
| G5  | Track embedding token usage in the existing `AIUsageLog` infrastructure                                               | System   |
| G6  | Cache category embeddings in memory to minimise API calls — regenerate only when categories change or server restarts | System   |
| G7  | Graceful degradation — if embedding API is unavailable, fall back to existing Levenshtein fuzzy matching              | System   |

## 3. Non-Goals (Out of Scope)

- **Vector database (pgvector, Pinecone, etc.)**: Category count is small (~20–50). In-memory cosine similarity is sufficient. No vector DB needed.
- **User-facing UI changes**: This is a backend pipeline improvement. No new pages or components.
- **Custom fine-tuned embedding model**: We use OpenAI's `text-embedding-3-small` via the existing provider.
- **Bank asset account matching**: This HLD covers expense category matching only. The `bestMatchAccount()` function in `bank-asset-mapper.service.ts` is a separate concern.
- **Re-matching historical imports**: Existing expense records stay as-is. Only new imports use embeddings.
- **Multi-language support**: Category names and extracted terms are assumed to be in English.

## 4. Architecture Overview

Two input pipelines feed the shared Embedding Layer. The CSV/OFX pipeline is the primary path for CommBank users where screenshot capture is blocked.

```
┌──────────────────────────────────────────────────────────────────────┐
│              Path A: AI Image Import Pipeline                        │
│              (screenshots, where permitted by banking app)           │
│                                                                      │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐   │
│  │  Upload API  │──▶│  Parse Route     │──▶│  Expense Mapper    │   │
│  │  /api/ai-    │   │  /api/ai-        │   │  mapExpenseData()  │   │
│  │  import/     │   │  import/parse    │   │         │          │   │
│  │  upload      │   │  GPT-4o Vision   │   │         ▼          │   │
│  └──────────────┘   │  → entries[]     │   │  matchWithEmbed()  │   │
│                     └──────────────────┘   └────────┬───────────┘   │
└────────────────────────────────────────────────────┼───────────────┘
                                                     │
┌────────────────────────────────────────────────────┼───────────────┐
│              Path B: CSV / OFX Import Pipeline      │               │
│              (primary path for CommBank — no screenshot needed)     │
│                                                                      │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────┐   │
│  │  Upload API  │──▶│  Parse Route     │──▶│  Expense Mapper    │   │
│  │  /api/csv-   │   │  /api/csv-       │   │  mapExpenseData()  │   │
│  │  import/     │   │  import/parse    │   │         │          │   │
│  │  upload      │   │  CSV/OFX parser  │   │         ▼          │   │
│  └──────────────┘   │  → transactions[]│   │  matchWithEmbed()  │   │
│                     └──────────────────┘   └────────┬───────────┘   │
└────────────────────────────────────────────────────┼───────────────┘
                                                     │
│  ┌──────────────────────────────────────────────────┼────────────┐ │
│  │              Embedding Layer (SHARED)             │            │ │
│  │                                                   ▼            │ │
│  │  ┌────────────────────┐    ┌─────────────────────────────┐    │ │
│  │  │ Category Embedding │    │  Embedding Matching Engine  │    │ │
│  │  │ Cache (in-memory)  │◄──│                             │    │ │
│  │  │                    │    │  1. embed(extractedName)    │    │ │
│  │  │  category → float[]│    │  2. cosineSimilarity()      │    │ │
│  │  │  (1536 dims each)  │    │  3. threshold check (≥0.75) │    │ │
│  │  └────────┬───────────┘    └──────────────┬──────────────┘    │ │
│  │           │                                │                   │ │
│  │           │ cache miss                     │ every query       │ │
│  │           ▼                                ▼                   │ │
│  │  ┌────────────────────────────────────────────┐               │ │
│  │  │        AI SDK embed() / embedMany()        │               │ │
│  │  │        text-embedding-3-small (1536d)      │               │ │
│  │  │        via AI_API_KEY + AI_PROVIDER         │               │ │
│  │  └────────────────────────────────────────────┘               │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────┐                │
│  │               AIUsageLog (DB)                   │                │
│  │  Track embedding token usage per import session │                │
│  └────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. Component Inventory

### 5.1 New Server-Side Services

| Service           | File                                                 | Purpose                                                                                                                        |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Embedding Service | `src/server/services/ai-import/embedding.service.ts` | Generate embeddings via AI SDK `embed()` / `embedMany()`, manage in-memory category embedding cache, compute cosine similarity |

### 5.2 Modified Files

| File                                                        | Change                                                                                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/services/ai-import/category-matcher.service.ts` | Add new async `matchCategoryWithEmbedding()` function. Remove `SEMANTIC_MAPPINGS` dictionary and `matchCategoryWithSemantics()`. Keep `matchCategory()` (Levenshtein) as fallback. |
| `src/server/services/ai-import/expense-mapper.service.ts`   | Update import from `matchCategoryWithSemantics` → `matchCategoryWithEmbedding`; make matching call `await`-ed (now async)                                                          |
| `src/server/services/ai-import/_types.ts`                   | Add `EmbeddingMatchResult` interface for structured match results with similarity score                                                                                            |
| `src/constants/ai-pricing.ts`                               | Add `text-embedding-3-small` pricing constants (`EMBEDDING_INPUT_COST_PER_TOKEN`)                                                                                                  |
| `src/app/api/ai-import/parse/route.ts`                      | Accumulate and log embedding token usage alongside vision token usage in `AIUsageLog` (image import path)                                                                          |
| `src/app/api/csv-import/parse/route.ts`                     | New route for CSV/OFX import — calls `expense-mapper` with parsed merchant descriptions; logs embedding token usage                                                                |
| `.env-example`                                              | Document new optional env vars: `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_SIMILARITY_THRESHOLD`                                                                                          |

### 5.3 No New UI Components

This feature is entirely backend. No new pages, routes, or client components are required.

### 5.4 No Database Schema Changes

No new Prisma models or migrations needed. Embedding token usage is logged to the existing `AIUsageLog` model with `model: 'text-embedding-3-small'`.

## 6. Data Flow

### 6.1 Category Embedding Initialization (Lazy, Cached)

```
First import request after server start (or after cache invalidation):
  → expense-mapper fetches all active ExpenseCategory names from DB
  → embedding.service.embedCategories(categoryNames)
  → AI SDK: embedMany({ model: embeddingModel, values: categoryNames })
  → Returns { embeddings: float[][], usage: { tokens } }
  → Store in module-level Map<string, number[]> keyed by category name
  → Return token usage for logging
  → Cache remains valid until server restart or explicit clearEmbeddingCache() call
```

### 6.2 Per-Entry Matching (During Import)

```
Input: either (A) category label from GPT-4o vision, or (B) raw merchant description from CSV/OFX
  → matchCategoryWithEmbedding(inputText, availableCategories)

  Tiered strategy:
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Priority 1: Exact match (case-insensitive)               < 1ms     │
  │   "Food" → "Food"  ✓  (image path only — CSV never gives exact)   │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Priority 2: Substring match (bidirectional)               < 1ms    │
  │   "Food & Drink" → "Food"  ✓                                       │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Priority 3: Embedding cosine similarity                 50-150ms   │
  │   embed(inputText) via AI SDK                                       │
  │   Compare against all cached category embeddings                    │
  │   Best match with similarity ≥ threshold → return                   │
  │   "chemist" → "Healthcare" (0.82)  ✓  (image path)                 │
  │   "CHEMIST WAREHOUSE HORNSBY NS" → "Healthcare" (0.79)  ✓  (CSV)  │
  │   "TRANSPORTFORNSW TAP SYDNEY" → "Transportation" (0.81)  ✓  (CSV)│
  │   "DEFT PAYMENTS DEFT 28408579" → "Housing" (0.76)  ✓  (CSV)      │
  ├─────────────────────────────────────────────────────────────────────┤
  │ Priority 4: Fallback to "Other"                           < 1ms    │
  │   No match above threshold → return null                            │
  │   expense-mapper assigns "Other" category                           │
  └─────────────────────────────────────────────────────────────────────┘
```

> **Note — CSV merchant descriptions vs category names**: Raw merchant names like `"WOOLWORTHS 1294 HORNSBY NS AUS Card xx5441"` contain location/card noise. The embedding model handles this well because `text-embedding-3-small` encodes semantic meaning, not surface patterns. In practice, `"WOOLWORTHS"` embeds closest to `"Food"` regardless of trailing location/card text.

### 6.3 Error / Degradation Flow

```
If embedding API call fails (network error, API key invalid, etc.):
  → Catch error in embedding.service
  → Log warning: "[EmbeddingService] Embedding unavailable, falling back to fuzzy matching"
  → Fall back to matchCategory() (existing Levenshtein fuzzy matching)
  → Import continues without interruption
```

## 7. Token Usage and Cost

| Operation                           | Estimated Tokens | Cost (text-embedding-3-small @ $0.02/1M tokens) |
| ----------------------------------- | ---------------- | ----------------------------------------------- |
| Embed all categories (~20 names)    | ~30 tokens       | ~$0.0000006                                     |
| Embed one extracted name            | ~3 tokens        | ~$0.00000006                                    |
| Typical import session (10 entries) | ~60 tokens total | ~$0.0000012                                     |
| 1,000 import sessions               | ~60,000 tokens   | ~$0.0012                                        |

Embedding costs are effectively negligible — approximately 1/2000th of the vision API cost per import.

## 8. Caching Strategy

| Aspect               | Decision                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cache location**   | Module-level `Map<string, number[]>` in `embedding.service.ts`                                                                                                                 |
| **Cache key**        | Sorted, joined category name string (fingerprint) — if category list changes, cache is regenerated                                                                             |
| **Invalidation**     | On server restart (stateless). Manual `clearEmbeddingCache()` export for testing and future admin use.                                                                         |
| **TTL**              | None — category list changes very infrequently; server restarts are the natural invalidation point                                                                             |
| **Concurrency**      | Promise-based initialization lock to prevent parallel `embedMany()` calls during cold start. First caller awaits the embedding API; subsequent callers await the same Promise. |
| **Memory footprint** | ~20 categories × 1536 floats × 8 bytes = ~245 KB — negligible                                                                                                                  |

## 9. Configuration

| Env Variable                        | Default                  | Description                                                                                           |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `AI_EMBEDDING_MODEL`                | `text-embedding-3-small` | Embedding model identifier. Override to use `text-embedding-3-large` (3072 dims) for higher accuracy. |
| `AI_EMBEDDING_SIMILARITY_THRESHOLD` | `0.75`                   | Minimum cosine similarity to accept an embedding match. Lower = more lenient, higher = more strict.   |

Both are optional with sensible defaults. No new API keys needed — reuses existing `AI_API_KEY` and `AI_PROVIDER`.

## 10. Provider Compatibility

The `getAIProvider()` pattern in `ai-vision.service.ts` currently creates an OpenAI-compatible provider (works with both OpenAI API and GitHub Models). The embedding service reuses this pattern:

| Provider                 | Embedding Support                  | Notes                                                       |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------- |
| `openai`                 | ✅ Native `text-embedding-3-small` | Full support                                                |
| `github` (GitHub Models) | ✅ OpenAI-compatible endpoint      | Supports same embedding models via Azure inference endpoint |

## 11. Risks & Mitigations

| Risk                                | Impact                                      | Likelihood | Mitigation                                                                                                 |
| ----------------------------------- | ------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| Embedding API unavailable           | Category matching degrades to Levenshtein   | Low        | Graceful fallback to `matchCategory()` (existing fuzzy logic) — import continues                           |
| Cold-start latency on first import  | ~500ms extra for initial `embedMany()` call | Medium     | Acceptable for first request; all subsequent requests use cached embeddings                                |
| Category names change after caching | Stale embeddings used until restart         | Low        | Categories change rarely. v1: invalidate on restart. Future: invalidate on admin category CRUD operations. |
| Similarity threshold too high       | Too many entries fall to "Other"            | Medium     | Configurable via `AI_EMBEDDING_SIMILARITY_THRESHOLD` env var; log similarity scores for tuning             |
| Similarity threshold too low        | Incorrect category matches                  | Medium     | Default 0.75 is conservative; log matched scores for review                                                |

## 12. Success Metrics

| Metric                     | Current               | Target                  | Measurement                                                   |
| -------------------------- | --------------------- | ----------------------- | ------------------------------------------------------------- |
| Category match rate        | ~60-70% (estimated)   | >95%                    | Compare `isMatched: true` rate in import results before/after |
| False positive rate        | Unknown               | <2%                     | Manual review of import results on sample data                |
| Matching latency per entry | <1ms (static lookup)  | <200ms (with embedding) | Server-side timing in parse route logs                        |
| Embedding cost per session | N/A                   | <$0.001                 | `AIUsageLog` where `model = 'text-embedding-3-small'`         |
| Maintenance effort         | Code change per alias | Zero (self-adapting)    | No more `SEMANTIC_MAPPINGS` dictionary updates                |

## 13. Implementation Phases

| Phase                                      | Scope                                                                                                                                                 | Files                                                                   | Dependency |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| **Phase 1: Embedding Service**             | `embedding.service.ts` — embedding provider factory, `embedCategories()`, `embedQuery()`, `cosineSimilarity()`, in-memory cache with concurrency lock | `embedding.service.ts` (new)                                            | None       |
| **Phase 2: Category Matcher Integration**  | Replace `matchCategoryWithSemantics()` → `matchCategoryWithEmbedding()` in category-matcher; update expense-mapper to use async matching              | `category-matcher.service.ts`, `expense-mapper.service.ts`, `_types.ts` | Phase 1    |
| **Phase 3: Usage Logging & Pricing**       | Track embedding tokens in `AIUsageLog`; add embedding pricing constant                                                                                | `ai-pricing.ts`, `parse/route.ts`                                       | Phase 2    |
| **Phase 4: Configuration & Documentation** | Add env vars to `.env-example`; update this spec with results                                                                                         | `.env-example`                                                          | Phase 3    |

## 14. Future Considerations

- **Admin category CRUD hook**: When an admin adds/removes an `ExpenseCategory`, automatically invalidate the embedding cache so the next import picks up changes without a server restart.
- **Batch embedding for extracted entries**: Instead of calling `embed()` once per extracted entry, batch all entries in a single `embedMany()` call and compute cosine similarity in bulk for lower latency.
- **Extend to bank account matching**: Apply the same embedding approach to `bestMatchAccount()` in `bank-asset-mapper.service.ts` to improve bank asset import accuracy.
- **Similarity score logging**: Persist the cosine similarity score of each match in the import results for analytics and threshold tuning.
