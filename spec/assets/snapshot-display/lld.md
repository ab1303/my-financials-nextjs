# Snapshot All Banks Display — Low Level Design

## Overview

Render all user-configured banks in the Bank Assets accordion, not just those with snapshot entries. Banks without entries show an empty-state row with "Add Account" CTA.

---

## Implementation Details

### Phase 1: Frontend Component Update

**File to modify:** `src/app/(authorized)/assets/bank/BankAssetsClient.tsx`

#### 1.1 Add `totalsMap` Derived Data

Create a memoized lookup map for O(1) access to bank totals:

```typescript
// Map bankId → BankTotalSummary for fast lookup during render
const totalsMap = useMemo(
  () =>
    new Map(
      (totals as SnapshotTotals | undefined)?.banks.map((b) => [b.bankId, b]) ?? [],
    ),
  [totals],
);
```

#### 1.2 Change Render Condition

**Current:**
```typescript
) : totals ? (
  <div className='space-y-4'>
    {(totals as SnapshotTotals).banks.map((bank: BankTotalSummary) => (
```

**New (iterate over `banks` list):**
```typescript
) : snapshot ? (
  <div className='space-y-4'>
    {banks.map((bank) => {
      const bankTotals = totalsMap.get(bank.id);
      // ...render per-bank (see 1.3)
    })}
  </div>
```

Change trigger from `totals ?` to `snapshot ?` so all banks render immediately when snapshot is selected, even before totals resolve.

#### 1.3 Per-Bank Rendering Logic

```typescript
banks.map((bank) => {
  const bankTotals = totalsMap.get(bank.id);

  return (
    <Disclosure key={bank.id} as='div' className='space-y-2' defaultOpen>
      {({ open }) => (
        <>
          <Disclosure.Button className={clsx(
            'flex w-full items-center justify-between rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2',
            !bankTotals && 'opacity-60', // Muted if no entries
          )}>
            <span className={clsx('font-semibold', !bankTotals && 'text-slate-600 dark:text-slate-400')}>
              {bank.name}
            </span>
            {bankTotals ? (
              <span className='text-sm font-medium'>${bankTotals.total.toFixed(2)}</span>
            ) : (
              <span className='text-xs text-slate-500'>No accounts tracked</span>
            )}
            {/* ChevronIcon */}
          </Disclosure.Button>

          <Disclosure.Panel className='pl-4 space-y-2'>
            {bankTotals ? (
              <>
                {/* Render existing account rows from bankTotals.accounts */}
                {bankTotals.accounts?.map((account) => (
                  <div key={account.id} className='flex justify-between py-1'>
                    <span>{account.name}</span>
                    <span>${account.balance.toFixed(2)}</span>
                  </div>
                ))}
              </>
            ) : (
              /* Empty state: no accounts in this snapshot */
              <div className='rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3'>
                <p className='text-sm text-slate-600 dark:text-slate-400 mb-2'>
                  No accounts tracked in this snapshot
                </p>
                <button
                  onClick={() => handleOpenAddEntry(bank.id)}
                  className='text-sm text-blue-600 dark:text-blue-400 hover:underline'
                >
                  Add Account
                </button>
              </div>
            )}

            {/* Existing inline add-entry form (reused state) */}
            {addingEntryForBankId === bank.id && (
              <AppCreatableSelect
                // ... existing form state and handlers ...
              />
            )}
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
})
```

---

## Data Requirements

All required data is already fetched in BankAssetsClient:

| Variable | Source | Contains |
|---|---|---|
| `banks` | `trpc.business.getBusinessesByType({ type: 'BANK' })` | All user's configured banks |
| `allBankAccounts` | `trpc.bankAsset.getBankAccounts({})` | All user's BankAccount records |
| `snapshot` | Derived from `allSnapshots` | Current snapshot with balanceRecords |
| `totals` | `trpc.bankAsset.getSnapshotTotals({ snapshotId })` | Banks with entries only |
| `accountsAlreadyInSnapshot` | `useMemo` over snapshot.balanceRecords | Set of accountIds in snapshot |

---

## Key Constraints

- `totals` may be undefined if no snapshot is selected → guard with `!!snapshot`
- `allBankAccounts` is only fetched when `!!snapshot` → ensure available before rendering add-entry UI
- Existing `addingEntryForBankId` state handles inline add form → no new state needed
- `getAddableAccountsForBank(bankId)` helper already filters and excludes accounts already in snapshot
- Banks with zero configured accounts still show with "No accounts configured" message

---

## Success Criteria

1. ✅ All user-configured banks appear in accordion when snapshot is selected
2. ✅ Banks without snapshot entries show empty-state row with "Add Account" CTA
3. ✅ Clicking "Add Account" opens inline add-entry form
4. ✅ After adding account, bank section refreshes with new entry and updated total
5. ✅ Banks with entries render exactly as before (no regression)
6. ✅ No TypeScript errors in build

---

## File Inventory

| File | Action | Description |
|---|---|---|
| `src/app/(authorized)/assets/bank/BankAssetsClient.tsx` | MODIFY | Add `totalsMap` memo, change iteration source from `totals.banks` to `banks`, add empty-state rendering per bank |
| `src/types/bank-asset.types.ts` | READ | Reference `BankTotalSummary`, `SnapshotTotals` types |
| `src/server/trpc/router/bank-asset.ts` | READ | Reference `addEntryToSnapshot`, `getBankAccounts` procedures |
