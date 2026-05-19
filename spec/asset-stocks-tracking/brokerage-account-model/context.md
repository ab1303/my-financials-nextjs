# Brokerage Account Model: Context & File Inventory

## Feature Summary

Two coordinated changes: (1) rename `BankAccount` → `FinancialAccount` across the full schema (`bankId` → `institutionId`, `bank` relation → `institution`, `bankAccounts` → `financialAccounts`); (2) move `StockHolding.accountId` from pointing to `Business` (institution) to `FinancialAccount` (sub-account). Enables users to distinguish multiple accounts at the same brokerage (e.g., Fidelity IRA vs Fidelity Individual). Aligns with industry-standard 3-tier Institution → Account → Holdings model. `Business.type` (BANK | BROKERAGE) remains the reporting discriminator; `FinancialAccount` is type-agnostic.

---

## Files to Modify

### Schema

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Rename model `BankAccount` → `FinancialAccount`; rename field `bankId` → `institutionId`; rename relation `bank` → `institution`; rename back-relation `bankAccounts` → `financialAccounts` on `Business` and `User`; update `@@unique` constraint column; change `StockHolding.account` relation target from `Business` to `FinancialAccount`; remove `stockHoldings` from `Business` |

### Backend

| File | Change |
|------|--------|
| `src/server/schema/stock-asset.schema.ts` | `accountId` remains `z.string()` — no schema change needed |
| `src/server/services/stock-asset.service.ts` | Update account verification: query `financialAccount` (not `business`); update `include` clauses to use `institution` (parent Business) |
| `src/server/services/bank-account.service.ts` | Rename all `prisma.bankAccount` → `prisma.financialAccount`; rename `bankId` → `institutionId`; rename `bank` relation → `institution` |
| `src/server/controllers/stock-asset.controller.ts` | Likely no changes; passes through service layer |
| `src/server/trpc/router/stock-asset.ts` | Add `getBrokerageAccounts` query; add `createBrokerageSubAccount` mutation |
| `src/server/trpc/router/business.ts` | Add `getBrokeragesWithAccounts` query returning `Business[]` with nested `FinancialAccount[]`; update any `bankAccounts` → `financialAccounts` references |
| `src/server/trpc/router/bank-account.ts` *(if exists)* | Update all `bankAccount` Prisma client calls → `financialAccount`; `bankId` → `institutionId` |

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
  id            String            @id @default(cuid())
  name          String
  type          BusinessEnumType?
  bankAccounts  BankAccount[]     // ← will be renamed financialAccounts
  stockHoldings StockHolding[]    // ← will be REMOVED after migration
  userId        String
}

model BankAccount {                              // ← will be renamed FinancialAccount
  id     String   @id @default(cuid())
  name   String                                 // e.g., "NetSaver", "Roth IRA"
  bankId String                                 // ← will be renamed institutionId
  bank   Business @relation(fields: [bankId], references: [id])  // ← will be renamed institution
  userId String
  @@unique([name, bankId, userId])
}

model StockHolding {
  id         String   @id @default(cuid())
  accountId  String
  account    Business @relation(fields: [accountId], references: [id])  // ← CHANGE TO FinancialAccount
  snapshotId String
  // ... other fields
}
```

### Target Schema

```prisma
model Business {
  id                String             @id @default(cuid())
  name              String
  type              BusinessEnumType?
  financialAccounts FinancialAccount[] // ← renamed from bankAccounts
  userId            String
  // stockHoldings removed
}

model FinancialAccount {                         // ← renamed from BankAccount
  id            String         @id @default(cuid())
  name          String                           // e.g., "NetSaver", "Roth IRA", "Individual Brokerage"
  institutionId String                           // ← renamed from bankId
  institution   Business       @relation(fields: [institutionId], references: [id])  // ← renamed from bank
  userId        String
  stockHoldings StockHolding[]                   // ← NEW back-relation
  @@unique([name, institutionId, userId])
}

model StockHolding {
  id         String           @id @default(cuid())
  accountId  String
  account    FinancialAccount @relation(fields: [accountId], references: [id])  // ← CHANGED
  snapshotId String
  // ... other fields
}
```

Note: The `@@unique` constraint column rename (`bankId` → `institutionId`) is handled automatically by Prisma's migration generator.

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
  account: Pick<FinancialAccount, 'id' | 'name'> & {
    institution: Pick<Business, 'id' | 'name'>;
  };
};

export type BrokerageAccountOption = {
  value: string;           // FinancialAccount.id
  label: string;           // "InstitutionName — AccountName"
  institutionId: string;   // Business.id (for grouping/filtering)
  institutionName: string; // Business.name (for display)
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
