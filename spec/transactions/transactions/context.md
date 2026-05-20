# Transactions (Import Pipeline) — Context

## Problem

The transactions import pipeline is the entry point for all financial data. It handles CSV and AI-based imports, routes transactions through LLM classification, writes confirmed DEBIT transactions to `MonthlyExpenseSummary`, writes confirmed CREDIT transactions to `IncomeRecord`, and marks transfers/exclusions as `EXCLUDED`. Without a robust import pipeline, all downstream features (ledger, enrichment, reconciliation) have no data.

## Domain Dependencies

- Uses: `Transaction`, `ImportSession`, `BankAccount` models from domain HLD
- Patterns: `protectedProcedure` tRPC, LLM classifier service, `prisma.$transaction` for atomic writes
- Related features: transaction-ledger (post-import visibility), transaction-dedup (overlap prevention), transaction-clearing (undo/void)

## Scope

**In scope:**
- CSV bank statement import wizard (multi-step: upload → classify → review → confirm)
- AI receipt/invoice import wizard
- LLM-based transaction classification (debit categories + income source labels)
- Downstream writes: `MonthlyExpenseSummary` for debits, `IncomeRecord` for credits
- Import session tracking (`ImportSession` model, status: PENDING → COMPLETED/FAILED)

**Out of scope:**
- Manual transaction entry without an import
- Real-time bank API sync
- Retroactive re-classification of past imports (handled by transaction-ledger updateCategory)

## Known Constraints

- `category` on `Transaction` is a free string — no FK to `ExpenseCategory`; UI must validate against the correct set per transaction type
- LLM classification is best-effort; user can correct via transaction-ledger inline edit
- `Transaction` has no direct FK to `IncomeRecord` in the baseline — this is addressed by transaction-clearing Phase 1 (adds `IncomeRecord.transactionId`)

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/ai-import/csv-classifier.service.ts` | MODIFY | LLM debit/credit classification; add Transfer to debit prompt |
| `src/server/services/transactions/csv-confirm.service.ts` | MODIFY | Confirm pipeline: dedup check, transfer guard, rollup writes |
| `src/app/api/transactions/csv/confirm/route.ts` | MODIFY | Aggregates results, returns JSON response to wizard |
| `src/app/(authorized)/cashflow/transactions/_components/TransactionsClient.tsx` | MODIFY | Client wrapper for import cards and ledger table |
| `src/app/(authorized)/cashflow/transactions/page.tsx` | MODIFY | Server Component: fetches bankAccounts, passes to client |
