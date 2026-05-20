# Stock Market Segregation — Low Level Design

## Overview

Add a grouping toggle to `StockAssetsClient.tsx` that switches the holdings accordion
between two hierarchical views: **Currency → Brokerage** and **Brokerage → Currency**.
All data is already available from `totals.currencies`; this is a pure UI change.

---

## Data Shape (existing — no changes required)

`trpc.stockAsset.getSnapshotTotals` already returns:

```typescript
{
  snapshotId: string;
  snapshotDate: Date;
  currencies: Array<{          // ← outer group for Currency view
    currency: string;          // 'AUD' | 'USD'
    totalValue: number;
    totalCostBasis: number;
    totalUnrealizedPL: number;
    totalRealizedPL: number;
    accounts: Array<{          // ← outer group for Brokerage view
      accountId: string;
      accountName: string;     // "Moomoo — Universal"
      currency: string;
      totalValue: number;
      totalUnrealizedPL: number;
      totalRealizedPL: number;
      holdings: Array<{ ... }>;
    }>;
  }>;
}
```

For the **Brokerage view**, a derived map must be built from this structure
(see Section 2.2).

---

## Implementation

### 1. Toggle State

**File:** `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx`

```typescript
type GroupByMode = 'currency' | 'brokerage';

const [groupBy, setGroupBy] = useState<GroupByMode>(() => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('stockGroupBy') as GroupByMode) ?? 'currency';
  }
  return 'currency';
});

const handleGroupByChange = (mode: GroupByMode) => {
  setGroupBy(mode);
  localStorage.setItem('stockGroupBy', mode);
};
```

### 2. Toggle UI

Place the segmented control in the "Stock Holdings" section header bar, right-aligned
alongside the existing New Snapshot / Delete buttons:

```tsx
{/* Grouping toggle */}
<div className='flex rounded-md border border-border overflow-hidden text-sm'>
  <button
    onClick={() => handleGroupByChange('currency')}
    className={clsx(
      'px-3 py-1.5 font-medium transition-colors',
      groupBy === 'currency'
        ? 'bg-primary text-primary-foreground'
        : 'bg-card text-muted-foreground hover:bg-muted',
    )}
  >
    By Currency
  </button>
  <button
    onClick={() => handleGroupByChange('brokerage')}
    className={clsx(
      'px-3 py-1.5 font-medium transition-colors border-l border-border',
      groupBy === 'brokerage'
        ? 'bg-primary text-primary-foreground'
        : 'bg-card text-muted-foreground hover:bg-muted',
    )}
  >
    By Brokerage
  </button>
</div>
```

### 3. Currency View (default)

Replace the current `accounts.map(...)` block with iteration over
`totals.currencies`:

```tsx
{groupBy === 'currency' && totals?.currencies.map((currencyGroup) => {
  const flag = currencyGroup.currency === 'AUD' ? '🇦🇺' : '🇺🇸';
  const currencyPL = currencyGroup.totalUnrealizedPL + currencyGroup.totalRealizedPL;

  return (
    <div key={currencyGroup.currency} className='space-y-3'>
      {/* Currency section header */}
      <div className='flex items-center justify-between px-2 py-1 border-b border-border'>
        <h3 className='text-base font-semibold text-foreground'>
          {flag} {currencyGroup.currency} Holdings
        </h3>
        <span className={clsx('text-sm font-semibold', getPLColorClass(currencyPL))}>
          {formatCurrency(currencyGroup.totalValue, currencyGroup.currency as CurrencyEnumType)}
        </span>
      </div>

      {/* Brokerage account accordions within this currency */}
      {currencyGroup.accounts.map((account) => (
        <Disclosure key={`${currencyGroup.currency}-${account.accountId}`} defaultOpen>
          {({ open }) => (
            <div className='border border-border rounded-lg overflow-hidden'>
              <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-4'>
                  <ChevronDown className={clsx('w-5 h-5 text-muted-foreground transition-transform', open && 'rotate-180')} />
                  <span className='text-base font-semibold text-foreground'>
                    {account.accountName}
                  </span>
                </div>
                <span className='text-sm text-muted-foreground'>
                  {formatCurrency(account.totalValue, account.currency as CurrencyEnumType)}
                </span>
              </Disclosure.Button>
              <Disclosure.Panel className='px-6 py-4 bg-card'>
                <HoldingsTable
                  holdings={account.holdings}
                  snapshotDate={snapshotDate}
                  onEdit={...}
                  onDelete={...}
                />
              </Disclosure.Panel>
            </div>
          )}
        </Disclosure>
      ))}
    </div>
  );
})}
```

### 4. Brokerage View

Build a derived map from `totals.currencies` to invert the hierarchy:

```typescript
const brokerageGroups = useMemo(() => {
  if (!totals?.currencies) return [];

  const map = new Map<string, {
    accountId: string;
    accountName: string;
    currencies: typeof totals.currencies[0]['accounts'][0][];
  }>();

  for (const currencyGroup of totals.currencies) {
    for (const account of currencyGroup.accounts) {
      if (!map.has(account.accountId)) {
        map.set(account.accountId, {
          accountId: account.accountId,
          accountName: account.accountName,
          currencies: [],
        });
      }
      map.get(account.accountId)!.currencies.push(account);
    }
  }

  return Array.from(map.values());
}, [totals]);
```

