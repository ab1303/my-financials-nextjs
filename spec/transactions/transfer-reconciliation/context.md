# Transfer Reconciliation — Context

## Problem

When users upload CSVs from multiple bank accounts, inter-account transfers appear on both sides. The credit side is already handled (LLM labels it `"Transfer"` → `status=EXCLUDED`). The debit side is not: the LLM assigns an expense category, which writes a `MonthlyExpenseSummary` entry and inflates expenses. For a user doing a $2,500 fortnightly salary split, this creates $30,000+ of phantom annual expenses, making expense reports completely unreliable.

## Domain Dependencies

- Uses: `Transaction` model from domain HLD; reuses `rerollupExpenseSummary()` from `ledger.service.ts` (calling with `newCategory: 'Transfer'` safely decrements without adding to a new category)
- Patterns: Self-referential 1:1 on `Transaction` via `"TransferLink"` named relation (mirrors existing `"ReimbursementLink"` pattern); `preLinkCategory`/`preLinkStatus` for safe unlink
- Related features: transactions (LLM prompt fix in Phase 1A), transaction-ledger (Transfer tab + link action button), transfer-match-rules (Phase 2 auto-matching), undo-safeguards (transfer cleanup on void)

## Scope

**In scope:**
- Phase 1A: Add `'Transfer'` to debit LLM prompt; guard in confirm service to skip rollup
- Phase 1B: Schema migration (`transferLinkedTransactionId`, `preLinkCategory`, `preLinkStatus`); `transfer.service.ts`; `transfer` tRPC router
- Phase 2: Transfer linking UI in transaction ledger (`TransferLinkDrawer`, `UnmatchedTransfersBadge`)
- Manual linking with scored auto-suggestions (never auto-link without user confirmation in MVP)
- Rollup reversal on link; category/status restore on unlink

**Out of scope:**
- Auto-link without user confirmation
- Rule-based auto-matching engine (Phase 3, see transfer-match-rules)
- Split transfer matching (1 debit → N credits)
- Foreign currency / FX rate transfers
- Credit card payment reconciliation

## Known Constraints

- `@unique` on `transferLinkedTransactionId` enforces 1:1 — a transaction cannot be part of two transfer pairs
- No `TRANSFER` status enum value: `status=EXCLUDED` + `category='Transfer'` is the discriminator; adding a new enum would require migrating existing EXCLUDED rows
- Phase 1A (LLM prompt fix) is deployable independently from Phase 1B (schema + linking)

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `transferLinkedTransactionId`, `preLinkCategory`, `preLinkStatus` to Transaction |
| `src/server/services/transactions/transfer.service.ts` | CREATE | `getCandidates`, `linkTransferPair`, `unlinkTransferPair`, `getUnmatchedTransfers` |
| `src/server/api/routers/transfer.ts` | CREATE | tRPC router: `getCandidates`, `link`, `unlink`, `getUnmatched`, `getPairs` |
| `src/components/transactions/TransferLinkDrawer.tsx` | CREATE | Scored candidate list, confirm/cancel, amount-mismatch warning |
| `src/components/transactions/UnmatchedTransfersBadge.tsx` | CREATE | Badge in Transfer tab showing unmatched count |
| `src/server/api/routers/transaction-ledger.ts` | MODIFY | Expose `transferLinkedTransactionId` in `TransactionRow`; add `transferOnly` filter |
| `src/components/transactions/TransactionLedgerTable.tsx` | MODIFY | "Link as Transfer" action button on eligible rows |
