# Transaction Enrichment — Context

## Problem
Independent silos for Ledger, Donations, and Zakat prevent seamless attribution. Confirmed "Gifts & donations" transactions lack links to charitable records, and Zakat years require day-level precision.

## Architecture
- **Models**: `ZakatPayment` linked to `Transaction` or `DonationPayment`.
- **Service Layer**: `calendar-boundary.service.ts`, `zakat-link.service.ts`.
- **Ledger Integration**: `transaction-ledger` tRPC router exposes `isZakatLinked` badge.

## Scope
- Link DEBIT bank transactions to Zakat/Donations.
- `CalendarYear` day-level precision for Zakat.
- Ledger badges (`isZakatLinked`) for visibility.
