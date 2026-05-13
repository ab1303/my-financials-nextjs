# CSV Transaction Categorisation — Approach 2: RAG with User Examples (Long-term)

> **Created**: 2026-05-13
> **Phase**: Architecture planning (long-term)
> **Status**: Planned — after Phase 1 (LLM Classification) is in production
> **Related Specs**: csv-categorisation-llm-classification/csv-categorisation-llm-classification.md (Phase 1, prerequisite),
>                   semantic-category-matching/semantic-category-matching-context.md
> **Dependencies**: Phase 1 LLM Classification (bootstrap data source),
>                   semantic-category-matching (embedding.service.ts),
>                   pgvector Postgres extension

---

## 1. Overview

### 1.1 What Is RAG in This Context?

Retrieval-Augmented Generation (RAG) here means: use the user's own **past categorised
transactions** as a knowledge base. When a new transaction arrives, retrieve the most
similar historical transactions and use those as evidence for the category decision.

This is distinct from the general LLM world-knowledge approach (Phase 1). Instead of
asking the LLM "what category is Woolworths?", we ask: "the user has previously
categorised 47 similar transactions as Groceries — what should this one be?"

### 1.2 Why This Is the Right Long-term Architecture

Phase 1 (LLM Classification) solves the immediate problem using general world knowledge.
Phase 2 makes categorisation **personal** and **progressively more reliable**:

- The user may classify "REBEL SPORT" as "Sport & Fitness" rather than "Shopping"
- The user may classify "ALDI" as "Groceries" — consistent with Woolworths and Coles
- Over time, pure retrieval (no LLM call) becomes sufficient for known merchants
- The system improves with every new import — a compounding accuracy advantage

---

## 2. Why RAG Is Better Long-term

| Dimension | Phase 1 (LLM) | Phase 2 (RAG) |
|-----------|--------------|---------------|
| Knowledge source | General LLM world knowledge | User's own categorisation history |
| Personalisation | None | Full — learns individual preferences |
| LLM calls over time | 1 per import (forever) | Decreases as retrieval confidence grows |
| Accuracy trajectory | Flat (model-dependent) | Improves over time |
| Hallucination risk | Present | Grounded in real user examples |
| Cost trajectory | Constant | Decreasing (retrieval replaces LLM) |
| Explainability | "Model says so" | "You categorised 12 similar txns as X" |

---

## 3. Architecture

### 3.1 Write Path — Building the Knowledge Base

Every correctly classified transaction becomes a labelled example:

```
User categorises transaction (via Phase 1 output or manual correction)
        │
        ▼
embedding.service.ts
  embed(tx.description)
  → float32[1536] vector
        │
        ▼
prisma.transactionEmbedding.create({
  userId, description, embedding, categoryId, source
})
        │
        ▼
TransactionEmbedding table (pgvector)
  ┌─────────────────────────────────────────────────────┐
  │  id | userId | description | embedding | categoryId │
  │ ----+--------+-------------+-----------+----------- │
  │  1  │  u1    │ WOOLWORTHS… │ [0.1,…]   │ Groceries  │
  │  2  │  u1    │ NETFLIX…    │ [0.3,…]   │ Entertain. │
  │  3  │  u1    │ DEFT PMTS…  │ [0.2,…]   │ Home       │
  └─────────────────────────────────────────────────────┘
```

### 3.2 Read Path — Retrieval-Augmented Classification

```
New CSV transaction arrives
        │
        ▼
embed(tx.description)  [embedding.service.ts — already exists]
        │
        ▼
pgvector similarity search:
  SELECT categoryId, similarity
  FROM TransactionEmbedding
  WHERE userId = :userId
  ORDER BY embedding <-> :queryEmbedding   -- L2 distance (pgvector)
  LIMIT 5
        │
        ├─── top-1 similarity > 0.85 AND top-3 all agree on same category?
        │         │
        │         ▼
        │    Return category directly  ← NO LLM CALL
        │
        └─── similarity < 0.85 OR top-3 disagree?
                  │
                  ▼
             LLM call with few-shot context:
               "The user has previously categorised these similar transactions:
                - 'WOOLWORTHS 1294 HORNSBY' → Groceries
                - 'WOOLWORTHS 0439 CHATSWOOD' → Groceries
                - 'ALDI FOODS 1023 SYDNEY' → Groceries
                Classify: 'WOOLWORTHS 0812 PARRAMATTA'"
                  │
                  ▼
             Category label ("Groceries")
                  │
                  ▼
        matchCategoryWithEmbedding()   [unchanged — existing service]
                  │
                  ▼
        ExpenseEntry created in DB
```

### 3.3 Hybrid Flow Diagram (Phase 2 Target)

