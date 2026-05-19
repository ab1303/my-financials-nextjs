# Add Holding Improvements: Low-Level Design

## Document Info

- **Version**: 1.0
- **Date**: 2026-05-19
- **Status**: Ready for implementation

---

## Phase 1: Account Pre-selection in HoldingFormModal

### 1.1 HoldingFormModal.tsx — Add `defaultAccountId` Prop

**File**: `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx`

**Change 1**: Add `defaultAccountId` to Props interface.

```typescript
// BEFORE
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  brokerageAccounts: Array<{
    id: string;
    name: string;
  }>;
  snapshotId?: string;
  editingHolding?: StockHoldingWithAccount | null;
}

// AFTER
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  brokerageAccounts: Array<{
    id: string;
    name: string;
  }>;
  snapshotId?: string;
  editingHolding?: StockHoldingWithAccount | null;
  defaultAccountId?: string;  // ← NEW: pre-select account in create mode
}
```

**Change 2**: Update function signature to destructure new prop.

```typescript
// BEFORE
export default function HoldingFormModal({
  isOpen,
  onClose,
  onSuccess,
  brokerageAccounts,
  snapshotId,
  editingHolding,
}: Props) {

// AFTER
export default function HoldingFormModal({
  isOpen,
  onClose,
  onSuccess,
  brokerageAccounts,
  snapshotId,
  editingHolding,
  defaultAccountId,   // ← NEW
}: Props) {
```

**Change 3**: Use `defaultAccountId` in create-mode defaultValues.

```typescript
// BEFORE (in useForm defaultValues, create branch)
accountId: brokerageAccounts?.[0]?.id || '',

// AFTER
accountId: defaultAccountId || brokerageAccounts?.[0]?.id || '',
```

> Note: This is in the `else` branch (create mode) of the `defaultValues` ternary.
> Edit mode uses `editingHolding.accountId` — unaffected.

---

### 1.2 StockAssetsClient.tsx — Track `addingToAccountId`

**File**: `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx`

**Change 1**: Add `addingToAccountId` state (alongside existing holding modal state).

```typescript
// Add after existing modal state declarations (~line 56)
const [addingToAccountId, setAddingToAccountId] = useState<string | null>(null);
```

**Change 2**: Set `addingToAccountId` when "Add Holding" button clicked inside an account accordion.

```typescript
// BEFORE
<Button
  variant='secondary'
  onClick={() => {
    setEditingHolding(null);
    setIsHoldingFormModalOpen(true);
  }}
>
  <Plus className='mr-2 w-4 h-4' />
  Add Holding
</Button>

// AFTER
<Button
  variant='secondary'
  onClick={() => {
    setEditingHolding(null);
    setAddingToAccountId(account.id);   // ← NEW: capture account context
    setIsHoldingFormModalOpen(true);
  }}
>
  <Plus className='mr-2 w-4 h-4' />
  Add Holding
</Button>
```

> Note: `account` is the loop variable from the account accordions rendering. Verify exact variable name in file — may be `accountGroup`, `acct`, or similar. Match whatever is used in the existing loop.

**Change 3**: Pass `defaultAccountId` to `HoldingFormModal` and clear on close.

```typescript
// BEFORE
<HoldingFormModal
  isOpen={isHoldingFormModalOpen}
  onClose={() => {
    setIsHoldingFormModalOpen(false);
    setEditingHolding(null);
  }}
  onSuccess={() => {
    setIsHoldingFormModalOpen(false);
    setEditingHolding(null);
  }}
  brokerageAccounts={brokerageAccounts || []}
  snapshotId={selectedSnapshotId || undefined}
  editingHolding={editingHolding}
/>

// AFTER
<HoldingFormModal
  isOpen={isHoldingFormModalOpen}
  onClose={() => {
    setIsHoldingFormModalOpen(false);
    setEditingHolding(null);
    setAddingToAccountId(null);   // ← NEW
  }}
  onSuccess={() => {
    setIsHoldingFormModalOpen(false);
    setEditingHolding(null);
    setAddingToAccountId(null);   // ← NEW
  }}
  brokerageAccounts={brokerageAccounts || []}
  snapshotId={selectedSnapshotId || undefined}
  editingHolding={editingHolding}
  defaultAccountId={addingToAccountId || undefined}   // ← NEW
/>
```

---

## Phase 2: Prefill from Previous Snapshot in NewSnapshotModal

### 2.1 NewSnapshotModal.tsx — Full Changes

**File**: `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx`

**Change 1**: Import `trpc` (already imported — verify). Add `useEffect` import if not already present.

