# Low Level Design: Semantic Embedding-based Category Matching

> **Version**: 1.1
> **Date**: 2026-05-12
> **Status**: Ready for Implementation
> **Parent**: [Semantic Category Matching HLD](./semantic-category-matching-hld.md)
> **Context Mapping**: [Semantic Category Matching - Context & Dependencies](./semantic-category-matching-context.md)

> **Context update**: The embedding service described here is a shared backend component invoked by two pipelines — (A) the existing AI Image Import pipeline (`/api/ai-import/parse`) and (B) the new CSV/OFX Import pipeline (`/api/csv-import/parse`). The implementation details in sections 1–5 are identical for both paths. Section 6 covers parse route integration for both.

---

## Table of Contents

1. [Embedding Service](#1-embedding-service)
2. [Category Matcher Changes](#2-category-matcher-changes)
3. [Expense Mapper Changes](#3-expense-mapper-changes)
4. [Type Additions](#4-type-additions)
5. [Pricing Constants](#5-pricing-constants)
6. [Parse Route Changes](#6-parse-route-changes)
7. [Environment Variables](#7-environment-variables)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Embedding Service

### New File: `src/server/services/ai-import/embedding.service.ts`

This is the core new module. It handles embedding generation, caching, and cosine similarity computation.

#### 1.1 Embedding Provider Factory

Mirrors the existing `getAIProvider()` pattern in `ai-vision.service.ts` but returns an embedding model instead of a chat model.

```typescript
import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';

function getEmbeddingProvider() {
  const provider = process.env.AI_PROVIDER ?? 'github';
  const modelId = process.env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    throw new Error(`AI_API_KEY is required for embedding service.`);
  }

  const openai = createOpenAI({
    apiKey,
    ...(provider === 'github' && { baseURL: GITHUB_MODELS_BASE_URL }),
  });

  return openai.embedding(modelId);
}
```

**Key difference from `getAIProvider()`**: Uses `openai.embedding(modelId)` instead of `openai.chat(modelId)`.

#### 1.2 Cosine Similarity

Pure function — no dependencies, no side effects.

```typescript
/**
 * Compute cosine similarity between two vectors.
 * Returns value between -1 and 1 (1 = identical direction).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
```

#### 1.3 Category Embedding Cache

Module-level singleton cache with concurrency-safe lazy initialization.

```typescript
import type { AITokenUsage } from './_types';

interface CachedEmbeddings {
  fingerprint: string; // sorted category names joined — detects changes
  embeddings: Map<string, number[]>; // categoryName → embedding vector
}

let cachedEmbeddings: CachedEmbeddings | null = null;
let initializationPromise: Promise<AITokenUsage> | null = null;

/**
 * Generate a fingerprint from category names to detect when
 * the category list has changed (requires re-embedding).
 */
function getCategoryFingerprint(categories: string[]): string {
  return [...categories].sort().join('|');
}

/**
 * Embed all category names and cache the results.
 * Uses a Promise lock to prevent parallel embedMany() calls.
 *
 * Returns token usage for AIUsageLog tracking.
 */
export async function ensureCategoryEmbeddings(
  categoryNames: string[],
): Promise<AITokenUsage> {
  const fingerprint = getCategoryFingerprint(categoryNames);

  // Cache hit — categories haven't changed
  if (cachedEmbeddings?.fingerprint === fingerprint) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  // Concurrency lock — if another request is already initializing, await it
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const model = getEmbeddingProvider();

      const { embeddings, usage } = await embedMany({
        model,
        values: categoryNames,
      });

      const embeddingMap = new Map<string, number[]>();
      categoryNames.forEach((name, index) => {
        embeddingMap.set(name, embeddings[index]!);
      });

      cachedEmbeddings = { fingerprint, embeddings: embeddingMap };

      return {
        promptTokens: usage?.tokens ?? 0,
        completionTokens: 0,
        totalTokens: usage?.tokens ?? 0,
      };
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}
```

#### 1.4 Query Embedding + Best Match

```typescript
import type { EmbeddingMatchResult } from './_types';

const DEFAULT_SIMILARITY_THRESHOLD = 0.75;

function getSimilarityThreshold(): number {
  const envThreshold = process.env.AI_EMBEDDING_SIMILARITY_THRESHOLD;
  if (!envThreshold) return DEFAULT_SIMILARITY_THRESHOLD;

  const parsed = parseFloat(envThreshold);
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    console.warn(
      `Invalid AI_EMBEDDING_SIMILARITY_THRESHOLD: "${envThreshold}". Using default ${DEFAULT_SIMILARITY_THRESHOLD}.`,
    );
    return DEFAULT_SIMILARITY_THRESHOLD;
  }
  return parsed;
}

/**
 * Embed a single extracted category name and find the best matching
 * category from the cached embeddings using cosine similarity.
 *
 * Returns the match result and token usage.
 */
export async function findBestEmbeddingMatch(
  extractedName: string,
): Promise<{ match: EmbeddingMatchResult; usage: AITokenUsage }> {
  if (!cachedEmbeddings) {
    throw new Error(
      'Category embeddings not initialized. Call ensureCategoryEmbeddings() first.',
    );
  }

  const model = getEmbeddingProvider();
  const { embedding, usage } = await embed({
    model,
    value: extractedName,
  });

  const threshold = getSimilarityThreshold();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [categoryName, categoryEmbedding] of cachedEmbeddings.embeddings) {
    const similarity = cosineSimilarity(embedding, categoryEmbedding);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = categoryName;
    }
  }

  const tokenUsage: AITokenUsage = {
    promptTokens: usage?.tokens ?? 0,
    completionTokens: 0,
    totalTokens: usage?.tokens ?? 0,
  };

  if (bestMatch && bestScore >= threshold) {
    return {
      match: {
        matched: true,
        categoryName: bestMatch,
        similarity: bestScore,
        method: 'embedding',
      },
      usage: tokenUsage,
    };
  }

  return {
    match: {
      matched: false,
      categoryName: null,
      similarity: bestScore,
      method: 'embedding',
    },
    usage: tokenUsage,
  };
}

/**
 * Clear the cached embeddings. Used in tests and for future
 * admin-triggered cache invalidation.
 */
export function clearEmbeddingCache(): void {
  cachedEmbeddings = null;
  initializationPromise = null;
}
```

#### 1.5 Exported API Summary

| Export                            | Type           | Purpose                                                          |
| --------------------------------- | -------------- | ---------------------------------------------------------------- |
| `cosineSimilarity(a, b)`          | Pure function  | Vector similarity computation                                    |
| `ensureCategoryEmbeddings(names)` | Async function | Initialize/refresh category embedding cache; returns token usage |
| `findBestEmbeddingMatch(name)`    | Async function | Embed a query string and find best category match                |
| `clearEmbeddingCache()`           | Function       | Reset cache (for tests, future admin use)                        |

---

## 2. Category Matcher Changes

### File: `src/server/services/ai-import/category-matcher.service.ts`

#### 2.1 Remove `SEMANTIC_MAPPINGS` and `matchCategoryWithSemantics()`

Delete the entire `SEMANTIC_MAPPINGS` dictionary (~40 entries, lines ~130–200) and the `matchCategoryWithSemantics()` function.

#### 2.2 Keep Existing Functions

These remain unchanged as they serve as fast deterministic checks and fallback:

- `levenshteinDistance()` — internal utility
- `_isSimilar()` — internal utility
- `matchCategory()` — exported, used as fallback
- `matchCategories()` — exported, used by other consumers

#### 2.3 Add New `matchCategoryWithEmbedding()`

New async function replacing `matchCategoryWithSemantics()`:

```typescript
import {
  ensureCategoryEmbeddings,
  findBestEmbeddingMatch,
} from './embedding.service';
import type { EmbeddingMatchResult, AITokenUsage } from './_types';

/**
 * Enhanced matching with AI embeddings.
 * Tiered strategy: exact → substring → embedding → null.
 *
 * Returns the matched category name and accumulated embedding token usage.
 */
export async function matchCategoryWithEmbedding(
  extractedName: string,
  availableCategories: string[],
): Promise<{
  categoryName: string | null;
  embeddingUsage: AITokenUsage;
}> {
  const normalized = extractedName.toLowerCase().trim();
  const zeroUsage: AITokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  // Strategy 1: Exact match (case-insensitive) — instant, no API call
  const exactMatch = availableCategories.find(
    (cat) => cat.toLowerCase() === normalized,
  );
  if (exactMatch) {
    return { categoryName: exactMatch, embeddingUsage: zeroUsage };
  }

  // Strategy 2: Substring match — instant, no API call
  const substringMatch = availableCategories.find(
    (cat) =>
      normalized.includes(cat.toLowerCase()) ||
      cat.toLowerCase().includes(normalized),
  );
  if (substringMatch) {
    return { categoryName: substringMatch, embeddingUsage: zeroUsage };
  }

  // Strategy 3: Embedding cosine similarity
  try {
    // Ensure category embeddings are cached (no-op if already cached)
    const cacheUsage = await ensureCategoryEmbeddings(availableCategories);

    const { match, usage: queryUsage } =
      await findBestEmbeddingMatch(extractedName);

    const totalUsage: AITokenUsage = {
      promptTokens: cacheUsage.promptTokens + queryUsage.promptTokens,
      completionTokens: 0,
      totalTokens: cacheUsage.totalTokens + queryUsage.totalTokens,
    };

    if (match.matched && match.categoryName) {
      return { categoryName: match.categoryName, embeddingUsage: totalUsage };
    }

    return { categoryName: null, embeddingUsage: totalUsage };
  } catch (error) {
    // Graceful degradation: fall back to Levenshtein fuzzy matching
    console.warn(
      '[CategoryMatcher] Embedding unavailable, falling back to fuzzy matching:',
      error instanceof Error ? error.message : error,
    );

    const fuzzyMatch = matchCategory(extractedName, availableCategories);
    return { categoryName: fuzzyMatch, embeddingUsage: zeroUsage };
  }
}
```

**Key design decisions:**

- Returns `embeddingUsage` alongside the match result so the caller can accumulate tokens for AIUsageLog.
- Catches embedding errors and falls back to `matchCategory()` (Levenshtein) — the import never fails due to embedding issues.
- The first two strategies (exact + substring) are preserved from the original `matchCategory()` to avoid unnecessary API calls for trivial matches.

---

## 3. Expense Mapper Changes

### File: `src/server/services/ai-import/expense-mapper.service.ts`

#### 3.1 Update Import

```typescript
// BEFORE:
import { matchCategoryWithSemantics } from './category-matcher.service';

// AFTER:
import { matchCategoryWithEmbedding } from './category-matcher.service';
import type { AITokenUsage } from './_types';
```

#### 3.2 Update `mapExpenseData()` Signature

Add an `embeddingUsage` accumulator to the return type:

```typescript
export interface ExpenseMapResult {
  success: boolean;
  entriesCreated: number;
  confidence: number;
  warnings: string[];
  errors: string[];
  embeddingUsage: AITokenUsage; // NEW — accumulated embedding token usage
}
```

#### 3.3 Update Matching Loop

```typescript
// Inside mapExpenseData(), replace the matching call:

// BEFORE:
const matchedCategory = matchCategoryWithSemantics(
  entry.categoryName,
  availableCategories,
);

// AFTER:
const { categoryName: matchedCategory, embeddingUsage: entryEmbeddingUsage } =
  await matchCategoryWithEmbedding(entry.categoryName, availableCategories);

// Accumulate embedding tokens
accumulatedEmbeddingUsage.promptTokens += entryEmbeddingUsage.promptTokens;
accumulatedEmbeddingUsage.totalTokens += entryEmbeddingUsage.totalTokens;
```

The `accumulatedEmbeddingUsage` is initialized at the top of `mapExpenseData()` and returned in the `ExpenseMapResult`.

---

## 4. Type Additions

### File: `src/server/services/ai-import/_types.ts`

Add the following interface:

```typescript
/**
 * Result of an embedding-based category match attempt.
 */
export interface EmbeddingMatchResult {
  /** Whether a match was found above the similarity threshold */
  matched: boolean;
  /** The matched category name, or null if no match */
  categoryName: string | null;
  /** Cosine similarity score (0–1) of the best match */
  similarity: number;
  /** Which matching method produced this result */
  method: 'exact' | 'substring' | 'embedding' | 'fuzzy';
}
```

The existing `AITokenUsage` interface is already defined and sufficient:

```typescript
// Already exists — no changes needed:
export interface AITokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

---

## 5. Pricing Constants

### File: `src/constants/ai-pricing.ts`

Add embedding model pricing alongside the existing GPT-4o pricing:

```typescript
// --- Existing (unchanged) ---
export const AI_MODEL_NAME = 'gpt-4o' as const;
export const GPT4O_INPUT_COST_PER_TOKEN = 2.5 / 1_000_000;
export const GPT4O_OUTPUT_COST_PER_TOKEN = 10.0 / 1_000_000;

// --- New ---
/**
 * Embedding model pricing for text-embedding-3-small.
 * Rate: $0.02 / 1M tokens (input only — embeddings have no output tokens).
 * Source: https://openai.com/api/pricing/
 */
export const EMBEDDING_MODEL_NAME = 'text-embedding-3-small' as const;
export const EMBEDDING_INPUT_COST_PER_TOKEN = 0.02 / 1_000_000; // $0.00000002

/**
 * Calculate estimated USD cost for embedding token usage.
 */
export function calculateEmbeddingCost(tokens: number): number {
  return tokens * EMBEDDING_INPUT_COST_PER_TOKEN;
}
```

---

## 6. Parse Route Changes

The same embedding token logging pattern applies to **both** parse routes.

### 6.1 File: `src/app/api/ai-import/parse/route.ts` (AI Image Import)

After the existing `mapExpenseData()` call, log embedding tokens to `AIUsageLog`:

### 6.2 File: `src/app/api/csv-import/parse/route.ts` (CSV / OFX Import — new)

This is a new route (not yet implemented). It will:

1. Parse the uploaded CSV or OFX file into a list of `{ merchantDescription: string, amount: number, date: string }` entries
2. Call `mapExpenseData()` with merchant descriptions as the category input (same service as image import path)
3. Log embedding token usage to `AIUsageLog` using the same pattern below

> The key difference from the image path: inputs are raw merchant strings from the CSV `MEMO`/description column, **not** GPT-4o-extracted category labels. The embedding service handles both identically.

### 6.3 Shared Logging Pattern (both routes)

```typescript
// After mapping completes and vision usage is already logged:

const mapResult = await mapExpenseData(
  extractionResult,
  context.calendarId,
  context.month,
  userId,
  image.id,
);

// Log embedding token usage (if any embedding calls were made)
if (mapResult.embeddingUsage.totalTokens > 0) {
  await prisma.aIUsageLog.create({
    data: {
      sessionId: importSession.id,
      userId,
      importType: importType as ImportTypeEnum,
      model: process.env.AI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
      promptTokens: mapResult.embeddingUsage.promptTokens,
      completionTokens: 0,
      totalTokens: mapResult.embeddingUsage.totalTokens,
      estimatedCostUSD: calculateEmbeddingCost(
        mapResult.embeddingUsage.totalTokens,
      ),
    },
  });
}
```

This creates a separate `AIUsageLog` row with `model: 'text-embedding-3-small'` so embedding costs are trackable independently from vision costs.

---

## 7. Environment Variables

### File: `.env-example`

Add after the existing `AI_VISION_MODEL` section:

```env
# AI Embedding Model identifier (used for semantic category matching)
# Default: text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
# Alternative: text-embedding-3-large (3072 dimensions, $0.13/1M tokens)
AI_EMBEDDING_MODEL=text-embedding-3-small

# Minimum cosine similarity threshold for embedding-based category matching
# Range: 0.0 to 1.0 (higher = stricter matching)
# Default: 0.75
AI_EMBEDDING_SIMILARITY_THRESHOLD=0.75
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

#### File: `src/__tests__/services/embedding.service.test.ts`

| Test                                    | Description                                                             |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `cosineSimilarity — identical vectors`  | Returns 1.0 for two identical vectors                                   |
| `cosineSimilarity — orthogonal vectors` | Returns 0.0 for perpendicular vectors                                   |
| `cosineSimilarity — opposite vectors`   | Returns -1.0 for opposite vectors                                       |
| `cosineSimilarity — dimension mismatch` | Throws error when vector lengths differ                                 |
| `clearEmbeddingCache — resets state`    | After clearing, `findBestEmbeddingMatch` throws (cache not initialized) |

#### File: `src/__tests__/services/category-matcher.test.ts`

| Test                                                                    | Description                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `matchCategoryWithEmbedding — exact match skips embedding`              | Returns immediately with zero token usage                        |
| `matchCategoryWithEmbedding — substring match skips embedding`          | Returns immediately with zero token usage                        |
| `matchCategoryWithEmbedding — embedding match returns category + usage` | Mock `embed()` + `embedMany()`, verify correct category returned |
| `matchCategoryWithEmbedding — below threshold returns null`             | Mock low similarity, verify null result                          |
| `matchCategoryWithEmbedding — API error falls back to fuzzy`            | Mock embed failure, verify Levenshtein fallback used             |

### 8.2 Integration Tests

#### File: `src/__tests__/services/expense-mapper.integration.test.ts`

| Test                                                           | Description                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `mapExpenseData — returns embeddingUsage in result`            | Verify `ExpenseMapResult.embeddingUsage` has accumulated tokens |
| `mapExpenseData — exact matches produce zero embedding tokens` | All entries match exactly → `embeddingUsage.totalTokens === 0`  |

### 8.3 Mocking Strategy

Since embedding calls require an API key, all unit tests mock the AI SDK:

```typescript
import { vi } from 'vitest';

// Mock the 'ai' module
vi.mock('ai', () => ({
  embed: vi.fn().mockResolvedValue({
    embedding: new Array(1536).fill(0.1),
    usage: { tokens: 3 },
  }),
  embedMany: vi.fn().mockResolvedValue({
    embeddings: categories.map(() => new Array(1536).fill(0.1)),
    usage: { tokens: 30 },
  }),
}));
```

---

## 9. File Change Summary

| File                                                        | Action                                                                                                         | Lines Changed (est.) |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| `src/server/services/ai-import/embedding.service.ts`        | **New**                                                                                                        | ~180                 |
| `src/server/services/ai-import/category-matcher.service.ts` | **Modified** — remove `SEMANTIC_MAPPINGS` + `matchCategoryWithSemantics()`, add `matchCategoryWithEmbedding()` | -80 / +60            |
| `src/server/services/ai-import/expense-mapper.service.ts`   | **Modified** — update import, add async matching, return `embeddingUsage`                                      | ~15                  |
| `src/server/services/ai-import/_types.ts`                   | **Modified** — add `EmbeddingMatchResult` interface                                                            | ~12                  |
| `src/constants/ai-pricing.ts`                               | **Modified** — add embedding pricing constants                                                                 | ~15                  |
| `src/app/api/ai-import/parse/route.ts`                      | **Modified** — log embedding tokens to `AIUsageLog` (image import path)                                        | ~15                  |
| `src/app/api/csv-import/parse/route.ts`                     | **New** — CSV/OFX parse route; calls `expense-mapper` with merchant descriptions; logs embedding token usage   | ~120                 |
| `src/app/api/csv-import/upload/route.ts`                    | **New** — CSV/OFX file upload endpoint (validates CSV/OFX MIME types)                                          | ~60                  |
| `.env-example`                                              | **Modified** — add 2 new env vars                                                                              | ~8                   |
| `src/__tests__/services/embedding.service.test.ts`          | **New**                                                                                                        | ~80                  |
| `src/__tests__/services/category-matcher.test.ts`           | **New/Modified**                                                                                               | ~60                  |
