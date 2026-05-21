# Overview USD Conversion — LLD

## Files to Modify

| File | Change |
|---|---|
| `src/server/services/asset-dashboard.service.ts` | Include all currency holdings; convert USD→AUD using snapshot rate |
| `src/app/(authorized)/assets/_components/AssetSummaryCards.tsx` | Update label; add USD-included badge |

---

## Phase 1 — asset-dashboard.service.ts

### Current problematic query (lines 69–83)

```typescript
prisma.portfolioSnapshot.findMany({
  where: { userId },
  orderBy: { snapshotDate: 'asc' },
  include: {
    holdings: {
      where: {
        currency: CurrencyEnumType.AUD,   // ← EXCLUDE THIS FILTER
      },
      select: {
        quantity: true,
        currentPrice: true,
      },
    },
  },
}),
```

### Fix

Remove the `where` filter; add `currency` and snapshot-level `usdToAudRate` to select:

```typescript
prisma.portfolioSnapshot.findMany({
  where: { userId },
  orderBy: { snapshotDate: 'asc' },
  select: {
    id: true,
    snapshotDate: true,
    usdToAudRate: true,           // ← ADD
    holdings: {
      select: {
        quantity: true,
        currentPrice: true,
        currency: true,            // ← ADD
      },
    },
  },
}),
```

### Updated stockSnapshotsWithTotals computation

```typescript
const stockSnapshotsWithTotals = stockSnapshots.map((snapshot) => {
  const usdToAudRate = snapshot.usdToAudRate
    ? Number(snapshot.usdToAudRate)
    : null;

  const stockTotal = snapshot.holdings.reduce((sum, holding) => {
    const value = Number(holding.quantity) * Number(holding.currentPrice);
    if (holding.currency === 'AUD') return sum + value;
    if (holding.currency === 'USD' && usdToAudRate) return sum + value * usdToAudRate;
    return sum; // USD with no rate: skip (graceful degradation)
  }, 0);

  return {
    id: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    stockTotal,
  };
});
```

> Note: The `CurrencyEnumType` import from `@prisma/client` can be removed if no longer used elsewhere in this file (check before removing).

---

## Phase 2 — AssetSummaryCards.tsx

### Label update

Change the stock card label from `"Stocks (AUD only)"` to `"Stocks (AUD equiv.)"`:

```tsx
// Before:
<p className='text-sm font-medium text-gray-600 dark:text-gray-300'>
  Stocks (AUD only)
</p>

// After:
<p className='text-sm font-medium text-gray-600 dark:text-gray-300'>
  Stocks (AUD equiv.)
</p>
```

No other changes needed to this component — it already receives `latestStockTotal`
as a number and formats it as AUD currency.

---

## Acceptance Criteria

1. ✅ USD holdings are included in `stockTotal` when `usdToAudRate` is present on snapshot
2. ✅ USD holdings are **skipped** (not errored) when `usdToAudRate` is null (old snapshots)
3. ✅ AUD holdings are always included regardless of rate
4. ✅ "Stocks (AUD only)" label becomes "Stocks (AUD equiv.)"
5. ✅ Net Worth Trend chart data points reflect the updated totals
6. ✅ No TypeScript errors
