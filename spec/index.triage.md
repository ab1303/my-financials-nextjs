# spec/index.triage.md — Overlap Triage Report

**Generated:** 2026-06-30  
**Branch:** spec-triage  
**Head SHA:** b245aad83d57e2ec1859306922a0a6b46474134f  
**Overlaps triaged:** 15 of 15  
**Subagent model:** claude-haiku-4.5 (DDD loop per `.agents/skills/doubt-driven-development/SKILL.md`)  
**Orchestrator:** claude-sonnet-4.6 (this session)

---

## Stop-Condition Check (pre-report gate)

| Rule | Threshold | Actual | Status |
|------|-----------|--------|--------|
| `confidence: low` count | > 3 triggers stop | **0** | ✅ clear |
| Max `blastRadius` | > 10 requires escalation | **2** | ✅ clear |
| Active-feature conflict (`category-groups`) | any → stop | **0 files touched** | ✅ clear |

All clear — proceeding to ranked report.

---

## Meta-Pattern (orchestrator observation)

**Root cause of 13 out of 15 overlaps:** `transactions.transactions` is a catch-all spec claiming **89 files**, many of which belong to more focused sub-features (`transactions.transaction-ledger`, `transactions.category-rules`, `transactions.reimbursements`, `csv-import.csv-import`, `architecture.category-filters`). The remaining 2 overlaps are a `user-profile` root-stub/nested-spec duplication.

**Systemic note for Step 5 (apply session):** After the 13 individual reassignments land, `transactions.transactions` will still own ~76 files. Consider whether it should be further scoped in a future session to only the core import pipeline (services under `src/server/services/transactions/` that are not claimed by any sub-feature). This is **not** a current recommendation — it exceeds the 10-file escalation threshold and requires a deliberate scope-down session.

---

## Section 1 — Auto-Approvable (`confidence: high`, `blastRadius ≤ 3`)

*14 of 15 overlaps. Safe to approve in batch; verify one against source if in doubt.*

---

### Group: assign-to-A (remove from `transactions.transactions`)

These 11 files are all presently double-claimed by `transactions.transactions` (catch-all) and a more specific sub-feature. The DDD loop confirms each belongs exclusively to the sub-feature.

#### OL-07 — `restoreVoidedTransaction.ts` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/server/trpc/router/transaction-ledger/mutations/restoreVoidedTransaction.ts` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Ledger status mutation (voided → pending); matches transaction-ledger context.md scope "Status management". |
| Key evidence | `context.md:15` lists "Status management (ALL, Expenses, Income, Excluded, Voided)"; file updates a single transaction status, not the import pipeline. |

#### OL-08 — `getUnlinkedDonationTransactions.ts` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/server/trpc/router/transaction-ledger/queries/getUnlinkedDonationTransactions.ts` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Post-import ledger query for donation-linking UI; colocated in transaction-ledger router. |
| Key evidence | `transaction-ledger/context.md:12` scope "Paginated table + Filtering"; file delegates to `donation-link.service` (not import pipeline), used by ledger browsing surface. |

#### OL-09 — `getUnlinkedZakatTransactions.ts` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/server/trpc/router/transaction-ledger/queries/getUnlinkedZakatTransactions.ts` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | tRPC query endpoint in transaction-ledger router serving the ledger's browsing/auditing surface for zakat obligations. |
| Key evidence | File is a `protectedProcedure` query in `transaction-ledger/queries/`; ledger browsing/auditing scope covers cross-domain queries that expose ledger data. |

#### OL-10 — `getVoidedTransactions.ts` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/server/trpc/router/transaction-ledger/queries/getVoidedTransactions.ts` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Paginated read on the transaction ledger filtered by VOIDED status; implements "Status management" scope. |
| Key evidence | `transaction-ledger/context.md:15` "Status management (ALL, Expenses, Income, Excluded, Voided)"; file has zero import/classification/rollup logic. |

#### OL-11 — `searchDebitTransactions.ts` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/server/trpc/router/transaction-ledger/queries/searchDebitTransactions.ts` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Ledger-scoped query for interactive table filtering (search, date range, pagination). |
| Key evidence | `transaction-ledger/context.md:14` "Filtering by bank account, date range, and description"; query filters post-import confirmed/excluded records only. |

#### OL-12 — `TransactionLedgerTable.tsx` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/components/transactions/TransactionLedgerTable.tsx` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Core ledger UI implementing paginated table, inline category editing, status filtering, and multi-field search. |
| Key evidence | `transaction-ledger/lld.md:14` "TransactionRow → transactionLedger.updateCategory" matches `shouldRetainRowAfterCategoryChange` logic; component has zero import pipeline dependencies. |

