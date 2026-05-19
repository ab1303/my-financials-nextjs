# Brokerage Account Model: Low-Level Design

## Phase Map

| Phase | Scope | Depends On |
|---|---|---|
| 1 | Prisma schema + migration | — |
| 2 | Service layer + tRPC endpoints | Phase 1 |
| 3 | TypeScript types | Phase 2 |
| 4 | UI — StockAssetsClient | Phase 3 |
| 5 | UI — NewSnapshotModal + HoldingFormModal | Phase 4 |

---

## Phase 1: Prisma Schema + Migration

### Goal

Change `StockHolding.accountId` FK target from `Business` to `BankAccount`.

### Schema Changes (`prisma/schema.prisma`)

**Remove from `Business` model:**
```prisma
// DELETE this line from Business:
stockHoldings    StockHolding[]
```

**Change `StockHolding` model:**
```prisma
// BEFORE:
model StockHolding {
  accountId String
  account   Business    @relation(fields: [accountId], references: [id])
  ...
}

// AFTER:
model StockHolding {
  accountId String
  account   BankAccount @relation(fields: [accountId], references: [id])
  ...
}
```

**Add back-relation to `BankAccount` model:**
```prisma
model BankAccount {
  // ... existing fields ...
  stockHoldings StockHolding[]   // ADD this line
}
```

### Migration Command

```bash
# Stop dev server first (Windows EPERM prevention)
pnpm prisma migrate dev --name brokerage-account-sub-accounts
```

### Data Migration (if prod data exists)

Before running the schema migration, run this SQL to create default sub-accounts and migrate FKs:

```sql
-- Step 1: For each Business/BROKERAGE that has holdings, create a "Default Account" BankAccount
INSERT INTO "BankAccount" (id, name, "bankId", "userId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'Default Account',
  b.id,
  b."userId",
  NOW(),
  NOW()
FROM "Business" b
WHERE b.type = 'BROKERAGE'
  AND EXISTS (SELECT 1 FROM "StockHolding" sh WHERE sh."accountId" = b.id)
ON CONFLICT DO NOTHING;

-- Step 2: Update StockHolding.accountId to the new BankAccount.id
UPDATE "StockHolding" sh
SET "accountId" = ba.id
FROM "BankAccount" ba
JOIN "Business" b ON ba."bankId" = b.id
WHERE sh."accountId" = b.id
  AND ba.name = 'Default Account';
```

---

## Phase 2: Service Layer + tRPC Endpoints

### 2a. Update `stock-asset.service.ts`

#### `createStockSnapshot` — Update account verification

```typescript
// BEFORE: verifies Business
const accounts = await tx.business.findMany({
  where: { id: { in: accountIds }, userId, type: 'BROKERAGE' },
});

// AFTER: verifies BankAccount (with bank type check)
const accounts = await tx.bankAccount.findMany({
  where: {
    id: { in: accountIds },
    userId,
    bank: { type: 'BROKERAGE' },
  },
});
if (accounts.length !== accountIds.length) {
  throw new Error('One or more brokerage sub-accounts not found or not owned by user');
}
```

#### `createStockHolding` — Same verification update

Apply the same `bankAccount.findMany` check instead of `business.findMany`.

#### `getSnapshotWithHoldings` — Update include clause

```typescript
// BEFORE:
include: {
  account: { select: { id: true, name: true } }
}

// AFTER:
include: {
  account: {
    select: {
      id: true,
      name: true,
      bank: { select: { id: true, name: true } }
    }
  }
}
```

Apply this to ALL service methods that include holdings: `getStockSnapshots`, `getMostRecentSnapshot`, `getSnapshotById`, `getSnapshotTotals`.

#### `getSnapshotTotals` — Update grouping key

```typescript
// BEFORE: group by holding.accountId (Business.id)
// AFTER: group by holding.accountId (BankAccount.id), display as:
const accountLabel = `${holding.account.bank.name} — ${holding.account.name}`;
```

Update `AccountTotalSummary` construction to use `account.bank.name + " — " + account.name` for display.

### 2b. New Service Methods (add to `stock-asset.service.ts`)

```typescript
/**
 * Get all brokerage sub-accounts for a user, with parent institution.
 */
export const getBrokerageAccounts = async (userId: string) => {
  return await prisma.bankAccount.findMany({
    where: {
      userId,
      bank: { type: 'BROKERAGE' },
    },
    select: {
      id: true,
      name: true,
      bank: { select: { id: true, name: true } },
    },
    orderBy: [
      { bank: { name: 'asc' } },
      { name: 'asc' },
    ],
  });
};

/**
 * Create a new brokerage sub-account under an existing Business/BROKERAGE.
 */
export const createBrokerageSubAccount = async (
  userId: string,
  input: { businessId: string; name: string }
) => {
  // Verify the institution belongs to user and is BROKERAGE
  const institution = await prisma.business.findFirst({
    where: { id: input.businessId, userId, type: 'BROKERAGE' },
  });
  if (!institution) {
    throw new Error('Brokerage institution not found or not owned by user');
  }
  return await prisma.bankAccount.create({
    data: {
      name: input.name,
      bankId: input.businessId,
      userId,
    },
    select: {
      id: true,
      name: true,
      bank: { select: { id: true, name: true } },
    },
  });
};
```

