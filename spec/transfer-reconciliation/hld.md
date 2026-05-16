# Transfer Reconciliation — High Level Design

**Version:** 1.0
**Status:** Specced
**Feature:** Prevent inter-account transfers from inflating expense/income reports

---

## Problem Statement

When users upload CSVs from multiple bank accounts, inter-account transfers appear on both sides. The credit side (receiving account) is already handled — the LLM classifier has a `"Transfer"` label which routes credits to `status=EXCLUDED`, preventing income inflation. The debit side (sending account) is **not handled**: `"Transfer"` is absent from the debit classifier prompt, so the LLM assigns an expense category (e.g. "Miscellaneous"), which writes a `MonthlyExpenseSummary` entry and inflates expenses by the full transfer amount.

For a user who does a $2,500 fortnightly salary split (Savings → Current), this creates $30,000+ of phantom annual expenses, making expense reports and budget tracking completely unreliable. The proposed solution has two parts: (1) a quick-win LLM prompt fix that stops new transfers from inflating expenses at import time, and (2) a transfer pair linking system that allows both sides of a transfer to be formally linked, enabling reconciliation, audit, and retroactive correction.

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | **Debit "Transfer" category** | Add to LLM debit classifier prompt as a first-class category | Stops expense inflation at source. One-line prompt change, zero schema changes. Highest ROI action. |
| 2 | **Transfer link data model** | Self-referential 1:1 on `Transaction` via new `"TransferLink"` named relation | Mirrors the existing `"ReimbursementLink"` pattern. Consistent, proven in the codebase. No new join table needed. `@unique` enforces 1:1. |
| 3 | **Matching strategy (MVP)** | Manual linking with scored auto-suggestions | Financial data accuracy is paramount — never auto-link without user confirmation in MVP. Auto-suggestions assist, never act. |
| 4 | **Rollup reversal** | Reuse existing `rerollupExpenseSummary()` from `ledger.service.ts` | Already handles category movement logic. Calling with `newCategory: 'Transfer'` (not a real `ExpenseCategory`) safely skips the upsert — amount is decremented from old category, nothing added. |
| 5 | **Pre-link state storage** | `preLinkCategory` and `preLinkStatus` nullable columns on `Transaction` | Required for safe unlink — allows exact revert to prior state without replaying business rules. Mirrors `offsetCategory` convention for reimbursements. |
| 6 | **Candidate scoring** | Computed on-demand in tRPC query, not persisted | Candidates change as new transactions are imported. Persisting scores would require cache invalidation. On-demand is simpler and sufficient for MVP scale. |
| 7 | **No Transfer status enum value** | Keep `status=EXCLUDED` for transfer transactions | Adding `TRANSFER` status would require migrating existing `EXCLUDED` rows and updating all status-based queries. `category='Transfer'` is the discriminator. `EXCLUDED` correctly suppresses downstream writes. |
| 8 | **Cross-bank transfers** | Same model as same-bank; scoring weights differ | No schema distinction needed. Cross-bank transfers score lower on `descriptionSimilarity` and `sameBankBonus`, prompting user attention without special-casing the flow. |
| 9 | **Phase boundary** | Phase 1A (prompt fix) deployable independently from Phase 1B (schema + linking) | Phase 1A has zero risk — no schema, no migration, no UI change. Delivers value immediately. Phase 1B can ship in next iteration. |

---

## Data Model Changes

### New fields on `Transaction`

```prisma
model Transaction {
  // ... all existing fields unchanged ...

  // Transfer reconciliation
  transferLinkedTransactionId  String?                @unique
  transferLinkedTransaction    Transaction?           @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart          Transaction?           @relation("TransferLink")
  preLinkCategory              String?
  preLinkStatus                TransactionStatusEnum?
}
```

**Migration safety:**
- All three new fields are nullable — non-breaking `ALTER TABLE ADD COLUMN`
- `@unique` on `transferLinkedTransactionId` is added with the column (no data to conflict)
- No retroactive data migration required

### No new models

