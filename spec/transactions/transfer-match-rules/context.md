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

## Future Scoping — Background Jobs

The MVP runs rule matching **synchronously** at the end of the import confirm step. This is acceptable for small uploads (~50–200 transactions) but will degrade UX at scale. Two operations are prime candidates for async/background execution:

### 1. Transfer Match Rule Engine (`runTransferMatchRules`)
- Currently: runs inline after `ImportSession` transitions to `COMPLETED`, blocking the HTTP response
- Future: enqueue a job after import completes; respond immediately with a "processing" state; push a notification/banner when done
- **Trigger for migration**: sustained uploads > 500 transactions, or p95 import response time > 3s

### 2. LLM Categorisation (post-import AI categorise)
- Currently: called synchronously after CSV parse, applying LLM category suggestions before the user reviews
- This is the **most expensive** operation — an LLM call per uncategorised transaction can take 5–20s for a typical upload
- Future: move to a background job; show a "Categorising with AI…" skeleton in the review screen that resolves when the job completes
- User can proceed to review manually while the AI job runs; AI suggestions overlay once ready
- **Trigger for migration**: any upload > ~30 uncategorised transactions noticeably delays the review screen

### Candidate Infrastructure
| Option | Fits when |
|---|---|
| **pg-boss** (Postgres-backed queue) | Already on Postgres; no new infra; good for Render.com |
| **Inngest** | Serverless-friendly; good for Vercel/edge deployments |
| **AWS Lambda + SQS** | If workload justifies dedicated compute separation |
| **Vercel Cron / Background Functions** | Lightweight; suits the current Vercel deployment model |

> **Decision deferred to a separate ADR.** Until that threshold is reached, synchronous execution is intentional and simpler to reason about.

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