```
┌──────────────────────────────────────────────────────────────────────┐
│  /api/csv-import/parse/route.ts  (PHASE 2)                           │
│                                                                      │
│  for each transaction in month batch:                                │
│    CsvTransaction                                                    │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  rag-classifier.service.ts  (NEW in Phase 2)                 │   │
│  │                                                              │   │
│  │  1. embed(tx.description)                                    │   │
│  │  2. query TransactionEmbedding (pgvector top-5)              │   │
│  │  3a. similarity > 0.85 & consensus → return category  ──────────▶│
│  │  3b. else → LLM with few-shot examples                       │   │
│  │       → category label                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  matchCategoryWithEmbedding()  [UNCHANGED]                           │
│         │                                                            │
│         ▼                                                            │
│  prisma.expenseEntry.create()                                        │
│  prisma.transactionEmbedding.create()  ← store for future RAG       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Vector Storage Options

### 4.1 Option A: Postgres + pgvector (Recommended ✓)

Store embeddings as `vector(1536)` columns in the existing Postgres database.
Query with pgvector's `<->` (L2 distance) or `<=>` (cosine distance) operators.

**Pros**:
- No new infrastructure — uses existing Postgres (already on Render / Docker)
- Queryable with Prisma raw queries
- Transactional consistency with the rest of the app data
- Works with the existing `prisma` client

**Cons**:
- Requires `pgvector` extension enabled on Postgres instance
- Prisma schema uses `Unsupported("vector(1536)")` type (no type-safe queries)

**Query pattern** (Prisma raw):
```typescript
const results = await prisma.$queryRaw<Array<{categoryId: string, distance: number}>>`
  SELECT "categoryId", embedding <=> ${queryVector}::vector AS distance
  FROM "TransactionEmbedding"
  WHERE "userId" = ${userId}
  ORDER BY distance ASC
  LIMIT 5
`;
```

### 4.2 Option B: In-Memory at Startup

Load all user's historical transaction embeddings into memory on server startup
(mirrors the existing category embedding cache in `embedding.service.ts`).

**Pros**: Zero new dependencies; works exactly like current category cache.

**Cons**: Memory grows with transaction history (~1,000 txns/year × 1536 dims × 4 bytes
= ~6 MB/user/year). Acceptable for single user; problematic if multi-tenant.

**Recommendation**: Use as interim approach while pgvector is being set up. The interface
can be identical — swap the storage backend without changing the classifier.

### 4.3 Option C: External Vector DB (Pinecone, Qdrant, Weaviate)

**Not recommended** for this application. Introduces operational overhead, additional cost
($70+/month for managed services), and a new external dependency for a single-user
personal finance app where pgvector in existing Postgres is entirely sufficient.

Reserve for multi-tenant future if the app ever expands beyond personal use.

### 4.4 Recommendation Summary

| Scale | Recommended Storage |
|-------|-------------------|
| Single user, < 5,000 transactions | Option B (in-memory) as interim |
| Single user, any scale | Option A (pgvector) — permanent solution |
| Multi-tenant | Option C (external vector DB) |

**This app**: Option A (pgvector in existing Postgres).

---

## 5. Prisma Schema Changes

```prisma
// Add to prisma/schema.prisma

model TransactionEmbedding {
  id          String   @id @default(cuid())
  userId      String
  description String                           // original bank description
  embedding   Unsupported("vector(1536)")      // pgvector — text-embedding-3-small
  categoryId  String
  source      String                           // "manual" | "llm_classified" | "csv_import"
  confidence  Float?                           // LLM confidence if source = "llm_classified"
  createdAt   DateTime @default(now())

  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])

  @@index([userId])  // All queries are scoped to a user
}
```

**Migration note**: Requires `CREATE EXTENSION IF NOT EXISTS vector;` in Postgres before
running `prisma migrate deploy`. Add this to the migration SQL file.

**Prisma limitation**: `Unsupported("vector(1536)")` means Prisma cannot generate typed
accessors. All similarity queries must use `prisma.$queryRaw`. This is acceptable — the
query pattern is contained to one service file.

---

## 6. Bootstrap Strategy

### 6.1 The Chicken-and-Egg Problem

RAG requires labelled examples, but labelled examples require categorised transactions,
which requires… RAG. Phase 1 (LLM Classification) is the solution:

```
Month 1:  Phase 1 (LLM) classifies ~100 transactions  →  0 RAG examples
          ↓
          Each classified transaction → stored in TransactionEmbedding
          ↓
Month 2:  ~100 RAG examples available
          RAG used for merchants seen before (≈ 60% hit rate)
          LLM used for new merchants (≈ 40%)
          ↓
Month 6:  ~600 RAG examples across all categories
          RAG handles ~85% of transactions without LLM
          ↓
Month 12: ~1200 RAG examples
          RAG handles ~95%+ of transactions
          LLM reserved for genuinely new merchant types
