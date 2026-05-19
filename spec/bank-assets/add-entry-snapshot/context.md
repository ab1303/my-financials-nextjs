# Add Entry to Existing Snapshot — Context

**Feature:** `add-entry-snapshot`
**User Story:** US-10.14
**Status:** Specced — ready for implementation

---

## Problem Summary

Once a `BankBalanceSnapshot` is saved there is no way to add a missing bank account entry to it. Users who forget an account (e.g. a new savings account) must create an entirely new snapshot containing every account, which pollutes the snapshot history and makes historical totals unreliable. A targeted "Add Account" capability per bank accordion is the minimal surgical fix.

---

## File Inventory

### Files to MODIFY

| File | Change |
|------|--------|
| `src/server/schema/bank-asset.schema.ts` | Add `addEntryToSnapshotSchema` and `AddEntryToSnapshotInput` export |
| `src/server/services/bank-asset.service.ts` | Add `addEntryToSnapshot` service function |
| `src/server/controllers/bank-asset.controller.ts` | Add `addEntryToSnapshotHandler` |
| `src/server/trpc/router/bank-asset.ts` | Register `addEntryToSnapshot` mutation on `bankAssetRouter` |
| `src/app/(authorized)/assets/bank/BankAssetsClient.tsx` | Add state + inline form + mutation call for per-bank "Add Account" |

### Files to CREATE

None — no new files are required for this feature. All changes are additive edits to existing modules.

### Files to REFERENCE (unchanged)

| File | Why Referenced |
|------|---------------|
| `src/app/(authorized)/assets/bank/NewSnapshotModal.tsx` | `AppCreatableSelect` + `createBankAccount` mutation usage pattern to copy exactly |
| `prisma/schema.prisma` | Verbatim model definitions for `BankBalanceSnapshot`, `BankBalanceRecord`, `BankAccount` |
| `src/server/utils/prisma.ts` | `handleCaughtError` — used by every controller handler |

---

## Verbatim Schema — Relevant Models

```prisma
// BankAccount — user's individual account at a bank
model BankAccount {
  id             String               @id @default(cuid())
  name           String
  bankId         String
  bank           Business             @relation(fields: [bankId], references: [id])
  userId         String
  user           User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  @@unique([name, bankId, userId])
  @@index([userId, bankId])
}

// BankBalanceSnapshot — point-in-time snapshot header (one per date)
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

// BankBalanceRecord — a single account's balance at one snapshot date
model BankBalanceRecord {
  id            String              @id @default(cuid())
  balance       Decimal             @db.Money
  accountId     String
  account       BankAccount         @relation(fields: [accountId], references: [id])
  snapshotId    String
  snapshot      BankBalanceSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  importImage   ImportImage?        @relation(fields: [importImageId], references: [id])
  importImageId String?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  @@unique([accountId, snapshotId])   // ← enforces no duplicate account per snapshot
  @@index([snapshotId])
}
```

**Key constraint:** `@@unique([accountId, snapshotId])` on `BankBalanceRecord` is the database-level guard against duplicate entries. No schema migration is needed for this feature.

---

## Key Types Involved

### Existing (from `src/types/bank-asset.types.ts`)

```typescript
type BankTotalSummary = {
  bankId: string;
  bankName: string;
  total: number;
  accounts: AccountBalance[];
};

type AccountBalance = {
  accountId: string;
  accountName: string;
  balance: number;
};

type SnapshotTotals = {
  snapshotId: string;
  snapshotDate: Date;
  grandTotal: number;
  banks: BankTotalSummary[];
};
```

### New (defined in schema file)

```typescript
export type AddEntryToSnapshotInput = TypeOf<typeof addEntryToSnapshotSchema>;
```

---

## Existing Patterns Being Reused

### 1. Controller handler pattern

Every handler in `bank-asset.controller.ts` follows:
```typescript
export const xyzHandler = async ({ input, userId }: { input: XyzInput; userId: string }) => {
  try {
    const result = await xyzService(...);
    return { status: 'success', data: { result } };
  } catch (e) {
    handleCaughtError(e);
  }
};
```

### 2. tRPC `protectedProcedure` router pattern

```typescript
addEntryToSnapshot: protectedProcedure
  .input(addEntryToSnapshotSchema)
  .mutation(({ input, ctx: { session } }) =>
    addEntryToSnapshotHandler({ input, userId: session.user.id }),
  ),
```

### 3. Ownership guard pattern (from `updateBankAssetEntry`)

```typescript
const entry = await prisma.bankBalanceRecord.findFirst({
  where: { id: entryId, snapshot: { userId } },
});
if (!entry) throw new Error('Entry not found or does not belong to user');
```

### 4. Query invalidation after mutation (from `deleteEntryMutation` in `BankAssetsClient.tsx`)

```typescript
utils.bankAsset.getSnapshots.invalidate();
utils.bankAsset.getMostRecentSnapshot.invalidate();
utils.bankAsset.getSnapshotTotals.invalidate();
```

### 5. `AppCreatableSelect` + `createBankAccount` async flow (from `NewSnapshotModal.tsx`)

```typescript
onCreateOption={(inputValue) => {
  handleCreateAccount(bankId, inputValue)
    .then((newAccountId) => {
      setNewEntryAccountId(newAccountId);
      toast.success(`Account "${inputValue}" created!`);
    })
    .catch(() => { /* already toasted */ });
}}
```
Where `handleCreateAccount` calls `createAccountMutation.mutateAsync(...)` and returns `result.data.account.id`.

### 6. Inline edit row pattern (from `editingAccountName` state in `BankAssetsClient.tsx`)

State is `string | null` keyed to an entity ID. When the state matches the current row's ID, the row renders an inline input + confirm/cancel buttons instead of display text.