### 2c. New tRPC Endpoints (add to `stock-asset.ts` router)

```typescript
getBrokerageAccounts: protectedProcedure.query(async ({ ctx }) => {
  return stockAssetController.getBrokerageAccounts(ctx);
}),

createBrokerageSubAccount: protectedProcedure
  .input(z.object({
    businessId: z.string(),
    name: z.string().min(1).max(100),
  }))
  .mutation(async ({ ctx, input }) => {
    return stockAssetController.createBrokerageSubAccount(ctx, input);
  }),
```

### 2d. New tRPC Endpoint in `business.ts` router

```typescript
getBrokeragesWithAccounts: protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.session.user.id;
  return await prisma.business.findMany({
    where: { userId, type: 'BROKERAGE' },
    select: {
      id: true,
      name: true,
      bankAccounts: {
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
}),
```

### 2e. Controller Methods (add to `stock-asset.controller.ts`)

```typescript
getBrokerageAccounts: async (ctx: TRPCContext) => {
  const userId = ctx.session.user.id;
  return handleCaughtError(() => getBrokerageAccounts(userId));
},

createBrokerageSubAccount: async (ctx: TRPCContext, input: { businessId: string; name: string }) => {
  const userId = ctx.session.user.id;
  return handleCaughtError(() => createBrokerageSubAccount(userId, input));
},
```

---

## Phase 3: TypeScript Types

### Updates to `src/types/stock-asset.types.ts`

```typescript
import type { PortfolioSnapshot, StockHolding, Business, BankAccount, CurrencyEnumType, InvestmentTermEnumType } from '@prisma/client';

// BEFORE:
export type StockHoldingWithAccount = StockHolding & {
  account: Pick<Business, 'id' | 'name'>;
};

// AFTER:
export type StockHoldingWithAccount = StockHolding & {
  account: Pick<BankAccount, 'id' | 'name'> & {
    bank: Pick<Business, 'id' | 'name'>;
  };
};

// BEFORE:
export type BrokerageAccountOption = {
  value: string; // Business.id
  label: string; // Business.name
};

// AFTER:
export type BrokerageAccountOption = {
  value: string;           // BankAccount.id
  label: string;           // "InstitutionName — AccountName"
  institutionId: string;   // Business.id (for grouping)
  institutionName: string; // Business.name (for display)
};

// NEW:
export type BrokerageInstitutionOption = {
  value: string; // Business.id
  label: string; // Business.name
};

// Also update AccountTotalSummary:
export type AccountTotalSummary = {
  accountId: string;            // BankAccount.id
  accountName: string;          // "InstitutionName — AccountName"
  institutionName: string;      // Business.name (NEW)
  subAccountName: string;       // BankAccount.name (NEW)
  currency: CurrencyEnumType;
  holdings: HoldingDisplay[];
  totalMarketValue: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
};
```

---

## Phase 4: UI — StockAssetsClient

### `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx`

#### Replace brokerage account fetch

```typescript
// BEFORE:
const { data: brokerageAccounts = [] } = trpc.business.getBusinessesByType.useQuery(
  { type: 'BROKERAGE' }
);

// AFTER:
const { data: brokerageAccounts = [] } = trpc.stockAsset.getBrokerageAccounts.useQuery();
const { data: brokerageInstitutions = [] } = trpc.business.getBrokeragesWithAccounts.useQuery();
```

#### Update props passed to modals

```typescript
// Pass both to NewSnapshotModal and HoldingFormModal:
brokerageAccounts={brokerageAccounts}
brokerageInstitutions={brokerageInstitutions}
```

#### Update account accordion display

```typescript
// BEFORE: accountName from Business.name
// AFTER: accountName from `${account.bank.name} — ${account.name}`
// Update wherever AccountTotalSummary.accountName is displayed
```

---

## Phase 5: UI — NewSnapshotModal + HoldingFormModal

Both modals share the same pattern. Describe once; apply to both.

### Two-Level Dependent Select Pattern

Replace the single `CreatableAppSelect` for brokerage with **two stacked selects**:

