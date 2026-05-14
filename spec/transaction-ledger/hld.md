# Transaction Ledger — High Level Design

## Problem Statement

The `/cashflow/transactions` page is import-only. Once a user clicks "Done" after a CSV import, all confirmed transactions are invisible — there is no browse, search, filter, or edit surface. Transfer and Excluded entries are especially lost; they land in the DB with `status=EXCLUDED` and are never surfaced anywhere. Users cannot correct mis-classifications after the fact.

---

## Goals

- Surface all imported transactions in a paginated, filterable table on the Transactions page
- Allow post-import category correction (inline edit)
- Give Transfer/Excluded transactions a visible home
- Refresh the ledger automatically after each CSV import

## Out of Scope

- Manual transaction entry (no-import transactions)
- Bulk category re-assignment
- Transaction deletion
- Export to CSV
- AI re-classification of past transactions

---

## Architecture

### Component Hierarchy

```
page.tsx (Server Component)
  — fetches bankAccounts (existing)
  — passes to TransactionsClient

TransactionsClient (Client Component)
  ├─ ImportCard row (existing)
  ├─ CSVImportWizard / AIImportWizard (existing, Portal)
  └─ TransactionLedgerTable (NEW, Client Component)
       ├─ TransactionFilters (NEW) — tabs, date range, bank account, search
       └─ table rows with TransactionRow (NEW) — inline category <select>
```

### Data Fetching

- `TransactionLedgerTable` uses **tRPC** `transactionLedger.getAll` via `useQuery` (or `useInfiniteQuery` for pagination)
- Server Component page does **not** pre-fetch transactions — the table fetches on mount client-side to keep the page fast
- After import: `CSVImportWizard` calls `onImportComplete` → `TransactionsClient` passes a `refetch` callback → `TransactionLedgerTable` calls `refetch()` after wizard closes

### Category Edit Flow

```
User changes dropdown in TransactionRow
  → tRPC mutation transactionLedger.updateCategory({ id, newCategory })
      → update Transaction.category + Transaction.source = USER_OVERRIDE
      → if DEBIT: re-rollup MonthlyExpenseSummary (decrement old, increment new)
      → if CREDIT+CONFIRMED: update IncomeRecord.source (match by userId+date+amount)
  → optimistic update in TanStack Query cache
  → toast.success() on settle
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pagination | Offset (page/limit) via tRPC | Simpler than cursor; transactions are append-only so page drift is rare |
| Tab structure | All / Expenses / Income / Excluded | Mirrors the review wizard tabs; Excluded gets its own home |
| Inline edit | `<select>` dropdown, same pattern as review table | Consistent UX; no modal overhead for simple re-categorisation |
| Category options source | tRPC returns `ExpenseCategory[]` and `IncomeSourceEnumType[]` in same query | Avoids second round-trip |
| Ledger re-rollup on edit | Synchronous in mutation handler | Amounts are small; no need for background job |
| Refresh after import | `onImportComplete` prop → `refetch()` | Keeps wizard and ledger decoupled |
| Server Component vs Client | Page stays Server; table is Client | Page load stays fast; table needs filter state |

---

## Data Model Gaps to Address

1. **No FK from `Transaction` → `IncomeRecord`** — credit category edit must match `IncomeRecord` by `(userId, amount, dateEarned)`. This is fragile for duplicate amounts on the same day. Phase 2 should add an optional `transactionId` column to `IncomeRecord` via migration.

2. **`Transaction.category` is a free string** — no FK constraint to `ExpenseCategory`. This is intentional (credits use enum strings, debits use category names). The UI must validate the dropdown value against the correct set per transaction type.

---

## tRPC Router Surface

```
transactionLedger
  .getAll(input)     → paginated Transaction rows + total count
  .updateCategory(input) → updated Transaction
```

Full signatures in LLD.
