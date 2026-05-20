# Bank Assets — Context

## Problem

Users need to track cash holdings across multiple bank accounts over time. Without snapshot history, they cannot answer "is my cash position growing?" or compute total cash-at-bank for Zakat, tax, or financial planning purposes. The app needs a manual snapshot tool that organises balances by bank and account, supports multiple calendar year lenses, and retains all historical records for trend analysis.

## Domain Dependencies

- Uses: `BankBalanceSnapshot`, `BankBalanceRecord` models from domain HLD; `BankAccount` (account within a bank) and `Business` (type=BANK) models
- Patterns: Server Component page → Client Component for all interactive state; `CreatableSelect` for dynamic account creation; `CalendarYear` lens for fiscal/annual/Zakat filtering; `prisma.$transaction` for snapshot creation
- Related features: net-worth-dashboard (reads `BankBalanceSnapshot` as anchor points for trend aggregation), bank-account-management (editing account names)

## Scope

**In scope:**
- Snapshot creation: date, banks, accounts, balances (modal with pre-fill from most recent snapshot)
- Multi-account display: accordion per bank with summary totals, individual account balances when expanded
- Calendar year lens: filter snapshots by FISCAL / ANNUAL / ZAKAT + year picker
- Edit account balance (update `BankBalanceRecord`)
- Delete account entry from snapshot (delete `BankBalanceRecord`)
- Delete entire snapshot (cascade to all balance records)
- Account name editing (Phase 6 — service + server action exist; tRPC + UI not yet wired)

**Out of scope:**
- Real-time bank API sync or automatic balance updates
- Investment tracking (stocks, bonds, property) — cash only
- Multi-currency support (AUD only)
- Interest calculations or projections
- Loan or liability tracking

## Known Constraints

- Account names must be unique within the same bank per user: `@@unique([name, bankId, userId])`
- Account name changes propagate to all snapshots (shared `BankAccount` record)
- Pre-fill: when opening "New Snapshot" modal, form pre-populates with all banks/accounts from the most recent snapshot (previous balances as starting point); snapshot date defaults to today
- Phase 6 account management: `updateBankAccount()` service + `updateAccountName()` server action exist but tRPC procedure and UI edit component are not yet wired

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/bank-asset.service.ts` | MODIFY | `createBankAssetSnapshot`, `getSnapshots`, `getSnapshotById`, `updateEntry`, `deleteEntry`, `deleteSnapshot`, `updateBankAccount` |
| `src/server/api/routers/bank-asset.ts` | MODIFY | tRPC router: create/read/update/delete procedures |
| `src/server/api/root.ts` | MODIFY | Register `bankAsset` router |
| `src/app/(authorized)/assets/bank/page.tsx` | MODIFY | Server Component: session + calendarYears → passes to client |
| `src/app/(authorized)/assets/bank/BankAssetsClient.tsx` | MODIFY | Client Component: calendar selection, snapshot display, modals |
| `src/app/(authorized)/assets/bank/_components/NewSnapshotModal.tsx` | MODIFY | Pre-fill, CreatableSelect, form handling |
| `src/app/(authorized)/assets/bank/_components/BankAccordion.tsx` | MODIFY | Accordion with account rows + totals |
| `src/app/(authorized)/assets/bank/_components/AccountRow.tsx` | MODIFY | Balance display with edit/delete actions |
