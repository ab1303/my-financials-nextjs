# LLM Classification for Categories — Context

## Problem
Raw merchant descriptions are noisy and do not reliably map to user category names through embeddings alone. This feature introduces an LLM classification step that converts transaction descriptions into cleaner category labels before persistence, then allows user review/override.

## Domain Dependencies
- Uses `CsvTransaction` import output from [../hld.md](../hld.md).
- Uses shared category matching strategy and session lifecycle from [../hld.md](../hld.md).
- Depends on semantic-category-matching services for final category resolution and write path.
- Related: `rag-examples` for long-term retrieval-first improvement.

## Scope
**In scope**
- Batched month-level classification using LLM (`gpt-4o-mini` default).
- SSE classify endpoint and confirm endpoint contracts.
- Review + override flow payloads.
- `TransactionCategoryOverride` persistence for confirmed mappings.
- Token usage tracking for classification calls.

**Out of scope**
- pgvector retrieval and few-shot RAG execution (covered by `rag-examples`).
- Manual transaction editing outside category confirmation.
