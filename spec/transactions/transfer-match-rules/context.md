# Transfer Match Rules — Context

## Problem

Users with regular inter-account transfers (weekly top-ups, monthly salary routing, recurring paybacks) must manually link every DEBIT/CREDIT pair after each CSV upload. The `TransferLinkDrawer` handles one pair at a time with no memory of past patterns. For users uploading 12 months at once, this is dozens of manual operations.

## Domain Dependencies

- Uses: `Transaction`, `TransferMatchRule` models from domain HLD
- Patterns: Reuses `linkTransferPair()` from `transfer.service.ts`; `scoreCandidate` function from transfer-reconciliation; rule engine runs synchronously at end of import (no job queue)
- Related features: transfer-reconciliation (must be implemented first — provides `linkTransferPair`, `unlinkTransferPair`), transaction-ledger (Unlink button in Phase 1a)

## Scope

**In scope:**
- Phase 1a: Unlink Transfer button in `TransactionRow` (prerequisite — no unlink UI existed)
- Phase 1b: Smart Match dialog — after manual link, surfaces similar unmatched pairs for bulk-confirm
- Phase 2a: Rule creation from confirmed pairs (`createRuleFromPair`)
- Phase 2b: Auto-match on import — `runTransferMatchRules()` synchronous job after `ImportSession` COMPLETED
- Phase 2c: Rule management UI at `settings/transfer-rules/`

**Out of scope:**
- Async background job queue (pg-boss/Bull) — synchronous is sufficient for MVP import sizes
- AI-assisted rule name suggestion
- Cross-user rule templates
- Amount range rules (exact-match covers 95% of use cases)
- Rule priority / conflict resolution UI

## Known Constraints

- Rules are derived from confirmed pairs, not hand-authored (prevents garbage rules)
- `batchLink` calls `linkTransferPair` in a loop (not single DB transaction) — per-pair error capture means N-1 successes even if one fails
- Rule engine re-checks `transferLinkedTransactionId` before each link (prevents double-match)
- Keywords extracted at rule creation time (lowercased, split on `\W+`, stop-words filtered)

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `TransferMatchRule` and `TransferMatchJobResult` models |
| `src/server/services/transactions/transfer-rule.service.ts` | CREATE | `createRuleFromPair`, `listRules`, `toggleRule`, `deleteRule` |
| `src/server/services/transactions/transfer-rule-job.service.ts` | CREATE | `runTransferMatchRules()` — load rules, score, link, write job result |
| `src/server/api/routers/transfer-rule.ts` | CREATE | tRPC router for rule CRUD |
| `src/components/transactions/SmartMatchDialog.tsx` | CREATE | Pair list with checkboxes, confirm/skip; "Save as rule?" prompt |
| `src/components/transactions/TransferLinkDrawer.tsx` | MODIFY | After `onLinked()`, call `suggestSimilarPairs`; open SmartMatchDialog |
| `src/app/(authorized)/settings/transfer-rules/page.tsx` | CREATE | Server Component shell |
| `src/components/settings/TransferRulesTable.tsx` | CREATE | Active toggle, edit, delete |
