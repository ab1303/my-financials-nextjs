# CSV Import Upload & Parse — Context

## Problem
Enable authenticated users to upload bank CSV files (initially CommBank-compatible), parse transactions in-memory, validate structure, and process expense entries through the shared semantic category pipeline. The feature must provide a reliable streaming workflow for month-based processing and session tracking.

## Domain Dependencies
- Uses `AIImportSession` and `CsvTransaction` contracts from [../hld.md](../hld.md).
- Uses shared parsing/validation rules and category matching strategy from [../hld.md](../hld.md).
- Uses semantic-category-matching services for final category resolution (`mapExpenseData` and embedding matcher chain).
- Related features: `generic-csv-import` (parser extensibility), `llm-classification` and `rag-examples` (classification quality).

## Scope
**In scope**
- Multipart CSV upload endpoint (`POST /api/csv-import/upload`).
- In-memory parse + validation + debit filtering.
- Session-scoped transaction storage in `AIImportSession.metadata`.
- Streamed month-by-month processing (`POST /api/csv-import/parse` and/or classify workflow).
- Session status updates and token usage logging integration.

**Out of scope**
- Binary file storage (S3/Blob/local archive).
- Manual reconciliation UI beyond feature-specific review flow.
- Non-CSV formats (OFX/QIF).
- Full bank autodetection strategy internals (covered by `generic-csv-import`).
