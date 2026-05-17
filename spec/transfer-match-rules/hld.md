# Transfer Match Rules — High-Level Design

**Feature:** `transfer-match-rules`
**Depends on:** `transfer-reconciliation` (implemented)

---

## Problem & Proposed Solution

Users with regular inter-account transfers (weekly CBA top-ups, monthly salary routing, recurring paybacks) must manually link every DEBIT/CREDIT pair after each CSV upload. The current `TransferLinkDrawer` handles one pair at a time with no memory of past patterns. For users uploading 12 months of transactions at once, this is dozens of manual operations.

The solution is two-phase. **Phase 1 (Smart Match)** detects patterns in a single session: after the user confirms one manual link, the system scans all unmatched transfers in the current dataset, surfaces candidate pairs grouped by the same pattern, and lets the user bulk-confirm with a single click. **Phase 2 (Rule Registry)** persists those patterns as named rules. Every future CSV import automatically runs the rule engine, silently linking high-confidence pairs and flagging low-confidence ones for a brief spot-check — reducing recurring transfer reconciliation from O(N) manual clicks to near-zero for established patterns.

---

## Architecture Decisions

### AD-1: Smart Match runs in-process (no queue) for Phase 1

The `suggestSimilarPairs` call happens client-triggered, synchronously via tRPC query after the manual link succeeds. No background job needed — the dataset is already in-memory for scoring. Rationale: avoids introducing a job queue for Phase 1; the UI already shows a loading state in the `SmartMatchDialog`.

### AD-2: Rule job runs synchronously at end of import for Phase 2

After `ImportSession` status transitions to `COMPLETED`, the confirm action calls `runTransferMatchRules()` synchronously before returning the response. Rationale: the app runs on Render.com with no pg-boss/Bull queue. Typical import size is <500 transactions; the rule scan completes in <2 seconds. A future upgrade to an async job queue is noted as out-of-scope.

### AD-3: Rules are derived from confirmed pairs, not hand-authored

A rule is always bootstrapped from a real confirmed match (Phase 1b Smart Match confirmation). Manual rule creation in the UI (Phase 2c) allows *editing* name, gap tolerance, and active state — not authoring from scratch. This prevents garbage rules and keeps the registry grounded in real behaviour.

### AD-4: Confidence threshold is per-rule, defaulting to 85

The existing `scoreCandidate` function scores 0–100. A score ≥ `rule.confidenceThreshold` triggers auto-link; scores 40–84 are flagged for user review; scores < 40 are silently skipped. The threshold is configurable per rule (editble in the management UI) to let users tune strictness for their specific transfer patterns.

### AD-5: `batchLink` calls `linkTransferPair` in a loop, not a single DB transaction

Each pair link involves expense rollup reversal and IncomeRecord cleanup. Wrapping N pairs in one Prisma `$transaction` risks long-held locks and all-or-nothing failure. A loop with per-pair error capture means 3/4 pairs succeed even if one fails. Errors are collected and returned in the API response.

### AD-6: Rule engine checks `transferLinkedTransactionId` before each link

Because rules run in sequence and a transaction can only be in one pair, the job re-checks that both candidate transactions are still unlinked immediately before calling `linkTransferPair`. This prevents double-match when multiple rules qualify the same pair.

### AD-7: Keywords extracted at rule creation time, not query time

When a rule is created, `debitKeywords` and `creditKeywords` are extracted from the source pair's descriptions (lowercased, split on `\W+`, stop-words filtered). These are stored as a `String[]` on the rule. At job time, keyword matching is an in-memory set intersection — no regex stored in the DB.

### AD-8: Unlink button is Phase 1a prerequisite

The "Link" button exists in `TransactionRow` but there is no unlink UI for transfer-linked rows. Phase 1a adds an `Unlink` icon button (chain-break icon) that calls `transfer.unlink`. Without this, users cannot undo erroneous auto-links from Phase 2b.

---

## Data Model Changes

### New models (see `context.md` for full verbatim definitions)

| Model | Purpose |
|---|---|
| `TransferMatchRule` | Persisted matching pattern: amount, keywords, day gap, bank accounts, threshold |
| `TransferMatchJobResult` | Per-import job summary: how many pairs were auto-linked, flagged, or skipped |

### Additions to existing models

