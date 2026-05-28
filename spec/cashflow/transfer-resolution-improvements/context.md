# Transfer Resolution UX — Context

## Problem Summary

The current OrphanResolutionPanel forces users to resolve orphaned transfers with hardcoded categories and no way to undo or reclassify. This results in inaccurate reporting and irreversible mistakes for users.

## Domain Dependencies
- See [spec/cashflow/hld.md](./hld.md) for architecture, data model, and rationale.
- Relies on Transaction as the source of truth for all cashflow events.

## Scope Boundary

**IN SCOPE:**
- Two-step category/source selection for EXPENSE/INCOME resolutions
- Collapsible resolved section with re-classify (reset) action
- tRPC procedures for fetching resolved orphans and resetting resolution
- UI/UX changes to OrphanResolutionPanel only

**OUT OF SCOPE:**
- Schema changes or migrations
- Retroactive detection/backfill (P0)
- Immediate undo toast (P3)
- Any changes outside the OrphanResolutionPanel or transfer tRPC router

## Schema References

```prisma
enum TransferOrphanResolution {
  EXCLUDED
  EXPENSE
  INCOME
}

model Transaction {
  id                           String                     @id @default(cuid())
  userId                       String
  category                     String
  type                         TransactionTypeEnum
  status                       TransactionStatusEnum      @default(CONFIRMED)
  transferLinkedTransactionId  String?                    @unique
  orphanResolution             TransferOrphanResolution?  // null = unresolved orphan
  // ... other fields
}
```

## Existing Patterns to Reuse
- tRPC protected procedures for mutations/queries
- Category pickers from expense/income flows
- Collapsible UI sections (Flowbite/Tailwind)

## Known Constraints/Gotchas
- No schema changes allowed
- Only unlinked transfers can be reset
- Must not expose other users' transactions
- Resolved section must be collapsed by default
- All changes must be additive and non-breaking