Render:

```tsx
{groupBy === 'brokerage' && brokerageGroups.map((brokerageGroup) => (
  <Disclosure key={brokerageGroup.accountId} defaultOpen>
    {({ open }) => (
      <div className='border border-border rounded-lg overflow-hidden'>
        <Disclosure.Button className='flex justify-between items-center w-full px-6 py-4 bg-muted hover:bg-muted/50 transition-colors'>
          <div className='flex items-center gap-4'>
            <ChevronDown className={clsx('w-5 h-5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            <span className='text-base font-semibold text-foreground'>
              {brokerageGroup.accountName}
            </span>
          </div>
        </Disclosure.Button>

        <Disclosure.Panel className='px-6 py-4 bg-card space-y-4'>
          {brokerageGroup.currencies.map((currencyAccount) => {
            const flag = currencyAccount.currency === 'AUD' ? '🇦🇺' : '🇺🇸';
            return (
              <div key={currencyAccount.currency}>
                {/* Currency sub-header */}
                <div className='flex items-center justify-between mb-2 pb-1 border-b border-border'>
                  <span className='text-sm font-semibold text-muted-foreground'>
                    {flag} {currencyAccount.currency}
                  </span>
                  <span className='text-sm font-medium text-foreground'>
                    {formatCurrency(currencyAccount.totalValue, currencyAccount.currency as CurrencyEnumType)}
                  </span>
                </div>
                <HoldingsTable
                  holdings={currencyAccount.holdings}
                  snapshotDate={snapshotDate}
                  onEdit={...}
                  onDelete={...}
                />
              </div>
            );
          })}
        </Disclosure.Panel>
      </div>
    )}
  </Disclosure>
))}
```

### 5. Extract HoldingsTable Component

The holdings `<table>` JSX is currently inlined in `StockAssetsClient.tsx`.
Extract it to a co-located component to avoid duplication across both views.

**New file:** `src/app/(authorized)/assets/stocks/HoldingsTable.tsx`

```typescript
interface HoldingsTableProps {
  holdings: HoldingRow[];          // shape from totals.currencies[].accounts[].holdings
  snapshotDate: Date;
  onEdit: (holding: StockHoldingWithAccount) => void;
  onDelete: (holdingId: string, ticker: string, snapshotId: string) => void;
}
```

The table renders: Stock, Qty, Buy Price, Buy Date, Curr Price, Value, P/L, P/L %, Holding, Term, CGT, Actions — identical to current inline implementation.

> **Note:** `holdings` from `totals.currencies` is a simplified shape (no full
> `StockHoldingWithAccount`). The raw snapshot holdings (from the `snapshots` query)
> must be joined by `holdingId` to support Edit/Delete actions that require the full
> holding object. Use a `holdingsById` lookup map derived from `snapshots`.

```typescript
const holdingsById = useMemo(() => {
  const map = new Map<string, StockHoldingWithAccount>();
  snapshots
    ?.find((s) => s.id === selectedSnapshotId)
    ?.holdings.forEach((h) => map.set(h.id, h));
  return map;
}, [snapshots, selectedSnapshotId]);
```

---

## Subtotal Row

At the bottom of each currency section (Currency view) or currency sub-section
(Brokerage view), render a summary row:

```tsx
<tr className='bg-muted font-semibold'>
  <td colSpan={5} className='px-6 py-2 text-sm text-right text-muted-foreground'>
    Subtotal ({currencyAccount.currency})
  </td>
  <td className='px-6 py-2 text-sm text-right'>
    {formatCurrency(currencyAccount.totalValue, currency)}
  </td>
  <td className={clsx('px-6 py-2 text-sm text-right', getPLColorClass(currencyAccount.totalUnrealizedPL))}>
    {formatCurrency(currencyAccount.totalUnrealizedPL, currency)}
  </td>
  <td colSpan={5} />
</tr>
```

---

## Acceptance Criteria

1. ✅ Toggle "By Currency" / "By Brokerage" appears in the Stock Holdings header
2. ✅ Currency view: AUD holdings and USD holdings in separate labeled sections
3. ✅ Brokerage view: each broker accordion contains AUD and USD sub-sections
4. ✅ Toggle selection persists across page refresh via `localStorage`
5. ✅ Edit and Delete actions work identically in both views
6. ✅ Subtotal row appears per currency section/sub-section
7. ✅ No additional tRPC calls triggered by toggling
8. ✅ No TypeScript errors in build

---

## File Inventory

| File | Action | Description |
|---|---|---|
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | MODIFY | Add `groupBy` toggle state, `brokerageGroups` memo, `holdingsById` map, replace account accordion with conditional currency/brokerage render |
| `src/app/(authorized)/assets/stocks/HoldingsTable.tsx` | CREATE | Extract holdings `<table>` into reusable component; accepts `holdings`, `snapshotDate`, `onEdit`, `onDelete` props |
