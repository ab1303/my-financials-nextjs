# CSV Import — Domain HLD

## Problem Statement
CSV files are the most common way users export transaction data from banks (for example CommBank, NAB, and other AU banks). This domain provides a unified architecture to upload, parse, validate, classify, and persist CSV transactions with AI-assisted category matching while keeping processing in-memory and session-scoped.

## Architecture Overview

```text
Client CSV Upload
   │
   ▼
POST /api/csv-import/upload
   ├─ auth + MIME/size/row validation
   ├─ parser selection (feature-specific: CommBank or generic registry/detection)
   ├─ in-memory CSV parse → CsvTransaction[]
   └─ AIImportSession.create(status=PENDING, metadata.transactions)
   │
   ▼
POST /api/csv-import/classify or /parse (SSE)
   ├─ load + authorize AIImportSession
   ├─ group transactions by month
   ├─ classify (LLM and/or RAG strategy)
   └─ mapExpenseData(...) → matchCategoryWithEmbedding(...) → ExpenseEntry writes
   │
   ▼
POST /api/csv-import/confirm (reviewed imports)
   ├─ persist confirmed categories
   ├─ upsert user override examples
   ├─ log AI usage
   └─ AIImportSession.update(COMPLETED|PARTIAL|FAILED)
```

## Data Models

- **AIImportSession**  
  Session-level record for import lifecycle state (`PENDING/PROCESSING/COMPLETED/PARTIAL/FAILED`), confidence, records created, and JSON metadata (file + parsed rows).
- **CsvTransaction** (domain transfer model)  
  `date`, `description`, `amount` (absolute), `month`, `year`, optional `type`, optional `balance`.
- **AIUsageLog**  
  Token usage and estimated cost for LLM and embedding calls.
- **Cross-domain references (semantic-category-matching)**  
  `Expense`, `ExpenseEntry`, `ExpenseCategory` plus embedding matching services (`ensureCategoryEmbeddings`, `findBestEmbeddingMatch`, similarity threshold config).

## Parsing Algorithm

1. Validate upload (`auth`, MIME/extension, file size, row cap).
2. Parse CSV rows with quoted-field-safe splitting.
3. Resolve columns using either:
   - fixed CommBank shape, or
   - generic bank format config (`signed` or `split` debit/credit amount structure).
4. Validate row-level fields:
   - date format (`DD/MM/YYYY` or configured format),
   - numeric amount,
   - non-empty description.
5. Normalize transaction values:
   - debit/credit derivation,
   - absolute `amount`,
   - `month` / `year` extracted from parsed date.
6. Filter rows based on feature scope (core expense import: debits only).
7. Store parsed rows in `AIImportSession.metadata` for downstream classification/confirm flows.

## Category Matching Strategy

Shared category matching chain in semantic-category-matching domain:

1. Exact match (case-insensitive)
2. Substring match
3. Embedding similarity (`text-embedding-3-small`, configurable threshold default `0.75`)
4. Levenshtein/fuzzy fallback on embedding failure

CSV-specific classifiers feed this chain with better inputs:
- raw description (baseline),
- LLM-normalized category labels,
- RAG few-shot examples from user-confirmed history.

## Validation Rules

- **File types**: `text/csv`, `application/csv`, `application/octet-stream`, `text/plain`, or `.csv` extension.
- **File size**: max 5MB.
- **Row limits**: max 1000 parsed expense rows per upload flow.
- **Header/column checks**: feature-specific required columns (CommBank fixed headers; generic format mapping in registry/detection).
- **Body validation**: Zod schemas for classify/parse/confirm requests.

## Error Handling Strategy

- Pre-stream errors return JSON (`400/401/403/404`).
- Stream-time errors emit SSE `error` events; per-month failures do not automatically abort whole import.
- Final session status semantics:
  - `COMPLETED`: all groups succeeded
  - `PARTIAL`: mixed success/failure
  - `FAILED`: no records created
- Classification failures degrade gracefully:
  - LLM failure → fallback to description-based classification
  - Embedding failure → fuzzy fallback
- AI usage logging is best-effort and must not fail the import path.

## Cross-Domain Dependencies

- `spec/semantic-category-matching/*` for embedding services, thresholds, and category matching behavior.
- CSV import features must not duplicate semantic-category schema/contracts; they consume those services.

## Environment Variables

- `AI_API_KEY` or provider equivalent key
- `AI_PROVIDER` (`github` or `openai`)
- `AI_EMBEDDING_MODEL` (default `text-embedding-3-small`)
- `AI_EMBEDDING_SIMILARITY_THRESHOLD` (default `0.75`)
- `AI_VISION_MODEL` / text model configuration used by LLM classification (`gpt-4o-mini` default in current specs)
- `AI_BASE_URL` (optional provider override)
