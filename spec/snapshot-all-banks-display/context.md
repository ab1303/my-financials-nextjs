# Snapshot All Banks Display — Context

## Problem Summary

The Bank Assets Cash Tracking page currently only renders accordion sections for banks that already have entries in the selected snapshot (`totals.banks`). If a user has ANZ configured but no ANZ accounts in the snapshot, ANZ is invisible — they have no way to discover they can add it. The fix is to render **all configured banks** (Business type=BANK for the user) in the accordion, with banks missing from the snapshot showing an empty state + "Add Account" CTA.

This is a **pure frontend change** — no schema or tRPC changes required. The necessary data (all banks, all bank accounts, existing snapshot entries) is already fetched.

---

## File Inventory

| Status | File | Change |
|---|---|---|
| MODIFY | `src/app/(authorized)/assets/bank/BankAssetsClient.tsx` | Replace `totals.banks` iteration with full `banks` list; add empty-state row for banks not in snapshot |
| READ | `src/types/bank-asset.types.ts` | Reference only — `BankTotalSummary`, `SnapshotTotals`, `AccountBalance` |
| READ | `src/server/trpc/router/bank-asset.ts` | Reference only — `addEntryToSnapshot`, `getBankAccounts` |

---

## Prisma Schema (relevant models)

```prisma
model Business {
  id               String               @id @default(cuid())
  name             String
  type             BusinessEnumType?
  bankAccounts     BankAccount[]
  userId           String
  user             User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model BankAccount {
  id             String               @id @default(cuid())
  name           String
  bankId         String
  bank           Business             @relation(fields: [bankId], references: [id])
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]

  @@unique([name, bankId, userId])
  @@index([userId, bankId])
}

model BankBalanceSnapshot {
  id             String               @id @default(cuid())
  snapshotDate   DateTime
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
}

model BankBalanceRecord {
  id           String              @id @default(cuid())
  balance      Decimal             @db.Money
  accountId    String
  account      BankAccount         @relation(fields: [accountId], references: [id])
  snapshotId   String
  snapshot     BankBalanceSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  importImageId String?

  @@unique([accountId, snapshotId])
  @@index([snapshotId])
}
```

---

## Existing Data Already Fetched in BankAssetsClient

| Variable | Source | Contains |
|---|---|---|
| `banks` | `trpc.business.getBusinessesByType({ type: 'BANK' })` | All user's configured banks (Business records) |
| `allBankAccounts` | `trpc.bankAsset.getBankAccounts({})` | All user's BankAccount records with bank relation |
| `snapshot` | Derived from `allSnapshots` | Current snapshot with `balanceRecords[]` |
| `totals` | `trpc.bankAsset.getSnapshotTotals({ snapshotId })` | `{ grandTotal, banks: BankTotalSummary[] }` — only banks WITH entries |
| `accountsAlreadyInSnapshot` | `useMemo` over `snapshot.balanceRecords` | Set of accountIds already in snapshot |
| `getAddableAccountsForBank(bankId)` | Derived | Accounts for a bank not yet in snapshot |

---

## Current vs Proposed Data Flow

### Current
```
totals.banks (only banks with entries)
  └─ map → Disclosure accordion per bank
```

### Proposed
```
banks (ALL configured banks for user)
  └─ for each bank:
       if bank.id in totals.banks → render normal accordion with accounts
       else → render empty-state accordion ("No accounts in this snapshot" + Add Account CTA)
```

---

## Key Constraints & Gotchas

- `totals` may be undefined (no snapshot selected) — guard with `!!snapshot`
- When no snapshot exists yet, empty-state banks should still be shown with "Create a snapshot first" or disabled CTA
- `allBankAccounts` is only fetched when `!!snapshot` — ensure it's available before rendering add-entry UI
- `addingEntryForBankId` state already handles the inline add form — no new state needed
- The `getAddableAccountsForBank(bankId)` helper already filters by bank and excludes accounts already in snapshot
- Banks with zero accounts configured (no BankAccount rows) should still show with a "No accounts configured" message and a link to Settings
