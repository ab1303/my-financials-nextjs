# Brokerage Account Model: Context & File Inventory

## Feature Summary

Upgrade `StockHolding.accountId` from pointing to `Business` (institution) to `BankAccount` (sub-account under institution). Enables users to distinguish between multiple accounts at the same brokerage (e.g., Fidelity IRA vs Fidelity Individual). Aligns with industry-standard 3-tier Institution → Account → Holdings model.

---

## Files to Modify

### Schema

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Change `StockHolding.account` relation from `Business` to `BankAccount`; rename field `account Business` → `account BankAccount`; update `accountId` FK |

### Backend

| File | Change |
|------|--------|
| `src/server/schema/stock-asset.schema.ts` | `accountId` remains `z.string()` — no schema change needed |
| `src/server/services/stock-asset.service.ts` | Update account verification: query `BankAccount` (not `Business`); update `include` clauses to include `bank` (parent Business) |
| `src/server/controllers/stock-asset.controller.ts` | Likely no changes; passes through service layer |
| `src/server/trpc/router/stock-asset.ts` | Add `getBrokerageAccounts` query (replaces `business.getBusinessesByType`); add `createBrokerageSubAccount` mutation |
| `src/server/trpc/router/business.ts` | Add `getBrokerageAccountsWithSubs` query returning `Business[]` with nested `BankAccount[]` |

### Types

| File | Change |
|------|--------|
| `src/types/stock-asset.types.ts` | Update `StockHoldingWithAccount.account` type from `Pick<Business>` to `Pick<BankAccount> & { bank: Pick<Business> }`; update `BrokerageAccountOption`; add `BrokerageInstitutionOption` |

### Frontend

| File | Change |
|------|--------|
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | Replace `brokerageAccounts` fetch (`getBusinessesByType`) with `getBrokerageAccounts`; pass new prop shape to modals; update accordion display |
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | Replace single `CreatableAppSelect` with two-level dependent select (institution → account) |
| `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` | Same as above |

### No Changes Needed

| File | Reason |
|------|--------|
| `src/components/ui/CreatableAppSelect.tsx` | Reused as-is for both institution and account selects |
| `src/components/ui/AppSelect.tsx` | Unchanged |
| `src/utils/stock-asset-calculations.ts` | Pure calculations, no account FK involved |
| `src/app/(authorized)/assets/stocks/SummaryCards.tsx` | Receives pre-computed totals, no account FK |
| `src/app/(authorized)/assets/bank/` | `BankAccount` model unchanged; bank feature unaffected |

---

## Current DB Schema (Relevant Excerpts)

```prisma
model Business {
  id           String            @id @default(cuid())
  name         String
  type         BusinessEnumType?
  bankAccounts BankAccount[]     // ← already supports sub-accounts
  stockHoldings StockHolding[]   // ← will be REMOVED after migration
  userId       String
}

model BankAccount {
  id        String    @id @default(cuid())
  name      String                         // e.g., "Roth IRA", "Individual"
  bankId    String
  bank      Business  @relation(fields: [bankId], references: [id])
  userId    String
  @@unique([name, bankId, userId])
}

model StockHolding {
  id        String   @id @default(cuid())
  accountId String
  account   Business @relation(fields: [accountId], references: [id])  // ← CHANGE THIS
  snapshotId String
  // ... other fields
}
```

### Target Schema

```prisma
model StockHolding {
  id        String      @id @default(cuid())
  accountId String
  account   BankAccount @relation(fields: [accountId], references: [id])  // ← CHANGED
  snapshotId String
  // ... other fields
}
```

Note: Remove `stockHoldings StockHolding[]` from `Business` model.

---

## Current tRPC API (Relevant)

| Endpoint | Router | Current Behaviour |
|---|---|---|
| `business.getBusinessesByType` | `business.ts` | Returns `Business[]` filtered by type |
| *(none)* | — | No query for sub-accounts by institution |

### New tRPC Endpoints Required

| Endpoint | Router | Behaviour |
|---|---|---|
| `stockAsset.getBrokerageAccounts` | `stock-asset.ts` | Returns `BankAccount[]` where `bank.type=BROKERAGE` and `userId` matches, with `bank` included |
| `stockAsset.createBrokerageSubAccount` | `stock-asset.ts` | Creates `BankAccount` under a `Business/BROKERAGE`; validates business ownership + BROKERAGE type |
| `business.getBrokeragesWithAccounts` | `business.ts` | Returns `Business[type=BROKERAGE]` with nested `bankAccounts[]` — used by institution+account pickers |

---

## Current Type Shapes (Relevant)

```typescript
// BEFORE
export type StockHoldingWithAccount = StockHolding & {
  account: Pick<Business, 'id' | 'name'>;
};

export type BrokerageAccountOption = {
  value: string; // Business.id
  label: string; // Business.name
};

// AFTER
export type StockHoldingWithAccount = StockHolding & {
  account: Pick<BankAccount, 'id' | 'name'> & {
    bank: Pick<Business, 'id' | 'name'>;
  };
};

export type BrokerageAccountOption = {
  value: string; // BankAccount.id
  label: string; // "InstitutionName — AccountName"
};

export type BrokerageInstitutionOption = {
  value: string; // Business.id
  label: string; // Business.name
};
```

---

## Migration Strategy

### Zero Prod Data (Recommended Path)

1. Drop `Business.stockHoldings` relation
2. Add `StockHolding.account BankAccount` relation
3. Run `prisma migrate dev --name brokerage-account-sub-accounts`

### With Existing Prod Data

1. Create migration: for each `Business/BROKERAGE` with holdings, create one `BankAccount` named `"Default Account"`
2. `UPDATE StockHolding SET accountId = (SELECT new_bank_account_id WHERE bank.id = old_business_id)`
3. Then apply FK constraint change

---

## Key Business Rules (Unchanged)

- `accountId` must belong to authenticated user
- Institution (`Business`) must have `type=BROKERAGE`
- Sub-account (`BankAccount`) must belong to a `BROKERAGE` institution
- `[name, bankId, userId]` uniqueness constraint on `BankAccount` prevents duplicate account names per institution per user
