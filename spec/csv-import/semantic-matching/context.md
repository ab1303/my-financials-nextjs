# Semantic Category Matching — Context

## Problem

Raw merchant transaction descriptions from CSV/OFX exports (e.g., `"WOOLWORTHS 1294 HORNSBY NS"`) cannot be directly matched to expense categories via simple string similarity. The embedding-based category matching layer converts these raw descriptions into semantic category labels that can be reliably matched to the application's `ExpenseCategory` records.

This is a **shared service** used by two import paths:
1. **AI Image Import** (screenshots with GPT-4o vision extraction)
2. **CSV/OFX Import** (raw merchant descriptions)

## Domain Dependencies

- Uses: `ExpenseCategory` domain (from categories domain)
- Uses: Embedding API (GitHub Models / OpenAI text-embedding-3-small)
- Uses: LLM classification pipeline (csv-import domain HLD for LLM extraction)
- Related: `csv-import` (primary consumer of embedding service)
- Related: `llm-classification` (upstream LLM extracts labels before semantic matching)
- Related: `rag-examples` (complementary approach using user examples)

## Scope

**In scope**
- Embedding generation and caching for expense categories
- Cosine similarity calculation (0.75 threshold)
- Fallback to Levenshtein fuzzy matching if embedding API fails
- Cost tracking and logging (text-embedding-3-small pricing)
- 3-retry exponential backoff strategy
- Promise-based concurrency lock to prevent duplicate API calls
- In-memory cache up to 1000 categories (~1.5 MB)

**Out of scope**
- LLM classification of raw descriptions (handled by llm-classification feature)
- RAG example retrieval (handled by rag-examples feature)
- Batch historical re-matching (Phase 2 future)
- Dashboard visualizations