```typescript
// Ensure these imports exist at top of file
import { useState, useEffect } from 'react';
```

**Change 2**: Add `getMostRecentSnapshot` query inside the component.

```typescript
// Add after useForm setup, before createSnapshot mutation
const { data: latestSnapshot, isLoading: isLoadingPrefill } =
  trpc.stockAsset.getMostRecentSnapshot.useQuery(
    {},
    { enabled: isOpen },
  );
```

> Using `enabled: isOpen` ensures the query only fires when the modal is visible and is cached thereafter.

**Change 3**: Add a `handlePrefill` function.

```typescript
const handlePrefill = () => {
  if (!latestSnapshot?.holdings?.length) return;

  const prefillHoldings = latestSnapshot.holdings.map((h) => ({
    snapshotId: '',              // will be set by createSnapshot server-side
    ticker: h.ticker,
    companyName: h.companyName,
    quantity: Number(h.quantity),
    buyPrice: Number(h.buyPrice),
    buyDate: h.buyDate,
    currentPrice: 0,             // user must update — price changes per snapshot
    currency: h.currency,
    plannedTerm: h.plannedTerm,
    accountId: h.accountId,
    salePrice: null,             // sales are historical — do not carry over
    saleDate: null,
    soldQuantity: null,
  }));

  reset({
    snapshotDate: new Date(),
    holdings: prefillHoldings,
  });
};
```

> `reset()` replaces the entire form state atomically — this is the correct react-hook-form approach for replacing a field array.

**Change 4**: Add the "Prefill from previous" button in the JSX. Place it in the "Stock Holdings" header row, right-aligned.

```tsx
{/* BEFORE */}
<h3 className='text-lg font-semibold text-foreground mb-4'>
  Stock Holdings
</h3>

{/* AFTER */}
<div className='flex justify-between items-center mb-4'>
  <h3 className='text-lg font-semibold text-foreground'>
    Stock Holdings
  </h3>
  {latestSnapshot && (
    <Button
      type='button'
      variant='secondary'
      onClick={handlePrefill}
      disabled={isLoadingPrefill}
    >
      {isLoadingPrefill ? 'Loading...' : '↩ Prefill from previous'}
    </Button>
  )}
</div>
```

> - Button is only rendered when `latestSnapshot` is truthy (no prior snapshot → button hidden).
> - `type='button'` prevents accidental form submission.
> - `disabled={isLoadingPrefill}` prevents double-click during fetch.

**Change 5**: Ensure `reset()` is also called in `handleClose` (already exists — verify it resets to blank defaults, not prefill data).

```typescript
// Existing handleClose — verify this stays as-is:
const handleClose = () => {
  reset();  // resets to defaultValues (single blank row)
  onClose();
};
```

> `reset()` with no args resets to the `defaultValues` passed to `useForm`. This is correct — closing the modal should return to a blank state.

---

## Summary of All File Changes

| File | Phase | Lines Changed (est.) |
|------|-------|----------------------|
| `HoldingFormModal.tsx` | 1 | ~8 (prop interface + destructure + defaultValues) |
| `StockAssetsClient.tsx` | 1 | ~10 (state + onClick + modal props) |
| `NewSnapshotModal.tsx` | 2 | ~40 (query + handler + JSX button) |

---

## Validation Checklist

### Phase 1 (Account Pre-selection)
- [ ] `HoldingFormModal` Props type updated with `defaultAccountId?: string`
- [ ] Destructured in function signature
- [ ] `defaultAccountId` used in create-mode defaultValues only (not edit mode)
- [ ] `StockAssetsClient` has `addingToAccountId` state
- [ ] "Add Holding" button sets `addingToAccountId` with the correct account id variable
- [ ] `HoldingFormModal` receives `defaultAccountId={addingToAccountId || undefined}`
- [ ] `setAddingToAccountId(null)` called in both `onClose` and `onSuccess`

### Phase 2 (Prefill)
- [ ] `getMostRecentSnapshot` query fires only when `isOpen=true`
- [ ] `handlePrefill` maps all fields correctly (currentPrice=0, sale fields null)
- [ ] Prefill button hidden when `latestSnapshot` is null/undefined
- [ ] Prefill button disabled while loading
- [ ] `type='button'` on prefill button (prevent form submit)
- [ ] `reset({ snapshotDate: new Date(), holdings: prefillHoldings })` replaces field array
- [ ] `handleClose` still resets to blank defaults (no regressions)
- [ ] `pnpm run build` passes with zero TypeScript errors
