# Import Audit Trail — Feature Context

## Problem Summary

Users lack visibility and trust in the transaction import process. There is no way to immediately validate what was imported, what was skipped, or trace the source of each transaction. This leads to auditability concerns and makes it difficult to safely undo imports.

## Domain Dependencies

- Relies on `transactions/hld.md` #2: Soft delete (VOIDED status) preserves audit trail
- Uses existing `ImportSession` and `importSessionId` fields for linkage

## Scope Boundary

**IN SCOPE:**
- Display import source in transaction ledger and import history
- Show skipped/error counts in Import History
- Add validation/review modal before undoing imports
- Add tRPC queries/services for import session details
- UI and service enhancements only (no schema changes)

**OUT OF SCOPE:**
- Schema/model changes
- Hard delete of transactions
- Bulk restore/redo of imports
- Import from new sources
- Automated reconciliation

## Schema References

- `ImportSession` (see provided Prisma schema)
- `Transaction` (see provided Prisma schema)
- No schema migration required; all fields already exist

## Existing Patterns to Reuse

- tRPC service/query/mutation structure in `src/server/trpc/router/`
- Client Components with Server Actions for UI
- Toast notifications via `sonner`

## Known Constraints

- Soft delete (VOIDED) is the only allowed deletion method in Phase 1
- No hard-delete or schema changes permitted
