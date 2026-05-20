# Semantic Category Matching — Low Level Design

## Overview

Shared embedding service for semantic category matching. Converts free-text category labels (from LLM extraction or image recognition) to precise database `ExpenseCategory` matches via embeddings + cosine similarity.

Used by both AI Image Import and CSV/OFX Import pipelines.

---

## Implementation: Core Service

### 1. Embedding Service

**File:** `src/server/services/ai-import/embedding.service.ts`

#### 1.1 Provider Factory

```typescript
import { embed } from 'ai';
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

#### 1.2 Cosine Similarity

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

#### 1.3 Embedding Cache

```typescript
// In-memory cache: Map<text, embedding vector>
const embeddingCache = new Map<string, number[]>();

export async function ensureCategoryEmbeddings(params: {
  prismaClient: PrismaClient;
  categoryNames: string[];
}): Promise<Map<string, number[]>> {
  // For each category:
  //   1. Check embeddingCache
  //   2. If miss: call embed() with retry + backoff
  //   3. Store in cache
  //   4. Return map
  
  // 3-retry exponential backoff: 1s, 2s, 4s then fall back to Levenshtein
  // Cost: log to AIUsageLog
}
```

#### 1.4 Similarity Matching

```typescript
export async function findBestEmbeddingMatch(params: {
  prismaClient: PrismaClient;
  inputText: string;
  categoryEmbeddings: Map<string, number[]>;
  similarityThreshold: number; // default 0.75
}): Promise<{
  category: string | null;
  similarity: number;
  fallbackUsed: boolean;
}> {
  // 1. Embed inputText (with retry + backoff)
  // 2. For each category embedding, compute cosine similarity
  // 3. Return best match if similarity >= threshold
  // 4. Fallback to Levenshtein if below threshold
}
```

### 2. Category Matcher Updates

**File:** `src/server/services/ai-import/category-matcher.service.ts`

```typescript
export async function matchCategoryWithEmbedding(params: {
  prismaClient: PrismaClient;
  categoryLabel: string; // e.g., "Groceries" (from LLM or image extraction)
  userId: string;
}): Promise<{
  category: string;
  confidence: number;
  fallbackUsed: boolean;
}> {
  // 1. Fetch all ExpenseCategories from DB (scoped to user's calendar)
  // 2. Call ensureCategoryEmbeddings({ categoryNames })
  // 3. Call findBestEmbeddingMatch({ inputText: categoryLabel, categoryEmbeddings })
  // 4. Return matched category + confidence + fallback flag
}
```

### 3. Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `AI_API_KEY` | Yes | — | API key for embedding service |
| `AI_PROVIDER` | No | `'github'` | `'github'` or `'openai'` |
| `AI_EMBEDDING_MODEL` | No | `'text-embedding-3-small'` | Embedding model ID |
| `AI_EMBEDDING_SIMILARITY_THRESHOLD` | No | `0.75` | Cosine similarity threshold |

### 4. Cost Calculation

```typescript
// From AI SDK docs: text-embedding-3-small costs $0.02 per 1M tokens
// Approximate: 1 token ≈ 4 characters

export function calculateEmbeddingCost(tokenCount: number): number {
  const COST_PER_1M_TOKENS = 0.02;
  return (tokenCount / 1_000_000) * COST_PER_1M_TOKENS;
}
```

### 5. Error Handling & Fallback

| Scenario | Behavior |
|---|---|
| API unavailable | Retry 3x (1s, 2s, 4s backoff) then fallback to Levenshtein |
| Similarity below threshold | Return fuzzy match with `fallbackUsed: true` |
| Invalid input text | Return `{ category: null, confidence: 0 }` |

### 6. Integration Points

#### CSV Import Parse Route

```typescript
// In src/app/api/csv-import/parse/route.ts

for each month group:
  for each transaction:
    // 1. LLM classification extracts category label
    const classificationResult = await classifyTransactionCategory(tx.description);
    const categoryLabel = classificationResult.category; // e.g., "Groceries"
    
    // 2. Semantic matching converts to database category
    const matchResult = await matchCategoryWithEmbedding({
      prismaClient: ctx.prisma,
      categoryLabel,
      userId: ctx.session.user.id,
    });
    
    // 3. Create expense entry with matched category
    await mapExpenseData({
      categoryName: matchResult.category,
      confidence: matchResult.confidence,
      // ...
    });
```

#### AI Image Import Parse Route (existing, unchanged)

```typescript
// In src/app/api/ai-import/parse/route.ts
// Already calls matchCategoryWithEmbedding() after GPT-4o extraction
// No changes needed — this service is backward-compatible
```

---

## File Inventory

| File | Action | Description |
|---|---|---|
| `src/server/services/ai-import/embedding.service.ts` | CREATE | Core embedding generation, caching, cosine similarity |
| `src/server/services/ai-import/category-matcher.service.ts` | MODIFY | Use embedding service for matching (replace Levenshtein-only approach) |
| `src/app/api/csv-import/parse/route.ts` | MODIFY | Call matchCategoryWithEmbedding() after LLM classification |
| `src/constants/ai-pricing.ts` | MODIFY | Add calculateEmbeddingCost() function |
| `prisma/schema.prisma` | No changes | No schema changes |

---

## Success Criteria

1. ✅ Embeddings for all ExpenseCategories cached on first call
2. ✅ Cosine similarity matching achieves 0.75+ for correct categories
3. ✅ Fallback to Levenshtein works when API fails
4. ✅ Cost logged accurately to AIUsageLog
5. ✅ CSV import categorization accuracy improved vs. LLM-only
6. ✅ AI Image Import behavior unchanged (backward-compatible)
7. ✅ `pnpm run build` passes with no errors

---

## Phase 2 (Future): Batch Re-Matching

- Re-run semantic matching on historical import sessions
- Allow users to update categorization based on improved embeddings
- Out of scope for Phase 1
