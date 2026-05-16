# Undo Safeguards — High Level Design

**Version:** 1.0
**Status:** Specced
**Related specs:** `spec/clear-transactions/`, `spec/transfer-reconciliation/`

---

## Problem + Proposed Solution

The void/undo system was built in phases. Phase 1 (clear-transactions) correctly handles expense
summaries, income records, and donation payment unlinking. Two gaps remain: **(1)** transfer-linked
counterparts are left as zombie EXCLUDED transactions when their paired partner is voided, and
**(2)** there is no guard preventing a user from undoing imports that belong to a fiscal year
they have already used for tax filing. This spec closes both gaps: Phase 1 fixes the transfer FK
integrity issue; Phase 2 adds fiscal-year awareness (warnings for previous-year undos); Phase 3
adds explicit fiscal-year locking (hard block after the user declares a year closed).

---

## PO Analysis

### Feature 1 — Transfer Link Cleanup on Void

| Dimension | Assessment |
|---|---|
| **Frequency** | Low — requires: import A, import B, link as transfer, undo A |
| **Pain when it occurs** | High — the counterpart transaction is permanently stuck in EXCLUDED/Transfer with no unlink path. It shows in "unmatched transfers" forever. |
| **Discoverability** | Invisible to the user — no error is thrown; the data is just silently wrong |
| **Fix complexity** | Medium — reuses existing `unlinkTransferPair` logic, needs extraction |
| **Verdict** | ✅ Ship it. Data integrity bugs erode trust even when rare. |

### Feature 2 — Undo Cutoff

| Dimension | Assessment |
|---|---|
| **Who cares** | Any user who files taxes using this app's expense/income reports |
| **Risk without it** | User undoes a March 2024 import in August 2026 after lodging their 2023-24 tax return → removes expense summaries that were declared to the ATO |
| **Frequency** | Low probability, catastrophic consequence |
| **Cut-off mechanism options** | See Architecture Decision #4 |
| **Verdict** | ✅ Ship it. Personal finance apps that skip this get users into trouble with tax authorities. |

### Should Pending Sessions Show in Import History?

Pending sessions (wizard abandoned mid-flow, 0 transactions) are noise for most users but
legitimate audit evidence. **Decision**: keep them visible (useful to confirm no phantom data
was created), but offer a Delete action. Already implemented in the current session.

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Transfer cleanup extraction** | Extract inner body of `unlinkTransferPair()` into `unlinkTransferPairInTx(db, debit, credit)` that accepts a tx-scoped Prisma client | `unlinkTransferPair()` wraps its own `$transaction`; nesting inside `undoImportSession`'s transaction would cause a savepoint / potential deadlock. Extraction keeps both callers correct. |
| 2 | **Within-batch transfer pairs** | Detect via `sessionTxIds: Set<string>`; skip counterpart restore if both sides are in the same batch | If both DEBIT and CREDIT are being voided together, restoring the counterpart's category/status is pointless and produces confusing intermediate state. |
| 3 | **Cutoff mechanism — fiscal year, not time-based** | Use `CalendarYear` as the boundary, not a rolling N-day window | Time-based cutoffs are arbitrary. Tax filings are year-based. A 90-day window would block legitimate same-year corrections; it would not block dangerous cross-year ones that happen to be recent. |
| 4 | **Three-tier cutoff model** | (a) Previous unlocked year → warn, allow; (b) Locked year → hard block; (c) Current year → allow | Gives power users full control via locking. Protects accidental cross-year undos with friction. Never silently blocks without explanation. |
| 5 | **Fiscal year lock is user-initiated** | User clicks "Lock year" in Calendar Settings; `lockedAt` is set | Automatic locking (e.g. after April 15) is presumptuous — users file at different times. Manual lock is opt-in and reversible only via an explicit unlock with a strong warning. |
| 6 | **`yearWarning` returned by `listImportSessions`** | API enriches each session row with `yearWarning: boolean` and `isLocked: boolean` | Client renders appropriate badges without needing to know fiscal year logic itself. Single source of truth stays in the server. |
| 7 | **Unlock is always possible** | Admin/user can unlock a year (no hard irrevocability) | Hard irrevocability is a product decision for a future compliance mode. For a personal finance app, locking without unlock is too aggressive — users make mistakes. Show a strong "are you sure?" on unlock instead. |

