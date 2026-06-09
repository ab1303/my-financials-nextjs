# Bank Account Filter Parity — Context

## Problem
Bank account filters on Income, Expense, and Bank Interest pages were decorative and non-functional, creating a false impression of filtering capability while providing no actual data scoping.

## Architecture
- **Filtering**: `bankAccountId` is passed to data handlers, filtering `Transaction` queries by `bankAccountId` OR source is manual.
- **Service Layer**: Data handlers respect `bankAccountId` (null = all accounts).
- **UI**: Shared `CashflowBankSelector` component.

## Scope
- Parity of bank filtering across Income, Expense, and Bank Interest pages.
- Inclusion of manual entries in all filtered views (manual entries do not have a bank).
- Consistent communication of filter scope via UI tooltips.
