# Import Audit Trail (Transactions Domain)

## Problem

Users currently lack trust in the transaction import process due to insufficient visibility into what was imported, skipped, or failed. There is no immediate way to validate the count of imported transactions, trace the origin of each transaction, or review skipped/error reasons. This undermines the integrity of the import process and makes it difficult to audit or undo imports safely.

## Solution

Introduce an import audit trail by leveraging the existing `ImportSession` and `importSessionId` fields. Enhance the UI and API to display import source, skipped counts, and provide a validation/review modal before undoing imports. All changes are additive and do not require schema migrations.

## Architecture Decisions

1. **Soft Delete Only**: Transactions are never hard-deleted; `status: 'VOIDED'` is used for reversals. (See transactions/hld.md #2)
2. **ImportSession as Source of Truth**: All import metadata and transaction linkage are tracked via `ImportSession` and `importSessionId`.
3. **No Schema Changes in Phase 1**: All required fields already exist; only service and UI enhancements are needed.
4. **Audit Trail in UI**: Import source and skipped counts are surfaced in Import History and Ledger components for transparency.
5. **Validation Before Undo**: Users must review affected transactions before undoing an import, reducing accidental data loss.
6. **tRPC Service Pattern**: All new queries/mutations follow the existing tRPC router/service structure for consistency.

## Data Model Changes

- **None for Phase 1**. All required fields (`importSessionId`, `status`, etc.) already exist in `Transaction` and `ImportSession`.

## Component/Service Changes (High-Level)

- Enhance Import History and Ledger UI to show import source and skipped counts
- Add validation/review modal before undoing imports
- Add tRPC queries/services to fetch import session details and metadata

## Success Criteria

- Users can see which transactions came from which import session
- Skipped/error counts are visible in Import History
- Import source is shown in the transaction ledger
- Users can review affected transactions before undoing an import
- No schema migrations required

## Out of Scope

| Area                        | Rationale                                 |
|-----------------------------|-------------------------------------------|
| Schema changes              | Not needed; all data already present      |
| Hard delete of transactions | Soft delete is required for audit trail   |
| Bulk restore/redo           | Not included in Phase 1                   |
| Import from new sources     | Only UI/service enhancements in scope     |
| Automated reconciliation    | Not part of this feature                  |
