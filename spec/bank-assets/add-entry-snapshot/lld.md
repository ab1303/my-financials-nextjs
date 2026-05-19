# Add Entry to Existing Snapshot — Low Level Design

**Version:** 1.0
**Status:** Specced

---

## Phase Map

| Phase | Files Changed | Description |
|-------|--------------|-------------|
| **1** | `bank-asset.schema.ts`, `bank-asset.service.ts`, `bank-asset.controller.ts`, `bank-asset.ts` (router) | New `addEntryToSnapshot` mutation — schema, service, controller, router |
| **2** | `BankAssetsClient.tsx` | Per-bank inline "Add Account" form inside Disclosure.Panel |

---

## Phase 1 — Backend: `addEntryToSnapshot` Mutation

### 1.1 `src/server/schema/bank-asset.schema.ts`

**Add** after the existing `deleteEntrySchema`:

```typescript
// Schema for adding a new entry to an existing snapshot
export const addEntryToSnapshotSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
  accountId: string({ required_error: 'Account is required' }),
  balance: z
    .number({ required_error: 'Balance is required' })
    .min(0, 'Balance must be greater than or equal to 0'),
});

export type AddEntryToSnapshotInput = TypeOf<typeof addEntryToSnapshotSchema>;
```

No import changes needed — `object`, `string`, `z`, `TypeOf` are already imported.

---

### 1.2 `src/server/services/bank-asset.service.ts`

**Add** after `deleteBankAssetEntry`:

```typescript
export const addEntryToSnapshot = async (
  snapshotId: string,
  accountId: string,
  balance: number,
  userId: string,
) => {
  // Verify the snapshot belongs to the caller
  const snapshot = await prisma.bankBalanceSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId,
    },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found or does not belong to user');
  }

  // Verify the account belongs to the caller
  const account = await prisma.bankAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
  });

  if (!account) {
    throw new Error('Account not found or does not belong to user');
  }

  // Create the new record — @@unique([accountId, snapshotId]) enforces no duplicate
  return await prisma.bankBalanceRecord.create({
    data: {
      snapshotId,
      accountId,
      balance,
    },
    include: {
      account: {
        include: {
          bank: true,
        },
      },
    },
  });
};
```

**Notes:**
- No `prisma.$transaction` needed — single write, no multi-step atomicity required.
- Prisma will surface a `P2002` (unique constraint violation) if `(accountId, snapshotId)` already exists; `handleCaughtError` in the controller propagates this to the caller.
- `balance` is typed as `number` and stored as `Decimal @db.Money` — Prisma handles the coercion.

---

### 1.3 `src/server/controllers/bank-asset.controller.ts`

**Add** `addEntryToSnapshot` to the service import:

```typescript
import {
  // ... existing imports ...
  addEntryToSnapshot,          // ← ADD
} from '@/server/services/bank-asset.service';
```

**Add** `AddEntryToSnapshotInput` to the schema type import:

```typescript
import type {
  // ... existing imports ...
  AddEntryToSnapshotInput,     // ← ADD
} from '@/server/schema/bank-asset.schema';
```

**Add** after `deleteSnapshotHandler`:

```typescript
export const addEntryToSnapshotHandler = async ({
  input,
  userId,
}: {
  input: AddEntryToSnapshotInput;
  userId: string;
}) => {
  try {
    const record = await addEntryToSnapshot(
      input.snapshotId,
      input.accountId,
      input.balance,
      userId,
    );
    return {
      status: 'success',
      data: {
        record,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};
```

---

### 1.4 `src/server/trpc/router/bank-asset.ts`

**Add** `addEntryToSnapshotHandler` to the controller import:

```typescript
import {
  // ... existing imports ...
  addEntryToSnapshotHandler,      // ← ADD
} from '@/server/controllers/bank-asset.controller';
```

**Add** `addEntryToSnapshotSchema` to the schema import:

```typescript
import {
  // ... existing imports ...
  addEntryToSnapshotSchema,        // ← ADD
} from '@/server/schema/bank-asset.schema';
```

**Add** after the `deleteSnapshot` route:

