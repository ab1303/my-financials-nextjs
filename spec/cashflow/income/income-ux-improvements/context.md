# Income UX Improvements — Context

## Problem
The base income flow works, but users need faster searching, clearer categorization, and lower-friction editing so high-frequency income maintenance does not become a bottleneck.

## Domain Dependencies

- Builds on the income-management feature and the shared `IncomeRecord` and `CashflowPeriod` concepts in [`../../hld.md`](../../hld.md).
- Must preserve the server/client boundary already established for cashflow features.
- Contributes usability improvements that can later be audited by the cashflow audit feature.

## Scope

**In scope:**
- Search, filtering, sorting, and batch operations for income records.
- Accessibility, keyboard support, and table ergonomics for the income UI.
- Presentation improvements that sit on top of existing income CRUD behavior.

**Out of scope:**
- Redefining the underlying income data model.
- Expense, interest, or audit-specific workflows.
- Business logic that belongs in the base income-management feature.