# Import Session Date Range — High Level Design

## Problem Statement

The Import History dialog shows import metadata (when performed, type, record count, status) but omits what time period the imported transactions actually cover. A user who imports a bank CSV has no feedback on whether it covered January–June or the entire fiscal year. This is a usability gap — users must mentally reconstruct coverage from memory or re-open the original file.

The fix is small: add two nullable `DateTime` columns (`startDate`, `endDate`) to `ImportSession`, populate them post-confirm using a Prisma aggregate, surface them via the existing `listImportSessions` tRPC procedure, and render a "Coverage" column in the history dialog.

---

## Architecture Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| AD1 | How to compute date range | `prisma.transaction.aggregate` after confirm | Uses actual `Transaction.date` values — precise, avoids loading all rows, works for both CSV and AI imports |
| AD2 | When to write date range | In the same `importSession.update` call that writes `status`/`recordsCreated` | Single DB round-trip; consistent with existing confirm finalization pattern |
| AD3 | Column nullability | Both `startDate` / `endDate` nullable | Legacy sessions and PENDING sessions (no transactions yet) remain valid rows; no migration needed |
| AD4 | Scope of change | CSV confirm + AI confirm | AI import also creates `Transaction` records with dates; consistency requires covering both |
| AD5 | Display format | "1 Jan – 30 Jun 2025" (or single date if same day) | en-AU locale, abbreviated month; compact enough for a table cell |
| AD6 | No separate "period" concept | Reuse `startDate`/`endDate` for all import types | Avoids over-engineering; Coverage column label adapts ("Coverage" for CSV, same for AI) |

---

## Data Model Changes

```prisma
// prisma/schema.prisma — ImportSession model additions
startDate  DateTime?   // earliest transaction date in this import (null = no transactions yet)
endDate    DateTime?   // latest transaction date in this import
```

No other schema changes. `Transaction` model unchanged.

---

## Component / Service Changes

| Layer | File | Change |
|---|---|---|
| **DB Schema** | `prisma/schema.prisma` | Add `startDate DateTime?`, `endDate DateTime?` |
| **API Route** | `src/app/api/transactions/csv/confirm/route.ts` | Aggregate `_min.date` / `_max.date`, write to `ImportSession.update` |
| **API Route** | `src/app/api/transactions/ai/confirm/route.ts` | Same aggregate + update (if it writes `Transaction` records) |
| **tRPC** | `src/server/trpc/router/transaction-clearing.ts` | Add `startDate` / `endDate` to `listImportSessions` mapped response |
| **UI** | `src/components/transactions/ImportSessionHistory.tsx` | Add `SessionRow.startDate` / `.endDate`, add "Coverage" `<th>`, render formatted range in `<td>` |

---

## Success Criteria

- [ ] After a CSV import, opening Import History shows the earliest and latest transaction date from that file
- [ ] Legacy/PENDING sessions show "—" in the Coverage column
- [ ] Single-day imports (all transactions on one date) show a single date, not a range
- [ ] AI imports also populate date range if they create Transaction records
- [ ] `pnpm run build` passes with no TypeScript errors

---

## Out of Scope

| Item | Reason |
|---|---|
| Backfilling date range for existing sessions | Low value; sessions pre-date this feature, data still present in `Transaction` table — a one-off migration script could backfill later if needed |
| Filtering history by date range | Future feature — would require new tRPC input params |
| Displaying date range in the import success toast/result step | Separate surface; not part of the history dialog |
| Editable date range | Import periods are derived from data, never manually entered |
