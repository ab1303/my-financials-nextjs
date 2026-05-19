# Brokerage Account Model: Low-Level Design

## Phase Map

| Phase | Scope | Depends On |
|---|---|---|
| 0 | Prisma schema rename: `BankAccount` → `FinancialAccount` (schema-wide) | — |
| 1 | Prisma schema: `StockHolding` FK change + migration | Phase 0 |
| 2 | Service layer + tRPC endpoints | Phase 1 |
| 3 | TypeScript types | Phase 2 |
| 4 | UI — StockAssetsClient | Phase 3 |
| 5 | UI — NewSnapshotModal + HoldingFormModal | Phase 4 |

---

## Phase 0: Prisma Schema Rename — `BankAccount` → `FinancialAccount`

### Goal

Rename the `BankAccount` model to `FinancialAccount` across the entire schema to establish correct domain language. This is a prerequisite for all subsequent phases and affects **all feature areas** that use bank sub-accounts (banking, transactions, transfer rules).

### Schema Changes (`prisma/schema.prisma`)

**Rename the model and its fields:**
```prisma
// BEFORE:
model BankAccount {
  id     String   @id @default(cuid())
  name   String
  bankId String
  bank   Business @relation(fields: [bankId], references: [id])
  userId String
  @@unique([name, bankId, userId])
}

// AFTER:
model FinancialAccount {
  id            String   @id @default(cuid())
  name          String
  institutionId String
  institution   Business @relation(fields: [institutionId], references: [id])
  userId        String
  @@unique([name, institutionId, userId])
}
```

**Update back-relation on `Business` model:**
```prisma
// BEFORE:
model Business {
  bankAccounts BankAccount[]
}

// AFTER:
model Business {
  financialAccounts FinancialAccount[]
}
```

**Update back-relation on `User` model:**
```prisma
// BEFORE:
model User {
  bankAccounts BankAccount[]
}

// AFTER:
model User {
  financialAccounts FinancialAccount[]
}
```

**Update every other model that holds a FK to `BankAccount`** (e.g., `BankBalanceSnapshot`, `Transaction`, `TransferMatchRule`). For each:
```prisma
// Replace:
account   BankAccount @relation(...)
accountId String

// With:
account   FinancialAccount @relation(...)
accountId String
```

### Migration Command

```bash
# Stop dev server first (Windows EPERM prevention)
pnpm prisma migrate dev --name rename-bank-account-to-financial-account
```

> Prisma detects the model rename and generates `ALTER TABLE "BankAccount" RENAME TO "FinancialAccount"` plus the column renames automatically. **Always review the generated SQL** in `prisma/migrations/` before applying to confirm renames — not drops and recreates.

### Non-Source Files to Update After `prisma generate`

All backend service, controller, and router files that call `prisma.bankAccount.*` must be updated to `prisma.financialAccount.*`, and all references to `.bankId` / `.bank` / `.bankAccounts` on query results must change to `.institutionId` / `.institution` / `.financialAccounts`.

---

## Phase 1: Prisma Schema — `StockHolding` FK Change

### Goal

Change `StockHolding.accountId` FK target from `Business` to `FinancialAccount`.

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
  account   Business         @relation(fields: [accountId], references: [id])
  ...
}

// AFTER:
model StockHolding {
  accountId String
  account   FinancialAccount @relation(fields: [accountId], references: [id])
  ...
}
```

**Add back-relation to `FinancialAccount` model:**
```prisma
model FinancialAccount {
  // ... existing fields (from Phase 0) ...
  stockHoldings StockHolding[]   // ADD this line
}
```

### Migration Command

```bash
# Stop dev server first (Windows EPERM prevention)
pnpm prisma migrate dev --name stock-holding-fk-to-financial-account
```

### Data Migration (if prod stock data exists)

Run Phase 0 migration first, then before applying the Phase 1 FK constraint change, backfill with:

```sql
-- Step 1: For each Business/BROKERAGE with holdings, create a "Default Account" FinancialAccount
INSERT INTO "FinancialAccount" (id, name, "institutionId", "userId", "createdAt", "updatedAt")
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

-- Step 2: Update StockHolding.accountId to the new FinancialAccount.id
UPDATE "StockHolding" sh
SET "accountId" = fa.id
FROM "FinancialAccount" fa
JOIN "Business" b ON fa."institutionId" = b.id
WHERE sh."accountId" = b.id
  AND fa.name = 'Default Account';
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

// AFTER: verifies FinancialAccount (with institution type check)
const accounts = await tx.financialAccount.findMany({
  where: {
    id: { in: accountIds },
    userId,
    institution: { type: 'BROKERAGE' },
  },
});
if (accounts.length !== accountIds.length) {
  throw new Error('One or more brokerage sub-accounts not found or not owned by user');
}
```

#### `createStockHolding` — Same verification update

Apply the same `financialAccount.findMany` check instead of `business.findMany`.

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
      institution: { select: { id: true, name: true } }
    }
  }
}
```

Apply this to ALL service methods that include holdings: `getStockSnapshots`, `getMostRecentSnapshot`, `getSnapshotById`, `getSnapshotTotals`.

#### `getSnapshotTotals` — Update grouping key