```tsx
// State at form level (per-holding)
const [selectedInstitution, setSelectedInstitution] = useState<{ id: string; name: string } | null>(null);

// 1. Institution select (CreatableAppSelect)
<CreatableAppSelect
  label="Brokerage Institution"
  options={brokerageInstitutions.map(b => ({ value: b.id, label: b.name }))}
  value={selectedInstitution ? { value: selectedInstitution.id, label: selectedInstitution.name } : null}
  onChange={(opt) => {
    setSelectedInstitution(opt ? { id: opt.value, label: opt.label } : null);
    field.onChange(''); // reset account field
  }}
  onCreateOption={async (name) => {
    const created = await createBusiness({ name, type: 'BROKERAGE' });
    setSelectedInstitution({ id: created.id, name: created.name });
    field.onChange('');
  }}
  formatCreateLabel={(input) => `Create brokerage "${input}"`}
/>

// 2. Account select (CreatableAppSelect, disabled until institution selected)
<CreatableAppSelect
  label="Account"
  isDisabled={!selectedInstitution}
  placeholder={selectedInstitution ? 'Select or create account…' : 'Select institution first'}
  options={
    brokerageInstitutions
      .find(b => b.id === selectedInstitution?.id)
      ?.bankAccounts.map(a => ({ value: a.id, label: a.name })) ?? []
  }
  value={field.value ? { value: field.value, label: accountNameForId(field.value) } : null}
  onChange={(opt) => field.onChange(opt?.value ?? '')}
  onCreateOption={async (name) => {
    const created = await createBrokerageSubAccount({
      businessId: selectedInstitution!.id,
      name,
    });
    field.onChange(created.id);
    // Add new account to local institutions list via utils.invalidate or local state
  }}
  formatCreateLabel={(input) => `Create account "${input}"`}
/>
```

### `useFieldArray` Integration

`selectedInstitution` should be **per-holding**, not global state. Store alongside the form field array:

```typescript
// Extend the field array item type:
type HoldingFormItem = HoldingFormData & {
  _institutionId?: string;    // transient UI state, not submitted
  _institutionName?: string;  // transient UI state, not submitted
};
```

Or maintain a parallel `selectedInstitutions: Record<index, InstitutionOption>` state map.

### Props Interface Updates

```typescript
// NewSnapshotModal props:
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  brokerageAccounts: Array<{ id: string; name: string; bank: { id: string; name: string } }>;
  brokerageInstitutions: Array<{ id: string; name: string; bankAccounts: Array<{ id: string; name: string }> }>;
}

// HoldingFormModal props:
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingHolding?: StockHoldingWithAccount | null;
  defaultAccountId?: string;
  brokerageAccounts: Array<{ id: string; name: string; bank: { id: string; name: string } }>;
  brokerageInstitutions: Array<{ id: string; name: string; bankAccounts: Array<{ id: string; name: string }> }>;
}
```

### Invalidation after Sub-Account Creation

After `createBrokerageSubAccount` succeeds:
```typescript
await utils.business.getBrokeragesWithAccounts.invalidate();
await utils.stockAsset.getBrokerageAccounts.invalidate();
```

---

## Acceptance Criteria

### Phase 1
- [ ] `prisma migrate dev` succeeds with no errors
- [ ] `StockHolding.accountId` FK resolves to `BankAccount`, not `Business`
- [ ] Existing bank accounts unaffected

### Phase 2
- [ ] `getBrokerageAccounts` returns `BankAccount[]` with `bank` nested
- [ ] `createBrokerageSubAccount` creates `BankAccount` and verifies institution ownership + BROKERAGE type
- [ ] `createStockSnapshot` rejects `accountId`s not matching `BankAccount` with `bank.type=BROKERAGE`
- [ ] `getSnapshotTotals` groups by `BankAccount.id`, display label = `"Institution — Account"`

### Phase 3
- [ ] `StockHoldingWithAccount.account.bank.name` compiles without type errors
- [ ] `BrokerageAccountOption` carries `institutionId` and `institutionName`
- [ ] No `Business` import in stock-asset types (removed)

### Phase 4
- [ ] `StockAssetsClient` accordion headers show `"Fidelity — Roth IRA"` format
- [ ] Page renders without type errors

### Phase 5
- [ ] Institution select shows all BROKERAGE businesses
- [ ] Account select is disabled until institution is selected
- [ ] Selecting an institution filters account options to that institution's sub-accounts
- [ ] Creating a new institution creates a `Business/BROKERAGE` and enables account select
- [ ] Creating a new account creates a `BankAccount` under selected institution
- [ ] Form validates that `accountId` (BankAccount) is set before submission
- [ ] Editing a holding pre-selects both institution and account correctly
- [ ] `pnpm run build` passes with no TypeScript errors