---

## Data Model Changes

### 1. `CalendarYear` — add `lockedAt`

```prisma
model CalendarYear {
  // ... all existing fields unchanged ...

  lockedAt  DateTime?   // non-null = user has explicitly locked this fiscal year
}
```

Migration: non-breaking `ALTER TABLE ADD COLUMN "lockedAt" TIMESTAMP`. All existing rows get
`NULL` (unlocked).

### 2. No changes to `Transaction` or `ImportSession`

The transfer FK cleanup is pure logic — no new columns needed. The void status machinery already
exists (`VOIDED` enum value, `confirmedAt: null`).

---

## Component and Service Changes

### Phase 1 — Transfer Link Cleanup

| Component | Change |
|---|---|
| `void-transfer.service.ts` (new) | `clearTransferLink(db, tx, sessionTxIds)` — detects DEBIT/CREDIT role, restores counterpart if outside batch, re-adds expense rollup if needed |
| `void.service.ts` | Import and call `clearTransferLink()` at top of `reverseDownstream()`, before the `status !== CONFIRMED` gate |
| `transfer.service.ts` | Extract `unlinkTransferPairInTx(db, debit, credit, userId)` for use inside existing `$transaction` blocks |

### Phase 2 — Year Warning

| Component | Change |
|---|---|
| `transaction-clearing.ts` | `listImportSessions`: join session transactions → derive fiscal year → set `yearWarning`, `isLocked` per row |
| `transaction-clearing.ts` | `undoImportSession`: pre-flight check → reject if `isLocked`; include `yearWarning` in response |
| `ImportSessionHistory.tsx` | Show `⚠️ Previous year` badge on rows with `yearWarning`; show extra warning copy in undo confirm for those rows; disable Undo button with "Locked" label for `isLocked` rows |

### Phase 3 — Fiscal Year Locking

| Component | Change |
|---|---|
| `prisma/schema.prisma` | Add `lockedAt DateTime?` to `CalendarYear` |
| `calendar-year` tRPC router | Add `lock({ calendarYearId })` and `unlock({ calendarYearId })` mutations |
| `src/app/(authorized)/settings/calendar/` | Add lock toggle with warning copy to each fiscal year row |

---

## Success Criteria

| # | Criterion | Phase |
|---|---|---|
| 1 | Undoing a session whose transactions were transfer-linked to counterparts in other sessions restores those counterparts to their `preLinkCategory`/`preLinkStatus` | 1 |
| 2 | If both sides of a transfer pair are in the same session, both are voided cleanly without counterpart restore errors | 1 |
| 3 | `undoImportSession` response includes `yearWarning: true` when session spans a previous (unlocked) fiscal year | 2 |
| 4 | `listImportSessions` returns `yearWarning: boolean` and `isLocked: boolean` per row | 2 |
| 5 | Import History shows ⚠️ badge and stronger confirm copy for previous-year sessions | 2 |
| 6 | `undoImportSession` throws `FORBIDDEN` when session spans a locked fiscal year | 3 |
| 7 | `calendarYear.lock` sets `lockedAt`; `calendarYear.unlock` clears it | 3 |
| 8 | Lock toggle is visible in Calendar Settings UI | 3 |
| 9 | `pnpm run build` passes after each phase | All |

---

## Out of Scope / Future Phases

| Item | Reason |
|---|---|
| Automatic fiscal year locking (e.g. post-tax-deadline) | Tax deadlines vary by user/region; opt-in locking is safer |
| Partial session undo (undo some rows, keep others) | Out of scope per `clear-transactions` HLD; individual void already covers this |
| Audit log of void operations | Useful for compliance mode; deferred |
| Re-import after undo | User manually re-imports corrected file; no automation in scope |
| Reimbursement link cleanup during void | Reimbursement links (`offsetTransactionId`) are read-only once set; voiding the linked tx already marks it VOIDED; no FK restoration needed |
| Hard irrevocability (no unlock ever) | Compliance mode feature; personal finance doesn't need it yet |
