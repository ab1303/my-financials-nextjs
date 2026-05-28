# Cashflow: Transfer Resolution UX Improvements (HLD)

## Problem & Proposed Solution

The OrphanResolutionPanel in the Transfers tab currently forces users to resolve orphaned transfers with hardcoded categories and no way to undo or reclassify. This leads to inaccurate reporting and irreversible mistakes. The solution is a two-step resolution flow with category pickers and a reversible, user-driven reclassification mechanism, all within the existing panel.

## Architecture Decisions

1. **Two-step resolution for EXPENSE/INCOME**: Users must select a category/source before confirming, preventing misclassification.
2. **Category data sources**: Expense uses `expenseCategory.getAllActive`, income uses `incomeSource.getAllActive` for accuracy and consistency.
3. **Reversibility via re-classify**: Resolved orphans appear in a collapsible section with a "Re-classify" button, allowing users to reset mistakes.
4. **No schema changes**: All logic leverages the existing `orphanResolution` and `category` fields; no migrations required.
5. **tRPC-driven state**: All mutations and queries are handled via tRPC, ensuring type safety and centralized business logic.
6. **Guardrails on reset**: Only the owning user can reset, and only for unlinked transfers, preventing data integrity issues.
7. **UI/UX: Collapsed resolved section**: Resolved orphans are hidden by default to avoid clutter, but easily accessible.

## Data Model Changes

- **None required**. All changes are additive to UI and tRPC procedures using the existing model:

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

## Component/Service Changes (High-Level)

- **OrphanResolutionPanel.tsx**: Rewrite to support two-step category/source selection and resolved section with re-classify.
- **tRPC transfer router**: Add `getResolvedOrphans` query and `resetOrphanResolution` mutation.

## Success Criteria

- Users can select a category/source before confirming EXPENSE/INCOME resolutions.
- Resolved orphans are visible in a collapsible section with a re-classify option.
- Users can reclassify any resolved orphan they own (if unlinked).
- No schema migrations are required; all changes are additive.
- No resolved orphan is permanently hidden; all can be reclassified.

## Out of Scope / Future Phases

| Phase | Description |
|-------|-------------|
| P0    | Retroactive auto-detection/backfill for existing orphans |
| P3    | Immediate undo toast after resolution |