```typescript
  // Add entry to existing snapshot
  addEntryToSnapshot: protectedProcedure
    .input(addEntryToSnapshotSchema)
    .mutation(({ input, ctx: { session } }) =>
      addEntryToSnapshotHandler({ input, userId: session.user.id }),
    ),
```

**Final router shape:**

```typescript
export const bankAssetRouter = router({
  createBankAccount: ...,
  getBankAccounts: ...,
  createSnapshot: ...,
  getSnapshots: ...,
  getMostRecentSnapshot: ...,
  getSnapshotById: ...,
  getSnapshotTotals: ...,
  updateEntry: ...,
  deleteEntry: ...,
  deleteSnapshot: ...,
  addEntryToSnapshot: ...,    // ← NEW (last entry)
});
```

---

### Phase 1 Test Cases

| Test | Type | What it verifies |
|------|------|-----------------|
| `addEntryToSnapshot` creates `BankBalanceRecord` when snapshot and account both belong to user | Unit | Happy path |
| `addEntryToSnapshot` throws when `snapshotId` not found for userId | Unit | Ownership guard — snapshot |
| `addEntryToSnapshot` throws when `accountId` not found for userId | Unit | Ownership guard — account |
| `addEntryToSnapshot` throws P2002 (or propagated error) when `(accountId, snapshotId)` already exists | Unit | Duplicate guard |
| `addEntryToSnapshotHandler` returns `{ status: 'success', data: { record } }` on success | Unit | Controller shape |
| `addEntryToSnapshot` tRPC route is protected (unauthenticated call rejected) | Integration | `protectedProcedure` |

---

## Phase 2 — Frontend: Inline "Add Account" Form in BankAssetsClient

### 2.1 New State Variables

**File:** `src/app/(authorized)/assets/bank/BankAssetsClient.tsx`

Add after the existing edit/delete state block:

```typescript
// Add-entry-to-snapshot inline form state
const [addingEntryForBankId, setAddingEntryForBankId] = useState<string | null>(null);
const [newEntryAccountId, setNewEntryAccountId] = useState<string>('');
const [newEntryBalance, setNewEntryBalance] = useState<number>(0);
const [newEntryError, setNewEntryError] = useState<string>('');
```

---

### 2.2 New tRPC Queries and Mutations

Add after `deleteSnapshotMutation`:

```typescript
// Fetch all bank accounts for the inline add-entry form (filtered per-bank on client)
const { data: allBankAccounts = [] } = trpc.bankAsset.getBankAccounts.useQuery(
  {},
  { enabled: !!snapshot },
);

// Create bank account mutation (mirrors NewSnapshotModal pattern)
const createAccountForEntryMutation = trpc.bankAsset.createBankAccount.useMutation({
  onSuccess: () => {
    utils.bankAsset.getBankAccounts.invalidate();
  },
  onError: (error) => {
    toast.error((error as any)?.message || 'Failed to create account');
  },
});

// Add entry to snapshot mutation
const addEntryToSnapshotMutation = trpc.bankAsset.addEntryToSnapshot.useMutation({
  onSuccess: () => {
    toast.success('Account added to snapshot!');
    setAddingEntryForBankId(null);
    setNewEntryAccountId('');
    setNewEntryBalance(0);
    setNewEntryError('');
    utils.bankAsset.getSnapshots.invalidate();
    utils.bankAsset.getMostRecentSnapshot.invalidate();
    utils.bankAsset.getSnapshotTotals.invalidate();
  },
  onError: (error: any) => {
    const msg: string = error?.message || 'Failed to add account to snapshot';
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('already')) {
      setNewEntryError('This account is already in the snapshot.');
    } else {
      toast.error(msg);
    }
  },
});
```

---

### 2.3 New Event Handlers

Add after `handleCancelEditAccountName`:

