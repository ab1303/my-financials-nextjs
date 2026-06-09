# Import Audit Trail — Context

## Problem
Users lacked visibility into the transaction import process, making it difficult to validate imports, trace transaction origins, or safely undo incorrect imports.

## Architecture
- **Tracking**: Import sessions tracked via `ImportSession` model.
- **Service Layer**: `src/server/services/transactions/import-audit.service.ts` provides metadata and audit helpers.
- **API**: `transactionClearing` tRPC router (`src/server/trpc/router/transaction-clearing.ts`).

## Scope
- Import source display in ledger.
- Skipped/error counts in Import History.
- Validation modal for import reversals.
- Soft-deletion via `status: 'VOIDED'`.