```

### 6.2 Manual Correction Feedback Loop

When the user corrects a miscategorised transaction in the UI:

1. Update `ExpenseEntry.categoryId` in DB
2. Also update (or insert) the corresponding `TransactionEmbedding` record with:
   - The correct `categoryId`
   - `source: "manual"` — highest trust weight
3. The correction immediately improves future RAG results for similar descriptions

This creates a **virtuous feedback loop**: the more the user corrects, the better the
system becomes, until corrections are rarely needed.

---

## 7. When RAG Replaces LLM Calls

Based on typical personal banking patterns:

| Condition | Expected Outcome |
|-----------|-----------------|
| < 50 examples total | RAG too sparse; use Phase 1 LLM for all |
| 50–200 examples | RAG useful for recurring merchants (≈ 50% hit rate) |
| > 200 examples (≈ 2 months of imports) | RAG handles ≈ 70% without LLM |
| > 500 examples (≈ 5 months) | RAG handles ≈ 90%+ without LLM |
| > 1,000 examples | Nearly all recurring merchants handled; LLM for new only |

**Threshold recommendation**: Activate Phase 2 RAG retrieval when the user has
> 50 labelled examples total (auto-detected at runtime).

---

## 8. Migration from Phase 1 to Phase 2

### 8.1 Non-Breaking Addition

Phase 1 and Phase 2 use the same `ExpenseExtractionResult` contract and the same
`mapExpenseData()` service. The Phase 2 change is:

```
Phase 1:  classifyTransactions(txs, categories) → ExpenseExtractionResult
Phase 2:  ragClassifyTransactions(txs, categories, userId) → ExpenseExtractionResult
                └── internally: retrieve → (direct return OR LLM with context)
```

Phase 1's `classifyTransactions()` remains as the fallback when the RAG store is sparse.

### 8.2 Backfill Existing Data

Once Phase 2 is deployed, a one-time backfill can embed all historically imported
transactions (those created before Phase 2 was active):

```
POST /api/admin/transactions/backfill-embeddings
  → For each ExpenseEntry with importType = CSV
  → embed(expenseEntry.description)
  → insert into TransactionEmbedding (source: "csv_import")
```

This gives the RAG store an immediate head start without requiring the user to re-import.

### 8.3 Deployment Sequence

1. Enable `pgvector` extension on Postgres instance
2. Run Prisma migration (`TransactionEmbedding` table)
3. Deploy Phase 2 code (RAG classifier + backfill endpoint)
4. Trigger backfill for existing transactions
5. Phase 1 LLM path remains active as fallback; gradually used less as RAG matures

---

## 9. Why NOT a Dedicated Vector DB Service

| Concern | pgvector Answer |
|---------|----------------|
| Scale | 1,200 vectors/year × 1536 dims × 4 bytes = ~7 MB/year. Trivial. |
| Query performance | Indexed ANN search in pgvector handles thousands of vectors in <5ms |
| Operational overhead | Zero — same Postgres, same backups, same monitoring |
| Cost | Zero additional cost — uses existing DB allocation |
| Consistency | ACID transactions with the rest of the data (no sync lag) |
| Multi-tenancy | Not a requirement for this personal finance app |

A dedicated vector DB (Pinecone, Qdrant, etc.) would cost ~$70+/month, introduce a new
service to monitor, and provide no benefit at this scale. pgvector in existing Postgres
is the correct choice.

---

## 10. Implementation Checklist

### 10.1 Infrastructure

- [ ] Enable `pgvector` extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Prisma migration: add `TransactionEmbedding` model
- [ ] Verify pgvector available on Render Postgres (may require plan upgrade check)

### 10.2 New Services

- [ ] `src/server/services/ai-import/rag-classifier.service.ts` — **NEW**
  - `ragClassifyTransactions(txs, categories, userId): Promise<ExpenseExtractionResult>`
  - Embeds each description, queries `TransactionEmbedding` via `prisma.$queryRaw`
  - High-confidence path: similarity > 0.85 + consensus → direct return
  - Low-confidence path: LLM call with top-K examples as few-shot context
  - Falls back to Phase 1 `classifyTransactions()` if RAG store is sparse (< 50 examples)

- [ ] `src/server/services/ai-import/transaction-embedding.service.ts` — **NEW**
  - `storeTransactionEmbedding(description, categoryId, userId, source)` — write path
  - `findSimilarTransactions(description, userId, limit)` — read path (pgvector query)

### 10.3 Route Changes

- [ ] `src/app/api/csv-import/parse/route.ts` — **MODIFY**
  - Replace `classifyTransactions()` with `ragClassifyTransactions()` once RAG is ready
  - Add `storeTransactionEmbedding()` call after each successful `expenseEntry.create()`

- [ ] `src/app/api/admin/transactions/backfill-embeddings/route.ts` — **NEW**
  - One-time backfill for transactions imported before Phase 2

### 10.4 Tests

- [ ] `src/__tests__/unit/rag-classifier.service.test.ts` — **NEW**
- [ ] `src/__tests__/integration/rag-categorisation.integration.test.ts` — **NEW**
  - Seed `TransactionEmbedding` with fixture data
  - Assert high-similarity transactions skip LLM call
  - Assert low-similarity transactions use LLM with correct few-shot context