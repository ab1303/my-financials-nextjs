# Transaction Enrichment Pipeline — Context

## Problem

The Transaction Ledger, Donations page, and Zakat page evolved as independent silos. A confirmed "Gifts & donations" bank transaction has no data bridge to `ZakatPayment`, and `CalendarYear` lacks day-level precision for lunar-derived Zakat years. Users must manually re-enter date and amount on each page, with no audit trail back to the bank statement and a real risk of amount drift.

## Domain Dependencies

- Uses: `Transaction` model from domain HLD as source of truth for cash events
- Patterns: nullable FK with `onDelete: SetNull` (mirrors `DonationPayment.transactionId`), `@unique` per enrichment model to prevent same-purpose duplication
- Related features: transaction-ledger (shows attribution badges `isDonationLinked`, `isZakatLinked`), donations feature, zakat feature, settings/calendar (exposes `fromDay`/`toDay` inputs for ZAKAT years)

## Scope

**In scope:**
- Add `transactionId` FK to `ZakatPayment` (direct bank transaction → Zakat path)
- Add `donationPaymentId` FK to `ZakatPayment` (donation → Zakat path for cash/in-kind donations)
- Add `fromDay`/`toDay` nullable columns to `CalendarYear` for ZAKAT year precision
- `UnlinkedZakatBanner` + `LinkZakatDrawer` on the Zakat page
- `isZakatLinked` badge in Transaction Ledger rows
- Mutual exclusion: `transactionId` XOR `donationPaymentId` on `ZakatPayment` (enforced at app layer)
- FISCAL year: hard date validation; ZAKAT year: soft warning

**Out of scope:**
- Zakat obligation calculator from `BankBalanceSnapshot` + `PortfolioSnapshot`
- Partial amount attribution UI
- Unified charitable giving report
- In-kind / non-cash Zakat payment tracking UI changes

## Known Constraints

- A transaction with `date = 2024-11-15` simultaneously falls in FY2025 (FISCAL) and Zakat Year 1446H (ZAKAT); `calendarYearId` must NOT be added to `Transaction` — attribution is computed via enrichment records
- Manual cash Zakat payments (no `transactionId`) remain first-class; `transactionId` is optional enrichment
- `ZakatPayment` with both `transactionId` and `donationPaymentId` is rejected at app layer

## Files

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Add `transactionId`, `donationPaymentId` to `ZakatPayment`; `fromDay`/`toDay` to `CalendarYear`; back-references |
| `src/server/services/calendar-boundary.service.ts` | CREATE | `getCalendarDateRange()`, `validateTransactionDate()` |
| `src/server/services/donation-zakat-link.service.ts` | CREATE | `getUnlinkedDonationPaymentsForZakat()`, `countUnlinkedDonationPaymentsForZakat()` |
| `src/server/services/zakat-link.service.ts` | CREATE | `getUnlinkedZakatTransactions()`, `countUnlinkedZakatTransactions()` |
| `src/server/api/routers/transaction-ledger.ts` | MODIFY | `getAll` includes `zakatPayment` select; `isZakatLinked` badge |
| `src/app/(authorized)/zakat/page.tsx` | MODIFY | Inject `<UnlinkedZakatBanner>` |
| `src/app/(authorized)/zakat/actions.ts` | MODIFY | Accept `transactionId?` and `donationPaymentId?`; mutual exclusion validation |