```typescript
// BEFORE: group by holding.accountId (Business.id)
// AFTER: group by holding.accountId (FinancialAccount.id), display as:
const accountLabel = `${holding.account.institution.name} — ${holding.account.name}`;
```

Update `AccountTotalSummary` construction to use `account.institution.name + " — " + account.name` for display.

### 2b. New Service Methods (add to `stock-asset.service.ts`)

```typescript
/**
 * Get all brokerage sub-accounts for a user, with parent institution.
 */
export const getBrokerageAccounts = async (userId: string) => {
  return await prisma.financialAccount.findMany({
    where: {
      userId,
      institution: { type: 'BROKERAGE' },
    },
    select: {
      id: true,
      name: true,
      institution: { select: { id: true, name: true } },
    },
    orderBy: [
      { institution: { name: 'asc' } },
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
  const business = await prisma.business.findFirst({
    where: { id: input.businessId, userId, type: 'BROKERAGE' },
  });
  if (!business) {
    throw new Error('Brokerage institution not found or not owned by user');
  }
  return await prisma.financialAccount.create({
    data: {
      name: input.name,
      institutionId: input.businessId,
      userId,
    },
    select: {
      id: true,
      name: true,
      institution: { select: { id: true, name: true } },
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
      financialAccounts: {
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
import type { PortfolioSnapshot, StockHolding, Business, FinancialAccount, CurrencyEnumType, InvestmentTermEnumType } from '@prisma/client';

// BEFORE:
export type StockHoldingWithAccount = StockHolding & {
  account: Pick<Business, 'id' | 'name'>;
};

// AFTER:
export type StockHoldingWithAccount = StockHolding & {
  account: Pick<FinancialAccount, 'id' | 'name'> & {
    institution: Pick<Business, 'id' | 'name'>;
  };
};

// BEFORE:
export type BrokerageAccountOption = {
  value: string; // Business.id
  label: string; // Business.name
};

// AFTER:
export type BrokerageAccountOption = {
  value: string;           // FinancialAccount.id
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
  accountId: string;            // FinancialAccount.id
  accountName: string;          // "InstitutionName — AccountName"
  institutionName: string;      // Business.name
  subAccountName: string;       // FinancialAccount.name
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
// AFTER: accountName from `${account.institution.name} — ${account.name}`
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
      ?.financialAccounts.map(a => ({ value: a.id, label: a.name })) ?? []
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
  brokerageAccounts: Array<{ id: string; name: string; institution: { id: string; name: string } }>;
  brokerageInstitutions: Array<{ id: string; name: string; financialAccounts: Array<{ id: string; name: string }> }>;
}

// HoldingFormModal props:
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingHolding?: StockHoldingWithAccount | null;
  defaultAccountId?: string;
  brokerageAccounts: Array<{ id: string; name: string; institution: { id: string; name: string } }>;
  brokerageInstitutions: Array<{ id: string; name: string; financialAccounts: Array<{ id: string; name: string }> }>;
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

### Phase 0
- [ ] `prisma migrate dev` succeeds — PostgreSQL table renamed `BankAccount` → `FinancialAccount`, column renamed `bankId` → `institutionId`
- [ ] All existing bank sub-account functionality (balances, transactions, transfer rules) works unchanged
- [ ] `prisma generate` produces `prisma.financialAccount` client — `prisma.bankAccount` no longer exists
- [ ] All backend files updated: no remaining references to `bankAccount`, `bankId`, or `.bank` relation

### Phase 1
- [ ] `prisma migrate dev` succeeds with no errors
- [ ] `StockHolding.accountId` FK resolves to `FinancialAccount`, not `Business`
- [ ] `Business` model no longer has `stockHoldings` back-relation

### Phase 2
- [ ] `getBrokerageAccounts` returns `FinancialAccount[]` with `institution` nested
- [ ] `createBrokerageSubAccount` creates `FinancialAccount` with `institutionId` and verifies BROKERAGE type
- [ ] `createStockSnapshot` rejects `accountId`s not matching `FinancialAccount` with `institution.type=BROKERAGE`
- [ ] `getSnapshotTotals` groups by `FinancialAccount.id`, display label = `"Institution — Account"`

### Phase 3
- [ ] `StockHoldingWithAccount.account.institution.name` compiles without type errors
- [ ] `BrokerageAccountOption` carries `institutionId` and `institutionName`
- [ ] Import uses `FinancialAccount` from `@prisma/client` (not `BankAccount`)

### Phase 4
- [ ] `StockAssetsClient` accordion headers show `"Fidelity — Roth IRA"` format
- [ ] Page renders without type errors

### Phase 5
- [ ] Institution select shows all BROKERAGE businesses
- [ ] Account select is disabled until institution is selected
- [ ] Selecting an institution filters account options to that institution's `financialAccounts`
- [ ] Creating a new institution creates a `Business/BROKERAGE` and enables account select
- [ ] Creating a new account creates a `FinancialAccount` under selected institution with correct `institutionId`
- [ ] Form validates that `accountId` (`FinancialAccount.id`) is set before submission
- [ ] Editing a holding pre-selects both institution and account correctly
- [ ] `pnpm run build` passes with no TypeScript errors
