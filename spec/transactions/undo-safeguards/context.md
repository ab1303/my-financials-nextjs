# Undo Safeguards — Context

## Problem

The void/undo system built in transaction-clearing has two remaining gaps: (1) transfer-linked counterparts are left as zombie EXCLUDED transactions when their paired partner is voided — the counterpart is stuck with no unlink path and shows in "unmatched transfers" forever; and (2) there is no guard preventing a user from undoing imports that belong to a fiscal year they have already used for tax filing. This spec closes both gaps with a three-tier cutoff model and transfer FK integrity on void.

## Domain Dependencies

- Uses: `Transaction`, `ImportSession`, `CalendarYear` models from domain HLD
- Patterns: Extends `void.service.ts` from transaction-clearing; reuses `unlinkTransferPair` from transfer-reconciliation (extracted to `unlinkTransferPairInTx` for nesting safety)
- Related features: transaction-clearing (prerequisite — provides void infrastructure), transfer-reconciliation (prerequisite — provides transfer link state), settings/calendar (`lockedAt` field UI)

## Scope

**In scope:**
- Phase 1: Transfer link cleanup on void — `clearTransferLink()` service, called inside `reverseDownstream()` before status gate
- Phase 2: Undo cutoff — fiscal year warning/lock enrichment on `listImportSessions`; pre-flight check in `undoImportSession`
- Phase 3: Fiscal year locking UI — `CalendarYear.lockedAt` schema field; `calendarYear.lock`/`unlock` mutations; lock toggle in Calendar Settings

**Out of scope:**
- Automatic fiscal year locking (tax deadlines vary by user/region)
- Partial session undo
- Audit log of void operations
- Hard irrevocability (no unlock)

## Known Constraints

- `unlinkTransferPair()` wraps its own `$transaction`; nesting inside `undoImportSession`'s transaction would cause savepoint/deadlock. Must extract inner body as `unlinkTransferPairInTx(db, debit, credit)`.
- Within-batch transfer pairs: if both DEBIT and CREDIT are being voided together, skip counterpart restore (both go VOIDED cleanly)
- Cutoff mechanism uses `CalendarYear` not a rolling N-day window — tax filings are year-based
- Three-tier model: (a) previous unlocked year → warn, allow; (b) locked year → hard block; (c) current year → allow

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `lockedAt DateTime?` to `CalendarYear` |
| `src/server/services/transactions/void-transfer.service.ts` | CREATE | `clearTransferLink(db, tx, sessionTxIds)` |
| `src/server/services/transactions/void.service.ts` | MODIFY | Call `clearTransferLink()` in `reverseDownstream()` |
| `src/server/services/transactions/transfer.service.ts` | MODIFY | Extract `unlinkTransferPairInTx(db, debit, credit, userId)` |
| `src/server/api/routers/transaction-clearing.ts` | MODIFY | `listImportSessions` enriched with `yearWarning`/`isLocked`; `undoImportSession` pre-flight |
| `src/server/api/routers/calendar-year.ts` | MODIFY | Add `lock` and `unlock` mutations |
| `src/components/transactions/ImportSessionHistory.tsx` | MODIFY | `⚠️ Previous year` badge; "Locked" disabled state |
| `src/app/(authorized)/settings/calendar/` | MODIFY | Lock toggle with warning copy per fiscal year row |
