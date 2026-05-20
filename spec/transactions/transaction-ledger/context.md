# Transaction Ledger — Context

## Problem

After a user completes a CSV import wizard, the confirmed transactions are written to the database but are completely invisible in the UI. The `/cashflow/transactions` page only shows import buttons. There is no way to browse, search, filter, or edit past transactions. Transfer/Excluded entries are orphaned audit records with no surface area in the app.

## Domain Dependencies

- Uses: `Transaction`, `BankAccount` models from domain HLD
- Patterns: `protectedProcedure` tRPC, offset pagination, TanStack Query `useQuery`, inline `<select>` edit
- Related features: transactions (import pipeline feeds the ledger), transaction-clearing (VOIDED tab), transfer-reconciliation (Transfer tab + link actions), transaction-enrichment (attribution badges)

## Scope

**In scope:**
- Paginated, filterable table of all transactions on `/cashflow/transactions`
- Tab structure: All / Expenses / Income / Excluded / Voided
- Inline category edit (re-rolls `MonthlyExpenseSummary` for debits, updates `IncomeRecord` source for credits)
- Auto-refresh after CSV/AI import completes (`refreshKey` pattern)
- Bank account, date range, and description search filters

**Out of scope:**
- Manual transaction entry
- Bulk category re-assignment
- Transaction deletion (handled by transaction-clearing voided purge)
- Export to CSV
- AI re-classification of past transactions

## Known Constraints

- `Transaction.category` is a free string — no FK to `ExpenseCategory`; UI must validate dropdown value against the correct set per transaction type
- No direct FK from `Transaction` → `IncomeRecord` in baseline; credit category edit matches by `(userId, date, amount)` — fragile for duplicate amounts same day. Phase 2 of transaction-clearing adds the FK.
- Page stays Server Component; ledger table is Client Component to keep page load fast

## Files

| File | Action | Description |
|---|---|---|
| `src/server/api/routers/transaction-ledger.ts` | CREATE | tRPC router: `getAll` (paginated query), `updateCategory` (mutation) |
| `src/components/transactions/TransactionLedgerTable.tsx` | CREATE | Main ledger table Client Component — tabs, filters, rows |
| `src/components/transactions/TransactionFilters.tsx` | CREATE | Filter bar — type tabs, date range, bank account, search |
| `src/components/transactions/TransactionRow.tsx` | CREATE | Single row with inline category edit |
| `src/server/services/transactions/ledger.service.ts` | CREATE | DB logic — query builder, `rerollupExpenseSummary`, `updateIncomeRecordSource` |
| `src/server/api/root.ts` | MODIFY | Register `transactionLedger` router |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | MODIFY | Add `<TransactionLedgerTable>` below import cards; `refreshKey` state |
| `src/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard.tsx` | MODIFY | Call `onImportComplete` after successful confirm |
