# RAG Examples for CSV Classification — Context

## Problem
Pure LLM classification does not learn user-specific categorization preferences and can repeat mistakes for recurring local merchants. This feature defines retrieval-augmented classification that uses previously confirmed user examples to improve accuracy and reduce LLM calls over time.

## Domain Dependencies
- Uses CSV import transaction flow and category pipeline from [../hld.md](../hld.md).
- Depends on `TransactionCategoryOverride` data seeded by `llm-classification`.
- Reuses semantic-category-matching embedding infrastructure and similarity concepts.

## Scope
**In scope**
- Storage model for vectorized confirmed examples.
- Retrieval-first classification strategy with confidence thresholding.
- Hybrid fallback to LLM with few-shot examples when retrieval is uncertain.
- Backfill strategy and migration sequencing guidance.

**Out of scope**
- Rewriting baseline CSV upload/parse API contracts.
- Replacing expense persistence contracts (`mapExpenseData`) entirely.
