# Bank Assets Feature - Quick Reference Guide

## 🎯 Feature Overview

Track cash holdings across multiple bank accounts with point-in-time snapshots. View positions through different calendar year lenses (Fiscal, Annual, Zakat).

---

## 📁 File Structure

```
src/
├── server/
│   ├── schema/
│   │   └── bank-asset.schema.ts          # Zod validation schemas
│   ├── services/
│   │   └── bank-asset.service.ts         # Database operations
│   ├── controllers/
│   │   └── bank-asset.controller.ts      # Request handlers
│   └── trpc/
│       └── router/
│           ├── bank-asset.ts             # tRPC endpoints
│           └── _app.ts                   # Router registry (modified)
├── types/
│   └── bank-asset.types.ts               # TypeScript definitions
└── app/
    └── (authorized)/
        └── cashflow/
            └── bank/                      # ✅ Phase 2: COMPLETE
                ├── page.tsx              # Server component (88 lines)
                └── BankAssetsClient.tsx # Client component (283 lines)

prisma/
└── schema.prisma                          # Models added

scripts/
└── migrate-bank-assets.ps1                # Migration helper

spec/
├── bank-assets-cash-tracking-prd.md       # Main PRD (updated)
├── bank-assets-phase1-completion.md       # Phase 1 summary
└── bank-assets-migration-instructions.md  # Migration guide
```

---

## 🗄️ Database Models

### BankAccount

```prisma
- id: String (cuid)
- name: String (e.g., "Savings")
- bankId: String → Business
- userId: String → User
- Unique: [name, bankId, userId]
```

### BankAssetSnapshot

```prisma
- id: String (cuid)
- snapshotDate: DateTime
- userId: String → User
- entries: BankAssetEntry[]
- Index: [userId, snapshotDate]
```

### BankAssetEntry

```prisma
- id: String (cuid)
- balance: Decimal (@db.Money)
- accountId: String → BankAccount
- snapshotId: String → BankAssetSnapshot
- Unique: [accountId, snapshotId]
```

---

## 🔌 API Endpoints (tRPC)

### Bank Accounts

```typescript
// Create a new bank account
trpc.bankAsset.createBankAccount.mutate({
  name: "Savings Account",
  bankId: "clxx..."
})

// Get user's bank accounts (optionally filter by bank)
trpc.bankAsset.getBankAccounts.query({
  bankId?: "clxx..."
})
```

### Snapshots

```typescript
// Create a new snapshot with entries
trpc.bankAsset.createSnapshot.mutate({
  snapshotDate: new Date("2026-01-31"),
  entries: [
    { accountId: "clxx1...", balance: 10000.50 },
    { accountId: "clxx2...", balance: 25000.00 }
  ]
})

// Get all snapshots (optionally filter)
trpc.bankAsset.getSnapshots.query({
  calendarYearId?: "clxx...",
  calendarType?: "FISCAL" | "ANNUAL" | "ZAKAT"
})

// Get most recent snapshot
trpc.bankAsset.getMostRecentSnapshot.query({
  calendarYearId?: "clxx..."
})

// Get specific snapshot by ID
trpc.bankAsset.getSnapshotById.query({
  snapshotId: "clxx..."
})

// Get aggregated totals for a snapshot
trpc.bankAsset.getSnapshotTotals.query({
  snapshotId: "clxx..."
})
```

### Entries

```typescript
// Update an entry's balance
trpc.bankAsset.updateEntry.mutate({
  entryId: 'clxx...',
  balance: 12500.75,
});

// Delete an entry
trpc.bankAsset.deleteEntry.mutate({
  entryId: 'clxx...',
});

// Delete entire snapshot
trpc.bankAsset.deleteSnapshot.mutate({
  snapshotId: 'clxx...',
});
```

---

## 🔐 Security Features

✅ All operations are **user-scoped** (userId filtering)
✅ Ownership verification before updates/deletes
✅ Protected procedures (authentication required)
✅ No cross-user data access possible
✅ Transactional snapshot creation (atomicity)

---

## 📊 Response Types

### Snapshot Totals Response

```typescript
{
  snapshotId: string;
  snapshotDate: Date;
  grandTotal: number;
  banks: [
    {
      bankId: string;
      bankName: string;
      total: number;
      accounts: [
        {
          accountId: string;
          accountName: string;
          balance: number;
        }
      ]
    }
  ]
}
```