#### OL-13 — `TransactionLedgerTable.test.tsx` → `transactions.transaction-ledger`
| Field | Value |
|-------|-------|
| File | `src/__tests__/unit/TransactionLedgerTable.test.tsx` |
| Assign to | `transactions.transaction-ledger` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Test file exclusively exercises transaction-ledger UI and tRPC router — no import pipeline dependency. |
| Key evidence | Test mocks `transactionLedger.getAll`, `transactionLedger.updateCategory`, `transactionLedger.getFilterOptions`; zero reference to csv-classifier, csv-confirm, or ImportSession. |

#### OL-03 — `category-rule.service.ts` → `transactions.category-rules`
| Field | Value |
|-------|-------|
| File | `src/server/services/transactions/category-rule.service.ts` |
| Assign to | `transactions.category-rules` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Service exclusively implements category rule CRUD and application; explicitly named in `category-rules/context.md:8`. |
| Key evidence | `category-rules/context.md:8` names this file; functions `createRule`, `listRules`, `toggleRule`, `deleteRule`, `runCategoryRules`, `applyRuleToPast` are all rule-domain operations. |

#### OL-04 — `CategoryRuleDrawer.tsx` → `transactions.category-rules`
| Field | Value |
|-------|-------|
| File | `src/components/transactions/CategoryRuleDrawer.tsx` |
| Assign to | `transactions.category-rules` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Dedicated rule-creation drawer using `categoryRule.create` and `categoryRule.applyToPast` mutations. |
| Key evidence | `category-rules/context.md:13` "Inline UI for rule creation during transaction editing"; component only uses category-rules tRPC mutations. |

#### OL-05 — `CategoryRulePrompt.tsx` → `transactions.category-rules`
| Field | Value |
|-------|-------|
| File | `src/components/transactions/CategoryRulePrompt.tsx` |
| Assign to | `transactions.category-rules` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | UI prompt for rule-creation suggestion; explicitly described in category-rules LLD UX flow. |
| Key evidence | `category-rules/lld.md:22` "Detect Similar Transactions → Open Drawer"; component text "Found N similar transaction(s). Save as a category rule?" (lines 21–23). |

#### OL-02 — `TransactionReviewTable.tsx` → `csv-import.csv-import`
| Field | Value |
|-------|-------|
| File | `src/components/csv-import/TransactionReviewTable.tsx` |
| Assign to | `csv-import.csv-import` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Post-parse review UI for the csv-import wizard; renders `ClassifiedTransaction` state scoped to import sessions. |
| Key evidence | `csv-import/lld.md:9,19` Phase 2 classify/review flow; component imports `ClassifiedTransaction` from ai-import domain, implements LLM category override at line 119. |

---

### Group: assign-to-B (remove from specific sub-spec, keep in broader spec)

#### OL-01 — `CategoryFilteredLedger.tsx` → `transactions.transactions`
| Field | Value |
|-------|-------|
| File | `src/components/transactions/CategoryFilteredLedger.tsx` |
| Assign to | `transactions.transactions` |
| Remove from | `architecture.category-filters` |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Transaction display component that queries filtered transaction data; belongs to transactions, not category group authoring. |
| Key evidence | Component calls `trpc.categoryTransactions.getByCategory` (line 66) — a transaction query. `architecture.category-filters/lld.md:13-20` describes group authoring (dashboard, drawer, CRUD), not transaction display. |

---

### Group: assign-to-B (retire root stub, keep with nested feature)

#### OL-14 — `user-profile.ts` → `user-profile.user-profile`
| Field | Value |
|-------|-------|
| File | `src/server/trpc/router/user-profile.ts` |
| Assign to | `user-profile.user-profile` |
| Remove from | `user-profile` (root stub) |
| blastRadius | 2 |
| Confidence | **high** |
| DDD claim | File owned by `user-profile.user-profile`; root spec is a documented migration stub that defers all implementation. |
| Key evidence | `user-profile/context.md:3-11` is an explicit migration note; `user-profile/user-profile/lld.md:78` lists this file in File Inventory as "Protected tRPC router for profile queries and mutations". |

#### OL-15 — `user-profile.service.ts` → `user-profile.user-profile`
| Field | Value |
|-------|-------|
| File | `src/server/services/user-profile/user-profile.service.ts` |
| Assign to | `user-profile.user-profile` |
| Remove from | `user-profile` (root stub) |
| blastRadius | 1 |
| Confidence | **high** |
| DDD claim | Service layer for profile CRUD; explicitly listed in `user-profile.user-profile` LLD File Inventory. |
| Key evidence | `user-profile/user-profile/lld.md:79` "Service functions for profile CRUD, avatar operations, and password changes"; `context.md:63` "file inventory live in lld.md only". |

> **Follow-up action for apply session:** Once OL-14 and OL-15 are resolved, the `user-profile` root stub entry in `spec/index.json` has an empty `owns[]` and should be removed from the manifest entirely. This is a `retire-one` on the root stub — blastRadius 0 after the two reassignments land.