The `TransferMatchCandidate` scoring result is a TypeScript interface only — computed on-demand, never persisted.

---

## Component and Service Changes

### Phase 1A — LLM Classifier Fix

| Component | Change |
|-----------|--------|
| `csv-classifier.service.ts` | Add `'Transfer'` to debit system prompt categories with description: "money moved between your own accounts" |
| `csv-confirm.service.ts` | Guard in `confirmDebitTransactions`: if `category === 'Transfer'` → `status=EXCLUDED`, skip `upsertMonthlyExpenseSummary` |
| `constants.ts` | Add `TRANSFER_CATEGORY` and `EXCLUDED_DEBIT_LABELS` constants |

### Phase 1B — Schema + Transfer Service

| Component | Change |
|-----------|--------|
| `prisma/schema.prisma` | Add `transferLinkedTransactionId`, `preLinkCategory`, `preLinkStatus` |
| `transfer.service.ts` | New service: `getCandidates()`, `linkTransferPair()`, `unlinkTransferPair()`, `getUnmatchedTransfers()` |
| `transfer.ts` (tRPC router) | New router: `getCandidates`, `link`, `unlink`, `getUnmatched`, `getPairs` |

### Phase 2 — Transfer Linking UI

| Component | Change |
|-----------|--------|
| `transaction-ledger.ts` (tRPC) | Expose `transferLinkedTransactionId` in `TransactionRow`; add `transferOnly` filter |
| `TransactionLedgerTable.tsx` | Add "Link as Transfer" action button on eligible rows; render `TransferLinkDrawer` |
| `TransferLinkDrawer.tsx` | New: shows scored candidates, confirm/cancel, amount-mismatch warning |
| `UnmatchedTransfersBadge.tsx` | New: badge in the Transfer tab showing unmatched count |

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| 1 | Debit transactions classified as "Transfer" do NOT appear in `MonthlyExpenseSummary` | Unit test on `confirmDebitTransactions` |
| 2 | Uploading a CSV with a transfer debit creates `Transaction(DEBIT, EXCLUDED, category='Transfer')` | Unit test + integration test |
| 3 | Two transactions can be linked as a transfer pair via `transfer.link` mutation | Unit test |
| 4 | Linking a previously-CONFIRMED debit reverses its `MonthlyExpenseSummary` entry | Unit test |
| 5 | Unlinking a transfer pair reverts both transactions to their `preLinkCategory`/`preLinkStatus` | Unit test |
| 6 | `transfer.getCandidates` returns candidates sorted by score descending, excluding same-account transactions | Unit test |
| 7 | A transaction cannot be part of two transfer pairs (enforced by `@unique`) | Prisma constraint + service-layer guard |
| 8 | `transfer.getUnmatched` returns only Transfer-classified transactions with no linked counterpart | Unit test |
| 9 | `pnpm run build` passes | CI |
| 10 | Existing unit tests pass unchanged | CI |

---

## Out of Scope / Future Phases

| Item | Phase | Reason |
|------|-------|--------|
| Auto-link without user confirmation | Future | False positives in financial data are unacceptable in MVP |
| Rule-based auto-matching engine (confidence threshold) | Phase 3 | Requires pattern learning and tuning before safe deployment |
| `TransferPatternMap` table (learned description pairs) | Phase 3 | Needs a corpus of confirmed links to train on |
| Split transfer matching (1 debit → N credits) | Future | Complex UI; rare scenario |
| Foreign currency / FX rate transfers | Out of scope | FX handling not modelled anywhere in the app |
| Credit card payment reconciliation | Out of scope | Credit cards not modelled as `BankAccount` |
| Voided/reversed transfer handling (4-way matching) | Future | Complex; very rare |
| Bulk auto-reconcile historical data | Phase 3 | Depends on Phase 1B linking infrastructure |
| Transfer analytics dashboard | Future | Nice-to-have; not blocking accuracy |
| Retroactive dedup of existing phantom expense entries | Phase 3 | Requires UI to review and revert existing `MonthlyExpenseSummary` entries |
