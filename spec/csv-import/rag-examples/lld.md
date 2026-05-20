# RAG Examples for CSV Classification — LLD

## Implementation Phases

### Phase 1 — Vector Storage Model
- Add `TransactionEmbedding` Prisma model with `vector(1536)` payload (pgvector).
- Record source metadata (`manual`, `llm_classified`, `csv_import`) and category link.
- Ensure per-user indexing for scoped retrieval.

### Phase 2 — Retrieval Services
- Implement `transaction-embedding.service.ts`:
  - `storeTransactionEmbedding(...)`,
  - `findSimilarTransactions(...)` (`$queryRaw` with pgvector similarity).
- Implement `rag-classifier.service.ts`:
  - embed incoming description,
  - retrieve top-K nearest examples,
  - direct classification on high-confidence consensus,
  - fallback to LLM with few-shot context when uncertain.

### Phase 3 — Route Integration
- Replace/augment classify path to use `ragClassifyTransactions(...)`.
- Keep Phase 1 classifier as fallback when example corpus is sparse.
- Write new embeddings after successful confirms/imports.

### Phase 4 — Backfill + Ops
- Add admin backfill endpoint for historical CSV transactions.
- Migration sequence: enable pgvector extension, migrate schema, deploy services, run backfill.

## Contracts

- Retrieval confidence threshold: default `0.85` for direct category return.
- Sparse-data guard: fallback to LLM when user has insufficient labeled examples (e.g., `<50`).
- Few-shot prompt format includes top similar historical `description -> category` examples.

## Database Pattern

- `TransactionEmbedding` writes on confirmed transactions.
- Vector similarity lookup via raw SQL only (Prisma `Unsupported("vector(1536)")`).
- Maintain user isolation in all retrieval queries.

## Acceptance Criteria

- High-similarity recurring merchants classify without LLM call.
- Low-confidence transactions route to LLM with contextual examples.
- Retrieval path improves classification consistency with user overrides.
- Backfill endpoint can seed embeddings from historical imports.

## File Inventory

| File | Action | Notes |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | add `TransactionEmbedding` |
| `prisma/migrations/*` | CREATE | pgvector + table migration |
| `src/server/services/ai-import/transaction-embedding.service.ts` | CREATE | vector read/write |
| `src/server/services/ai-import/rag-classifier.service.ts` | CREATE | retrieval-first classifier |
| `src/app/api/csv-import/classify/route.ts` | MODIFY | plug RAG classifier |
| `src/app/api/admin/transactions/backfill-embeddings/route.ts` | CREATE | backfill |
| `src/__tests__/unit/rag-classifier.service.test.ts` | CREATE | unit coverage |
| `src/__tests__/integration/rag-categorisation.integration.test.ts` | CREATE | integration coverage |