---

## Section 2 — Needs Human Review (`confidence: medium` or `reconcile: Stop`)

*0 remaining — OL-06 resolved by human on 2026-06-30.*

---

#### OL-06 — `ReimbursementSubRow.tsx` → `transactions.reimbursements` ✅ (human-approved 2026-06-30)
| Field | Value |
|-------|-------|
| File | `src/components/transactions/ReimbursementSubRow.tsx` |
| Recommendation | assign-to-A → `transactions.reimbursements` |
| Remove from | `transactions.transactions` |
| blastRadius | 1 |
| Confidence | **medium → approved** |
| Reconcile | Stop → **Proceed** (human resolved the `?` assumptions) |

**Resolution:** Human confirmed single-import exclusivity. Grep result: only `TransactionRow.tsx:22` imports this component. `TransactionRow.donation-badge.test.tsx` mocks it, confirming test coverage is transaction-row scoped. No import pipeline usage.  The two `?` assumptions are now resolved ✓ — approve as auto-approvable.

---

## Section 3 — Escalation Required (`confidence: low`)

*0 of 15 overlaps.* No escalation needed.

---

## Summary Table

| # | File (short) | Rec | Assign To | Remove From | Conf | Tier |
|---|-------------|-----|-----------|-------------|------|------|
| OL-01 | CategoryFilteredLedger.tsx | assign-to-B | transactions.transactions | architecture.category-filters | high | Auto |
| OL-02 | TransactionReviewTable.tsx | assign-to-A | csv-import.csv-import | transactions.transactions | high | Auto |
| OL-03 | category-rule.service.ts | assign-to-A | transactions.category-rules | transactions.transactions | high | Auto |
| OL-04 | CategoryRuleDrawer.tsx | assign-to-A | transactions.category-rules | transactions.transactions | high | Auto |
| OL-05 | CategoryRulePrompt.tsx | assign-to-A | transactions.category-rules | transactions.transactions | high | Auto |
| OL-06 | ReimbursementSubRow.tsx | assign-to-A | transactions.reimbursements | transactions.transactions | medium ✅ | **Auto** (human-approved) |
| OL-07 | restoreVoidedTransaction.ts | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-08 | getUnlinkedDonationTransactions.ts | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-09 | getUnlinkedZakatTransactions.ts | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-10 | getVoidedTransactions.ts | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-11 | searchDebitTransactions.ts | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-12 | TransactionLedgerTable.tsx | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-13 | TransactionLedgerTable.test.tsx | assign-to-A | transactions.transaction-ledger | transactions.transactions | high | Auto |
| OL-14 | user-profile.ts | assign-to-B | user-profile.user-profile | user-profile (stub) | high | Auto |
| OL-15 | user-profile.service.ts | assign-to-B | user-profile.user-profile | user-profile (stub) | high | Auto |

**Grouped by type:**
| Type | Count | Overlaps |
|------|-------|---------|
| assign-to-A (sub-spec wins) | 12 | OL-02..13 |
| assign-to-B (broader spec wins / stub retired) | 3 | OL-01, OL-14, OL-15 |
| split | 0 | — |
| retire-one | 0 (follow-up) | `user-profile` root stub post-apply |
| merge | 0 | — |

---

## Apply Session Instructions (Step 5)

Open a new session. Do **not** modify source files — only `spec/index.json` `owns[]` entries and the spec docs.

**Per-recommendation action (spec/index.json only):**

For each OL in Auto-approvable:
1. Remove `file` from the `removeFrom` feature's `owns` block.
2. Confirm `file` is present in the `assignTo` feature's `owns` block (add if missing).
3. Set `needsReview: false` and stamp `lastVerifiedSha: b245aad` on both affected features after all edits land.

**OL-06 (ReimbursementSubRow.tsx):** Run the verifier query above first. Apply only after human confirmation.

**OL-14 + OL-15 follow-up:** After both reassignments, remove the `user-profile` root stub entry from `spec/index.json` entirely (its `owns[]` will be empty).

**Re-baseline command (Step 6):**
```bash
node scripts/generate-spec-index.mjs --force
pnpm spec:check --no-review
```
Expected: `overlap === 0`.

---

## DDD Compliance Checklist

- [x] Every CLAIM is a single declarative sentence
- [x] Every EXTRACT produced ≥2 numbered assumptions
- [x] Every assumption in DOUBT is marked ✓/✗/? with evidence (file:line or spec reference)
- [x] RECONCILE yielded Proceed, Revise, or Stop — recorded per overlap
- [x] No Tier 3 action taken (no source files modified, no spec/index.json modified)
- [x] OL-06 `reconcile: Stop` surfaced to human review section
- [x] Active feature (`category-groups`) confirmed unaffected
