# Snapshot All Banks Display — Low Level Design

---

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| Phase 1 | `src/app/(authorized)/assets/bank/BankAssetsClient.tsx` | Add `totalsMap` derived data + switch accordion iteration to `banks` list with empty-state rendering |

---

## Phase 1 — Show All Configured Banks in Accordion

### 1.1 New Derived Data: `totalsMap`

Add the following `useMemo` in `BankAssetsClient`, alongside the existing `accountsAlreadyInSnapshot` memo:

```typescript
// Map bankId → BankTotalSummary for O(1) lookup during render
const totalsMap = useMemo(
  () =>
    new Map(
      (totals as SnapshotTotals | undefined)?.banks.map((b) => [b.bankId, b]) ?? [],
    ),
  [totals],
);
```

### 1.2 Updated Render Condition

**Current condition** (line ~650):
```typescript
) : totals ? (
  <div className='space-y-4'>
    {(totals as SnapshotTotals).banks.map((bank: BankTotalSummary) => (
```

**Replace with** (iterate over `banks` list when snapshot is selected):
```typescript
) : snapshot ? (
  <div className='space-y-4'>
    {banks.map((bank) => {
      const bankTotals = totalsMap.get(bank.id);
      // ...render per-bank accordion (see 1.3)
    })}
  </div>
```

> **Note:** The condition changes from `totals ?` to `snapshot ?`. This ensures all configured banks render as soon as a snapshot is selected, even before totals resolve.

### 1.3 Per-Bank Accordion Rendering

Each bank renders a `Disclosure`. The interior changes based on whether `bankTotals` exists:

```typescript
banks.map((bank) => {
  const bankTotals = totalsMap.get(bank.id);

  return (
    <Disclosure key={bank.id}>
      {({ open }) => (
        <div className='border border-border rounded-lg overflow-hidden'>
          {/* Disclosure Button — always same structure */}
          <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted/50 hover:bg-muted transition-colors'>
            <div className='flex items-center gap-4'>
              <ChevronDown className={clsx('w-5 h-5 text-muted-foreground transition-transform', open ? 'transform rotate-180' : '')} />
              <span className='text-lg font-semibold text-foreground'>{bank.name}</span>
            </div>
            <div className='text-lg font-bold text-foreground'>
              {bankTotals ? (
                <NumericFormat
                  value={Number(bankTotals.total)}
                  displayType='text'
                  thousandSeparator=','
                  prefix='$'
                  decimalScale={2}
                  fixedDecimalScale
                />
              ) : (
                <span className='text-sm font-normal text-muted-foreground'>Not tracked</span>
              )}
            </div>
          </Disclosure.Button>

          {/* Disclosure Panel */}
          <Disclosure.Panel className='px-6 py-4 bg-card'>
            {bankTotals ? (
              // EXISTING: account rows table (no change to inner rendering)
              <AccountRowsTable
                bank={bankTotals}
                snapshot={snapshot}
                editingEntry={editingEntry}
                addingEntryForBankId={addingEntryForBankId}
                ...
              />
            ) : (
              // NEW: empty state
              <EmptyBankState
                bank={bank}
                hasAccounts={allBankAccounts.some((a) => a.bankId === bank.id)}
                onAddAccount={() => handleOpenAddEntry(bank.id)}
              />
            )}

            {/* Add Entry form — shown for both states when addingEntryForBankId matches */}
            {addingEntryForBankId === bank.id && (
              <AddEntryForm bankId={bank.id} ... />
            )}
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
})
```

> **Implementation note:** The actual code keeps the inline JSX (no separate components) to match the existing pattern in the file. The structure above shows the logical separation.

### 1.4 Empty State Rendering (inline JSX)

When `!bankTotals`, render inside `Disclosure.Panel`:

```typescript
{!bankTotals && addingEntryForBankId !== bank.id && (
  <div className='py-6 flex flex-col items-center gap-3 text-center'>
    {allBankAccounts.some((a) => a.bankId === bank.id) ? (
      <>
        <p className='text-sm text-muted-foreground'>
          No accounts tracked in this snapshot.
        </p>
        <Button
          type='button'
          variant='secondary'
          onClick={() => handleOpenAddEntry(bank.id)}
        >
          <Plus className='w-4 h-4 mr-1' />
          Add Account
        </Button>
      </>
    ) : (
      <p className='text-sm text-muted-foreground'>
        No accounts configured for this bank.{' '}
        <a href='/settings/banks' className='underline text-primary hover:text-primary/80'>
          Add in Settings
        </a>
      </p>
    )}
  </div>
)}
```

### 1.5 Grand Total Card Guard

The Grand Total card currently shows when `totals` exists. Keep this unchanged — it only shows when there are actual balances in the snapshot.

```typescript
{totals && (
  <div className='bg-primary/10 ...'>
    {/* Total Cash Position */}
  </div>
)}
```

### 1.6 Bottom Buttons Guard

The "New Snapshot" / "AI Import" buttons currently show when `totals?.banks.length > 0`. Update to also show when a snapshot is selected (even if all banks are empty):

**Current:**
```typescript
{totals && (totals as SnapshotTotals).banks.length > 0 && (
```

**Updated:**
```typescript
{snapshot && (
```

---

## Test Cases

### Phase 1

| Test Description | Test Type | What it Verifies |
|---|---|---|
| All configured banks appear when snapshot selected | Manual / E2E | `banks` count in DOM equals `getBusinessesByType(BANK)` count |
| Bank with entries renders account rows and total | Manual / E2E | Existing accounts still display correctly |
| Bank without entries renders "No accounts tracked" + Add Account button | Manual / E2E | Empty-state renders for banks not in snapshot |
| Bank with zero configured BankAccounts renders settings link | Manual / E2E | Edge case: bank configured but no accounts created |
| Clicking Add Account on empty-state bank opens inline add form | Manual / E2E | `handleOpenAddEntry` triggers for previously-empty bank |
| Adding account to empty-state bank updates its total and removes empty state | Manual / E2E | `addEntryToSnapshot` + cache invalidation works end-to-end |
| Switching snapshots correctly reflects per-snapshot state of each bank | Manual | Snapshot A has ANZ, Snapshot B doesn't — empty state correct per selection |
| Build passes with no TypeScript errors | CI / `pnpm run build` | No type regressions |

---

## Integration Points

| Point | Detail |
|---|---|
| `trpc.business.getBusinessesByType({ type: 'BANK' })` | Already called — returns `Business[]` with `id`, `name` |
| `trpc.bankAsset.getBankAccounts({})` | Already called when `!!snapshot` — returns `BankAccountWithBank[]` |
| `trpc.bankAsset.addEntryToSnapshot` | Already wired — triggered by existing `handleSaveAddEntry` |
| `utils.bankAsset.getSnapshots.invalidate()` | Already called on add-entry success — refreshes snapshot data |
| `utils.bankAsset.getSnapshotTotals.invalidate()` | Already called on add-entry success — refreshes totals (new bank appears in `totalsMap`) |

---

## Edge Cases

| Case | Handling |
|---|---|
| No snapshot selected | `snapshot` is null → existing "No snapshots recorded" empty state shows; bank accordions not rendered |
| `banks` is empty | Existing "You need to add banks first" empty state covers this |
| `totals` still loading | Banks list renders (with empty states); totals update when resolved via React Query |
| All banks already in snapshot | All accordions render with accounts — identical to current behaviour |
| User adds account to a bank, then switches snapshot | `accountsAlreadyInSnapshot` recalculates from new snapshot's `balanceRecords` |
