# Bank Account Filter Parity — Context

## Problem Statement

Bank account filters on Income, Expense, and Bank Interest pages are **decorative and non-functional**:

- **Income page**: Shows global `Business` records (type='BANK') in dropdown; filter does not pass selection to data handlers
- **Expense page**: Shows global `Business` records in dropdown; filter does not pass selection to data handlers  
- **Bank Interest page**: Uses wrong entity (`Business` via `institutionId`) instead of user's `FinancialAccount` records
- **Transaction Ledger**: ✅ Already correct — filters by `FinancialAccount.id`, passes `bankAccountId` to handlers

These dropdowns create false impression of filtering capability while providing no actual data scoping.

## Root Cause

Current implementation confuses two concepts:
- **Global bank registry** (`Business` table with type='BANK'): Shared reference data for all users
- **User's bank accounts** (`FinancialAccount` table): User-specific financial accounts at institutions

The correct pattern (from Transaction Ledger):
- Show user's own `FinancialAccount` records in dropdown
- Pass selected `bankAccountId` (FinancialAccount.id) to all data handlers
- Exclude manual entries (source=MANUAL/USER_MANUAL) from bank filter, always display them

## Domain Dependencies

### FinancialAccount Model

```prisma
model FinancialAccount {
  id              String
  name            String
  institutionId   String (FK → Business)
  userId          String (FK → User)
  isTracked       Boolean
  
  transactions    Transaction[]
}
```

### Transaction Model (Relevant Fields)

```prisma
model Transaction {
  id              String
  bankAccountId   String? (FK → FinancialAccount, nullable)
  source          Enum: IMPORTED, MANUAL, USER_MANUAL, etc.
  // ... other fields
}
```

### CalendarYear

Used for date scoping in Income and Expense pages; bank filter is orthogonal to date filter.

## Scope: In

1. **Income page** (`src/app/(authenticated)/(dashboard)/income/`):
   - Update bank dropdown to show user's `FinancialAccount` records
   - Pass selected `bankAccountId` to `getIncomeEntries()` and `getTotalIncome()` handlers

2. **Expense page** (`src/app/(authenticated)/(dashboard)/expenses/`):
   - Update bank dropdown to show user's `FinancialAccount` records
   - Pass selected `bankAccountId` to `getExpenseEntriesForMonth()` and `getTotalExpenses()` handlers

3. **Bank Interest page** (`src/app/(authenticated)/(dashboard)/bank-interest/`):
   - Replace Business institution lookup with direct `FinancialAccount` filtering
   - Pass `bankAccountId` directly to data handlers

4. **Manual entry display behavior**:
   - Entries with source=MANUAL/USER_MANUAL have `bankAccountId = null`
   - Always display manual entries regardless of bank filter selection
   - Add UI tooltip: "Bank filter applies to imported transactions only. Manual entries always shown."

## Scope: Out

- Creating new `FinancialAccount` records (account linking handled separately)
- CSV import or batch transaction creation changes
- Transaction Ledger modifications (already implements correct pattern)
- Donations page (optional future enhancement, not part of parity fix)
- Refactoring Business table or global bank registry

## Success Criteria

✅ All three pages show user's own FinancialAccount records in bank dropdown  
✅ Bank filter passes `bankAccountId` parameter to all data handlers  
✅ Manual entries appear in all views regardless of bank filter  
✅ UI clearly communicates filter scope (imported vs. manual)  
✅ Behavior consistent across Income, Expense, Bank Interest pages