```typescript
const handleOpenAddEntry = (bankId: string) => {
  setAddingEntryForBankId(bankId);
  setNewEntryAccountId('');
  setNewEntryBalance(0);
  setNewEntryError('');
};

const handleCancelAddEntry = () => {
  setAddingEntryForBankId(null);
  setNewEntryAccountId('');
  setNewEntryBalance(0);
  setNewEntryError('');
};

const handleSaveAddEntry = () => {
  if (!snapshot || !addingEntryForBankId) return;

  if (!newEntryAccountId) {
    setNewEntryError('Please select or create an account.');
    return;
  }

  setNewEntryError('');
  addEntryToSnapshotMutation.mutate({
    snapshotId: snapshot.id,
    accountId: newEntryAccountId,
    balance: newEntryBalance,
  });
};

const handleCreateAccountForEntry = async (
  bankId: string,
  accountName: string,
): Promise<string> => {
  const result = await createAccountForEntryMutation.mutateAsync({
    name: accountName,
    bankId,
  });
  if (!result?.data?.account?.id) {
    throw new Error('Failed to create account');
  }
  return result.data.account.id;
};
```

---

### 2.4 Derived Value — Accounts Available for Add-Entry

Add inside the component (after existing `useMemo` blocks):

```typescript
// Accounts already recorded in the current snapshot
const accountsAlreadyInSnapshot = useMemo(
  () => new Set(snapshot?.balanceRecords.map((r) => r.accountId) ?? []),
  [snapshot],
);

// Per-bank option list: excludes accounts already in snapshot
const getAddableAccountsForBank = (bankId: string) =>
  allBankAccounts
    .filter((acc) => acc.bankId === bankId && !accountsAlreadyInSnapshot.has(acc.id))
    .map((acc) => ({ value: acc.id, label: acc.name }));
```

---

### 2.5 JSX — "Add Account" Button and Inline Form

**Location:** Inside the `Disclosure.Panel`, after the closing `</div>` of the `overflow-x-auto` wrapper and before `</Disclosure.Panel>`.

```tsx
{/* Add Entry Inline Form / Button */}
{addingEntryForBankId === bank.bankId ? (
  <div className='mt-3 p-3 border border-dashed border-border rounded-lg bg-muted/30'>
    <div className='flex flex-col gap-3 sm:flex-row sm:items-end'>
      {/* Account selector */}
      <div className='flex-1'>
        <label className='block text-xs font-medium text-muted-foreground mb-1'>
          Account
        </label>
        <AppCreatableSelect
          inputId={`add-entry-account-${bank.bankId}`}
          options={getAddableAccountsForBank(bank.bankId)}
          value={
            newEntryAccountId
              ? {
                  value: newEntryAccountId,
                  label:
                    allBankAccounts.find((a) => a.id === newEntryAccountId)?.name ??
                    newEntryAccountId,
                }
              : null
          }
          onChange={(option) => {
            setNewEntryAccountId(option?.value ?? '');
            setNewEntryError('');
          }}
          onCreateOption={(inputValue) => {
            handleCreateAccountForEntry(bank.bankId, inputValue)
              .then((newAccountId) => {
                setNewEntryAccountId(newAccountId);
                toast.success(`Account "${inputValue}" created!`);
              })
              .catch(() => {
                // Error already toasted in mutation handler
              });
          }}
          isClearable
          placeholder='Select or type to create...'
          isLoading={createAccountForEntryMutation.isPending}
        />
      </div>

      {/* Balance input */}
      <div className='w-40'>
        <label className='block text-xs font-medium text-muted-foreground mb-1'>
          Balance
        </label>
        <NumericFormat
          value={newEntryBalance}
          onValueChange={(values) => setNewEntryBalance(values.floatValue ?? 0)}
          thousandSeparator=','
          prefix='$'
          decimalScale={2}
          fixedDecimalScale
          className='w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring'
        />
      </div>

      {/* Action buttons */}
      <div className='flex gap-2'>
        <Button
          type='button'
          variant='default'
          onClick={handleSaveAddEntry}
          disabled={addEntryToSnapshotMutation.isPending}
        >
          <Check className='w-4 h-4 mr-1' />
          {addEntryToSnapshotMutation.isPending ? 'Adding...' : 'Add'}
        </Button>
        <Button
          type='button'
          variant='secondary'
          onClick={handleCancelAddEntry}
          disabled={addEntryToSnapshotMutation.isPending}
        >
          <X className='w-4 h-4 mr-1' />
          Cancel
        </Button>
      </div>
    </div>

    {/* Inline validation error */}
    {newEntryError && (
      <p className='mt-2 text-xs text-red-600'>{newEntryError}</p>
    )}
  </div>
) : (
  <div className='mt-3 flex justify-end'>
    <Button
      type='button'
      variant='secondary'
      onClick={() => handleOpenAddEntry(bank.bankId)}
    >
      <Plus className='w-4 h-4 mr-1' />
      Add Account
    </Button>
  </div>
)}
```

