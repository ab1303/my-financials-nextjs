# Transaction Clearing (Void & Undo) — Context

## Problem

The app's import-confirm pipeline has no reversal mechanism. Once a user confirms a CSV or AI import, the downstream financial aggregates (`MonthlyExpenseSummary`, `IncomeRecord`) are permanently written with no path to correction other than re-importing — which compounds incorrect values rather than replacing them. The `IncomeRecord` model also has no FK back to the `Transaction` that created it, making CREDIT reversals fragile and match-based rather than precise.

## Domain Dependencies

- Uses: `Transaction`, `ImportSession` models from domain HLD; `VOIDED` status and `ImportStatusEnum.VOIDED` enum values
- Patterns: `prisma.$transaction` for atomic reversal; `preLinkCategory`/`preLinkStatus` pattern (mirrors transfer-reconciliation); `onDelete: SetNull` for IncomeRecord FK (mirrors DonationPayment)
- Related features: transaction-dedup (VOIDED transactions excluded from dedup set), transaction-ledger (Voided tab), undo-safeguards (extends this feature with transfer cleanup + fiscal year warnings)

## Scope

**In scope:**
- Phase 1: Schema migration — `VOIDED` enum values on `TransactionStatusEnum` and `ImportStatusEnum`; `IncomeRecord.transactionId` nullable FK; backfill migration
- Phase 2: `void.service.ts` + `transactionClearing` tRPC router (`undoImportSession`, `voidTransaction`)
- Phase 3: Import Session History UI on `/cashflow/transactions` + Undo confirmation modal
- Phase 4: Individual void button in `TransactionLedgerTable`

**Out of scope:**
- Hard-deleting `Transaction` records (except voided purge in undo-safeguards Gap B)
- Re-importing after undo automatically
- Partial session undo (individual `voidTransaction` covers partial corrections)
- Undo of AI image imports

## Known Constraints

- Reversal is always atomic — partial reversal creates worse data corruption than the original problem
- `VOIDED` is a terminal state — voided transactions cannot be re-confirmed (except via bulk reactivation in undo-safeguards Gap A)
- The `IncomeRecord.transactionId` FK fix is a prerequisite for Phase 2 — without it, CREDIT reversal must match by `(incomeLedgerId, dateEarned, amount)`, which is fragile for duplicate amounts same day
- `onDelete: SetNull` not `Cascade` — deleting a Transaction unlinks (does not delete) the IncomeRecord

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `VOIDED` to `TransactionStatusEnum` and `ImportStatusEnum`; add `IncomeRecord.transactionId` FK |
| `src/server/services/transactions/void.service.ts` | CREATE | `reverseDownstream(tx)`, `undoImportSession(sessionId, userId)`, `voidTransaction(txId, userId)` |
| `src/server/api/routers/transaction-clearing.ts` | CREATE | tRPC router: `undoImportSession`, `voidTransaction`, `listImportSessions` |
| `src/server/api/root.ts` | MODIFY | Register `transactionClearing` router |
| `src/components/transactions/ImportSessionHistory.tsx` | CREATE | Recent sessions list with Undo button |
| `src/components/transactions/TransactionLedgerTable.tsx` | MODIFY | Add Voided tab; void icon button on CONFIRMED/EXCLUDED rows |
