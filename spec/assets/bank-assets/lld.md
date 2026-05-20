# Bank Assets — Low Level Design

## Implementation Status

Most of this feature is implemented (Phases 1–5 complete). Phase 6 (account name management) is partially complete — service and server action exist; tRPC + UI not yet wired.

### Completed
- ✅ Phase 1: Database models (`BankAccount`, `BankBalanceSnapshot`, `BankBalanceRecord`) + all tRPC endpoints
- ✅ Phase 2: Basic UI — calendar selectors, snapshot display, accordion, grand total
- ✅ Phase 3: Snapshot creation — modal, pre-fill, CreatableSelect, validation, persistence
- ✅ Phase 4: Edit & delete — edit balance, delete entry, delete snapshot, confirmations
- ✅ Phase 5: Polish — query invalidation, loading states, error handling

### Outstanding (Phase 6)
- 🔲 `bankAssetRouter.updateAccount()` tRPC procedure
- 🔲 Edit icon + inline editor component for account name in `AccountRow`
- 🔲 Form handling + duplicate name error boundary
- 🔲 Query invalidation after account rename

---

## Database Schema

```prisma
model BankBalanceSnapshot {
  id             String               @id @default(cuid())
  snapshotDate   DateTime
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@index([userId, snapshotDate])
}

model BankBalanceRecord {
  id           String              @id @default(cuid())
  balance      Decimal             @db.Money
  accountId    String
  account      BankAccount         @relation(fields: [accountId], references: [id])
  snapshotId   String
  snapshot     BankBalanceSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  importImageId String?
  importImage  ImportImage?        @relation(fields: [importImageId], references: [id])
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt

  @@unique([accountId, snapshotId])
  @@index([snapshotId])
}

model BankAccount {
  id           String               @id @default(cuid())
  name         String
  bankId       String
  bank         Business             @relation(fields: [bankId], references: [id])
  userId       String
  user         User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  transactions Transaction[]
  debitTransferRules  TransferMatchRule[] @relation("debitRules")
  creditTransferRules TransferMatchRule[] @relation("creditRules")
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@unique([name, bankId, userId])
  @@index([userId, bankId])
}
```

---

## API Surface (tRPC)

### Queries

| Procedure | Input | Returns |
|---|---|---|
| `getSnapshots` | `{ calendarYearId?, calendarType? }` | `BankBalanceSnapshot[]` with records + account info |
| `getSnapshotById` | `{ snapshotId }` | `BankBalanceSnapshot` with records |

### Mutations

| Procedure | Input | Returns |
|---|---|---|
| `createSnapshot` | `{ snapshotDate, entries: [{ accountId, balance }] }` | Created snapshot with records |
| `updateEntry` | `{ entryId, balance }` | Updated `BankBalanceRecord` |
| `deleteEntry` | `{ entryId }` | `{ success: true }` |
| `deleteSnapshot` | `{ snapshotId }` | `{ success: true }` |

---

## Snapshot Creation Service

**`createBankAssetSnapshot(userId, snapshotDate, entries)`:**

```typescript
export async function createBankAssetSnapshot(
  userId: string,
  snapshotDate: Date,
  entries: Array<{ accountId: string; balance: number }>,
): Promise<BankBalanceSnapshot> {
  return prisma.$transaction(async (db) => {
    // 1. Verify all accounts belong to user
    const accounts = await db.bankAccount.findMany({
      where: { id: { in: entries.map((e) => e.accountId) }, userId },
    });
    if (accounts.length !== entries.length) {
      throw new Error('One or more accounts not found or not owned by user');
    }

    // 2. Create snapshot
    const snapshot = await db.bankBalanceSnapshot.create({ data: { snapshotDate, userId } });

    // 3. Create balance records
    await db.bankBalanceRecord.createMany({
      data: entries.map((e) => ({
        balance:    e.balance,
        accountId:  e.accountId,
        snapshotId: snapshot.id,
      })),
    });

    return db.bankBalanceSnapshot.findUniqueOrThrow({
      where:   { id: snapshot.id },
      include: { balanceRecords: { include: { account: { include: { bank: true } } } } },
    });
  });
}
```

---

## Calendar Filter Flow

1. User selects FISCAL / ANNUAL / ZAKAT + year
2. URL updates: `?type=FISCAL&yearId=xyz`
3. tRPC: `getSnapshots({ calendarYearId, ... })`
4. Service filters: `fromDate ≤ snapshotDate ≤ toDate`
5. Most recent snapshot displayed by default; grand total from snapshots in range

---

## Pre-fill Behavior

When "New Snapshot" modal opens:
- Fetch `getMostRecentSnapshot()` (or most recent within selected calendar year)
- Pre-populate: all banks + accounts from that snapshot, previous balances as starting values
- Snapshot date defaults to today (not previous snapshot date)

---

## Phase 6 — Account Name Management (Outstanding)

**Service (exists):** `updateBankAccount(userId, accountId, newName)` — validates ownership, checks uniqueness constraint `[name, bankId, userId]`, updates `BankAccount.name`.

**Server action (exists):** `updateAccountName({ accountId, name })`.

**Still needed:**
1. `bankAssetRouter.updateAccount()` tRPC procedure calling the service
2. `AccountRow` — pencil icon activating inline editor
3. Form: name input + save/cancel; duplicate name error message
4. Query invalidation: `trpc.useUtils().bankAsset.getSnapshots.invalidate()` after success

---

## Known Issues (Fixed)

| Issue | Root Cause | Fix |
|---|---|---|
| Loading state never clears | Checked array length instead of tRPC loading status | Use `isLoadingSnapshots` from query state |
| Wrong empty state | Checked snapshots instead of actual banks | Query banks from `business.getBusinessesByType` |
| React Hook invalid call | async callback in `onCreateOption` | Changed to `.then()/.catch()` |
| Snapshot data not persisting | `window.location.reload()` before query invalidation | Use `trpc.useUtils().bankAsset.getSnapshots.invalidate()` |

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/bank-asset.service.ts` | MODIFY | All CRUD operations + `updateBankAccount` |
| `src/server/api/routers/bank-asset.ts` | MODIFY | Queries + mutations + Phase 6 `updateAccount` |
| `src/server/api/root.ts` | MODIFY | Register `bankAsset` router |
| `src/app/(authorized)/assets/bank/page.tsx` | MODIFY | Server Component: session + calendarYears |
| `src/app/(authorized)/assets/bank/BankAssetsClient.tsx` | MODIFY | Client Component: all interactive state |
| `src/app/(authorized)/assets/bank/_components/NewSnapshotModal.tsx` | MODIFY | Pre-fill from most recent + CreatableSelect |
| `src/app/(authorized)/assets/bank/_components/BankAccordion.tsx` | MODIFY | Accordion with totals |
| `src/app/(authorized)/assets/bank/_components/AccountRow.tsx` | MODIFY | Balance display + edit/delete actions + Phase 6 inline name editor |