---

### 2.6 Required Import Additions to `BankAssetsClient.tsx`

```typescript
// lucide-react — Plus, Check, X are already imported; verify all present
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

// Add AppCreatableSelect (not currently imported in BankAssetsClient.tsx)
import { AppCreatableSelect } from '@/components/ui/AppCreatableSelect';
```

---

### 2.7 State and Mutation Inventory After Phase 2

| State variable | Type | Purpose |
|---------------|------|---------|
| `addingEntryForBankId` | `string \| null` | Which bank's add-entry form is open (`null` = none) |
| `newEntryAccountId` | `string` | Selected account ID in the inline form |
| `newEntryBalance` | `number` | Balance entered in the inline form (default `0`) |
| `newEntryError` | `string` | Inline validation/server error message (`''` = no error) |

| Mutation | When used |
|----------|-----------|
| `createAccountForEntryMutation` | `onCreateOption` in `AppCreatableSelect`; creates `BankAccount` then populates `newEntryAccountId` |
| `addEntryToSnapshotMutation` | `handleSaveAddEntry`; creates `BankBalanceRecord` |

| Query | When used |
|-------|-----------|
| `allBankAccounts` (`trpc.bankAsset.getBankAccounts.useQuery({})`) | Provides full account list for per-bank option filtering; enabled only when a snapshot is loaded |

---

### Phase 2 Test Cases

| Test | Type | What it verifies |
|------|------|-----------------|
| "+ Add Account" button renders inside an expanded Disclosure.Panel | Component / visual | Button present per bank |
| Clicking "+ Add Account" for bank A does not open form for bank B | Component | `addingEntryForBankId` scoping |
| Account dropdown excludes accounts already in the snapshot | Component | `accountsAlreadyInSnapshot` Set filter |
| "Cancel" closes the form and resets all `newEntry*` state | Component | `handleCancelAddEntry` |
| Successful mutation closes form, resets state, shows `toast.success` | Component | `onSuccess` callback |
| Server P2002 error → inline error message, NOT toast | Component | `onError` heuristic check |
| Other server error → `toast.error`, form stays open | Component | `onError` fallback |
| `newEntryAccountId` empty on save → inline error "Please select or create an account." | Component | Client-side guard in `handleSaveAddEntry` |
| `AppCreatableSelect` `isLoading` during account creation | Component | `createAccountForEntryMutation.isPending` |

---

## Error Handling Summary

| Scenario | Where caught | User feedback |
|----------|-------------|---------------|
| Snapshot not found / not owned by user | Service → `handleCaughtError` → `onError` | `toast.error` |
| Account not found / not owned by user | Service → `handleCaughtError` → `onError` | `toast.error` |
| Duplicate entry (P2002 unique constraint) | Prisma → `handleCaughtError` → `onError` heuristic | Inline `newEntryError` below form |
| Account creation failure | `createAccountForEntryMutation.onError` | `toast.error` (account not set) |
| No account selected on save (client guard) | `handleSaveAddEntry` | Inline `newEntryError` |
| Balance < 0 | Zod schema `.min(0, ...)` → server validation | `toast.error` |

---

## Query Invalidation Strategy

After `addEntryToSnapshotMutation.onSuccess`:

```typescript
utils.bankAsset.getSnapshots.invalidate();
// Re-fetches full snapshot list — updates the accordion table rows with new entry.

utils.bankAsset.getMostRecentSnapshot.invalidate();
// Keeps the "most recent" cache in sync for other pages.

utils.bankAsset.getSnapshotTotals.invalidate();
// Re-calculates bankTotals and grandTotal — updates bank accordion header + Total Cash Position card.
```

`utils.bankAsset.getBankAccounts.invalidate()` is called inside `createAccountForEntryMutation.onSuccess` so the newly created account appears in the select immediately, before the entry is saved.