### Snapshot with Entries

```typescript
{
  id: string;
  snapshotDate: Date;
  userId: string;
  entries: [
    {
      id: string;
      balance: Decimal;
      account: {
        id: string;
        name: string;
        bank: {
          id: string;
          name: string;
        }
      }
    }
  ]
}
```

---

## 🚀 Quick Start (After Migration)

### 1. Run Migration

```powershell
# Stop dev server first!
.\scripts\migrate-bank-assets.ps1
```

### 2. Test API (in dev tools or test file)

```typescript
// Create account
const account = await trpc.bankAsset.createBankAccount.mutate({
  name: 'Test Savings',
  bankId: 'existing_bank_id',
});

// Create snapshot
const snapshot = await trpc.bankAsset.createSnapshot.mutate({
  snapshotDate: new Date(),
  entries: [{ accountId: account.data.account.id, balance: 5000 }],
});

// Get totals
const totals = await trpc.bankAsset.getSnapshotTotals.query({
  snapshotId: snapshot.data.snapshot.id,
});

console.log(totals); // { grandTotal: 5000, banks: [...] }
```

---

## 🎨 UI Implementation Guide (Phase 2)

### Page Location

```
src/app/(authorized)/cashflow/bank/page.tsx
```

### Key Components Needed

1. **Calendar Year Selector**
   - Tabs/Toggle for FISCAL | ANNUAL | ZAKAT
   - Dropdown for specific year within type

2. **Grand Total Card**
   - Display `totals.grandTotal`
   - Prominent, top of page

3. **Bank Accordion**
   - Use Headless UI `Disclosure`
   - Header: Bank name + bank total
   - Body: Account table with balances

4. **Snapshot Date Display**
   - "Snapshot as of: DD MMM YYYY"

5. **New Snapshot Button**
   - Opens modal/drawer with form

---

## 🧪 Testing Checklist

- [ ] Create bank account
- [ ] Create snapshot with multiple accounts
- [ ] Fetch most recent snapshot
- [ ] Calculate totals correctly (by bank and overall)
- [ ] Update entry balance
- [ ] Delete entry
- [ ] Delete snapshot
- [ ] Calendar year filtering works
- [ ] User data isolation (can't see other users' data)
- [ ] Cascade deletes work properly

---

## 📝 Common Patterns

### Get Current Snapshot for Display

```typescript
const { data: snapshot } = trpc.bankAsset.getMostRecentSnapshot.useQuery({
  calendarYearId: selectedYearId,
});

const { data: totals } = trpc.bankAsset.getSnapshotTotals.useQuery(
  { snapshotId: snapshot?.id },
  { enabled: !!snapshot?.id },
);
```

### Create Snapshot with Pre-fill

```typescript
// 1. Get previous snapshot
const previousSnapshot = await trpc.bankAsset.getMostRecentSnapshot.query({});

// 2. Pre-fill form with previous entries
const formData = {
  snapshotDate: new Date(), // Today
  entries:
    previousSnapshot?.entries.map((entry) => ({
      accountId: entry.accountId,
      balance: Number(entry.balance), // User will update
    })) || [],
};

// 3. User modifies balances, adds/removes accounts

// 4. Submit
await trpc.bankAsset.createSnapshot.mutate(formData);
```

---

## ⚠️ Important Notes

1. **Migration Requirement**: PowerShell 6+ needed
2. **Stop Dev Server**: Before running Prisma migrations
3. **Money Type**: Use Decimal/number, displayed as currency
4. **Date Handling**: Snapshots use `DateTime`, handle timezone appropriately
5. **Unique Constraints**: Account names must be unique per bank per user
6. **Cascade Deletes**: Deleting snapshot removes all entries automatically

---

## 🔗 Related Documentation

- [Main PRD](./bank-assets-cash-tracking-prd.md)
- [Migration Instructions](./bank-assets-migration-instructions.md)
- [Phase 1 Completion](./bank-assets-phase1-completion.md)
- [Type Definitions](../src/types/bank-asset.types.ts)

---

**Last Updated**: 2026-02-18
**Current Phase**: Phase 1-4 ✅ COMPLETE | All 12 User Stories Implemented
