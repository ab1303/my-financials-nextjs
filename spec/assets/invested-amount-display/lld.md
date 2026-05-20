# Invested Amount Display — Low Level Design

## Overview

Two files only. No tRPC, no schema changes. `totalCostBasis` already flows from
the service through to the component props — it just needs to be rendered.

---

## File 1: `src/app/(authorized)/assets/stocks/SummaryCards.tsx`

Add an "Invested Amount" row between "Portfolio Value" and the P/L breakdown.

### Current structure (simplified)
```
Portfolio Value   ← totalValue (market)
───────────────
Unrealized P/L
Realized P/L
Total P/L
```

### New structure
```
Portfolio Value   ← totalValue (market)
Invested Amount   ← totalCostBasis  ← ADD THIS
───────────────
Unrealized P/L
Realized P/L
Total P/L
```

### Code change

After the "Portfolio Value" `<div className='mb-4'>` block, insert:

```tsx
{/* Invested Amount */}
<div className='mb-4'>
  <p className='text-sm text-muted-foreground mb-1'>Invested Amount</p>
  <p className='text-xl font-semibold text-foreground'>
    {formatCurrency(total.totalCostBasis, total.currency as any)}
  </p>
</div>
```

---

## File 2: `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx`

### 2a. `currencyGroups` memo — add `totalCostBasis`

The accumulator in both the per-account reduce and the currency-level reduce
must include `totalCostBasis`:

**Per-account reduce** — change:
```typescript
{ totalMarketValue: 0, totalUnrealizedPL: 0 }
```
to:
```typescript
{ totalMarketValue: 0, totalUnrealizedPL: 0, totalCostBasis: 0 }
```
And add to the accumulator body:
```typescript
totalCostBasis: acc.totalCostBasis + m.costBasis,
```

**Currency-level reduce** — change:
```typescript
{ totalMarketValue: 0, totalUnrealizedPL: 0 }
```
to:
```typescript
{ totalMarketValue: 0, totalUnrealizedPL: 0, totalCostBasis: 0 }
```
And add:
```typescript
totalCostBasis: acc.totalCostBasis + a.totalCostBasis,
```

### 2b. `brokerageGroups` memo — add `totalCostBasis`

Same pattern — the per-currency reduce accumulator:

Change:
```typescript
{ totalMarketValue: 0, totalUnrealizedPL: 0 }
```
to:
```typescript
{ totalMarketValue: 0, totalUnrealizedPL: 0, totalCostBasis: 0 }
```
And add:
```typescript
totalCostBasis: acc.totalCostBasis + m.costBasis,
```

### 2c. Currency view section headers — add Invested Amount

In the currency section header `<div>` (currently shows `totalMarketValue` on the right),
add `totalCostBasis` below the market value:

```tsx
<div className='flex items-center justify-between px-2 py-2 border-b-2 border-border'>
  <h3 className='text-base font-semibold text-foreground'>
    {flag} {currencyGroup.currency} Holdings
  </h3>
  <div className='flex items-center gap-6 text-sm'>
    <div className='text-right'>
      <p className='text-xs text-muted-foreground'>Invested</p>
      <p className='font-medium text-foreground'>
        {formatCurrency(currencyGroup.totalCostBasis, currencyGroup.currency)}
      </p>
    </div>
    <div className='text-right'>
      <p className='text-xs text-muted-foreground'>Current</p>
      <p className='font-medium text-foreground'>
        {formatCurrency(currencyGroup.totalMarketValue, currencyGroup.currency)}
      </p>
    </div>
    <div className='text-right'>
      <p className='text-xs text-muted-foreground'>P/L</p>
      <p className={clsx('font-semibold', getPLColorClass(currencyGroup.totalUnrealizedPL))}>
        {currencyGroup.totalUnrealizedPL >= 0 ? '+' : ''}
        {formatCurrency(currencyGroup.totalUnrealizedPL, currencyGroup.currency)}
      </p>
    </div>
  </div>
</div>
```

### 2d. Brokerage view currency sub-headers — add Invested Amount

Same pattern as 2c but for the currency sub-header inside each brokerage accordion:

```tsx
<div className='flex items-center justify-between mb-3 pb-1 border-b border-border'>
  <span className='text-sm font-semibold text-foreground'>
    {flag} {currencySection.currency}
  </span>
  <div className='flex items-center gap-4 text-sm'>
    <div className='text-right'>
      <p className='text-xs text-muted-foreground'>Invested</p>
      <p className='font-medium text-foreground'>
        {formatCurrency(currencySection.totalCostBasis, currencySection.currency)}
      </p>
    </div>
    <div className='text-right'>
      <p className='text-xs text-muted-foreground'>Current</p>
      <p className='font-medium text-foreground'>
        {formatCurrency(currencySection.totalMarketValue, currencySection.currency)}
      </p>
    </div>
    <div className='text-right'>
      <p className='text-xs text-muted-foreground'>P/L</p>
      <p className={clsx('font-semibold', getPLColorClass(currencySection.totalUnrealizedPL))}>
        {currencySection.totalUnrealizedPL >= 0 ? '+' : ''}
        {formatCurrency(currencySection.totalUnrealizedPL, currencySection.currency)}
      </p>
    </div>
  </div>
</div>
```

---

## Acceptance Criteria

1. ✅ SummaryCards shows "Invested Amount" (cost basis) below "Portfolio Value"
2. ✅ Currency view section headers show Invested / Current / P/L side by side
3. ✅ Brokerage view currency sub-headers show same Invested / Current / P/L
4. ✅ No TypeScript errors
5. ✅ No tRPC calls added
6. ✅ No files outside the 2 listed modified

---

## File Inventory

| File | Action |
|---|---|
| `src/app/(authorized)/assets/stocks/SummaryCards.tsx` | MODIFY — add Invested Amount row |
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | MODIFY — add totalCostBasis to memos + section headers |