| Model | Field | Purpose |
|---|---|---|
| `User` | `transferMatchRules TransferMatchRule[]` | Relation |
| `ImportSession` | `matchJobResults TransferMatchJobResult[]` | Relation |

### No changes to `Transaction`

All transfer link state is already on `Transaction` (`transferLinkedTransactionId`, `preLinkCategory`, `preLinkStatus`).

---

## Component & Service Changes

### Phase 1a — Unlink Transfer button

| Layer | Change |
|---|---|
| `TransactionRow.tsx` | Detect `transaction.transferLinkedTransactionId !== null`; render chain-break icon button |
| `transfer.ts` (router) | `unlink` procedure already exists — no change |

### Phase 1b — Smart Match dialog

| Layer | Change |
|---|---|
| `transfer.ts` (router) | Add `suggestSimilarPairs` query + `batchLink` mutation |
| `transfer.service.ts` | Add `extractPatternFromPair()`, `findSimilarUnmatchedPairs()` |
| `TransferLinkDrawer.tsx` | After `onLinked()`, call `suggestSimilarPairs`; if results > 0, open `SmartMatchDialog` |
| `SmartMatchDialog.tsx` | New — displays pair list with checkboxes, confirm/skip actions |

### Phase 2a — Rule creation

| Layer | Change |
|---|---|
| `transfer-rule.service.ts` | `createRuleFromPair()`, `listRules()`, `toggleRule()`, `deleteRule()` |
| `transferRuleRouter` | New tRPC router; registered in root |
| `SmartMatchDialog.tsx` | After batch confirm, show "Save as rule?" inline prompt |

### Phase 2b — Auto-match on import

| Layer | Change |
|---|---|
| `transfer-rule-job.service.ts` | `runTransferMatchRules()` — load rules, score, link, write `TransferMatchJobResult` |
| CSV confirm step | Call `runTransferMatchRules()` after `ImportSession` COMPLETED |
| `PostImportMatchBanner.tsx` | New — shows "X auto-linked · Y to review" with action link |

### Phase 2c — Rule management UI

| Layer | Change |
|---|---|
| `settings/transfer-rules/page.tsx` | Server Component shell; passes rules data to Client Component |
| `TransferRulesTable.tsx` | Active toggle, edit name/gap, delete with confirmation |
| `RuleMatchHistoryDrawer.tsx` | Shows transactions auto-linked by a specific rule |
| Settings nav | Add "Transfer Rules" entry |

---

## Success Criteria

| # | Criterion | How verified |
|---|---|---|
| 1 | Transfer-linked rows show an Unlink button; clicking it restores both transactions to pre-link state | Manual test + unit test for `unlinkTransferPair` restore logic |
| 2 | After manually linking a $2,000 pair, `suggestSimilarPairs` returns all other unmatched $2,000 Transfer pairs within 5 days | Unit test with seeded data |
| 3 | `batchLink` with 3 pairs creates 3 linked pairs; a 4th pair that fails (already linked) returns an error entry without rolling back the 3 successes | Unit test |
| 4 | A rule created from the confirmed pair has correct keywords, `amountExact`, `maxDayGap`, and bank account IDs | Unit test for `createRuleFromPair` |
| 5 | After CSV upload, `runTransferMatchRules` auto-links pairs scoring ≥ 85 and flags pairs scoring 40–84 in `TransferMatchJobResult` | Integration test with seeded rules and transactions |
| 6 | `PostImportMatchBanner` shows "X auto-linked · Y to review" after import completes | E2e / Playwright smoke test |
| 7 | Rule management page shows all rules with correct match counts; toggle disables rule from future jobs | Manual test |

---

## Out of Scope / Future Phases

| Item | Reason deferred |
|---|---|
| Async background job queue (pg-boss / Bull) | No job queue infrastructure in current stack; synchronous job sufficient for MVP import sizes |
| AI-assisted rule name suggestion (GPT clustering of description patterns) | Adds AI cost; manual naming is sufficient for Phase 2 |
| Cross-user rule templates ("community rules") | Privacy/multi-tenancy complexity |
| Rule versioning / audit log | Overkill for personal finance app |
| Amount range rules (matching $280–$320 as a range) | Current exact-match covers 95% of use cases; range is Phase 3 |
| Rule priority / conflict resolution UI | Only needed if users have many overlapping rules; low probability initially |
| Webhook/push notification when auto-match completes | Requires WebSocket or SSE infrastructure not yet present |
