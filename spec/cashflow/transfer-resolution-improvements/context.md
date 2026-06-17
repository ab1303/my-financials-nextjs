# Transfer Resolution UX — Context

## Problem
Orphaned transfers (single-sided transfers) lacked a clear resolution path, causing data inaccuracy and frustration for users managing complex bank imports.

## Architecture
- **Orphan Resolution**: `orphanResolution` field on `Transaction` (`EXCLUDED`, `EXPENSE`, `INCOME`).
- **Detection**: `runRetroactiveDetection()` service identifies probable pairs.
- **Service Layer**: `transfer.service.ts` + `transfer-rule-job.service.ts`.

## Scope
- Resolution flow for orphaned transfers.
- Automated pair detection and category rule application.
- Re-classification of resolved orphans.
