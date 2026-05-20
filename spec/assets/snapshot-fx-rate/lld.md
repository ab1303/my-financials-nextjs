# Snapshot FX Rate — Low Level Design

## Overview

4-phase sequential implementation: Schema → Service/tRPC → Modal → Display.
Phases 3 and 4 can run in parallel after Phase 2 completes.

---

## Phase 1 — Schema Migration

### `prisma/schema.prisma`

Add `usdToAudRate` to `PortfolioSnapshot`:

```prisma
model PortfolioSnapshot {
  id           String         @id @default(cuid())
  snapshotDate DateTime
  usdToAudRate Decimal?       // USD→AUD rate at snapshot time; null for pre-existing snapshots
  userId       String
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  holdings     StockHolding[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([userId, snapshotDate])
}
```

**Migration**: `prisma migrate dev --name add-usd-aud-rate-to-portfolio-snapshot`

Non-destructive: nullable field, no existing data affected.

---

## Phase 2 — Service, Schema, tRPC

### `src/server/schema/stock-asset.schema.ts`

Add `usdToAudRate` to `createStockSnapshotSchema`:

```typescript
export const createStockSnapshotSchema = object({
  snapshotDate: z.coerce.date({ required_error: 'Snapshot date is required' }),
  usdToAudRate: z.coerce.number().positive().optional().nullable(),
  holdings: z.array(stockHoldingEntrySchema).min(1, 'At least one holding is required'),
});
```

Update `CreateStockSnapshotInput` — inferred automatically via `z.infer`.

### `src/server/services/stock-asset.service.ts`

**`createStockSnapshot`**: persist `usdToAudRate`:
```typescript
const snapshot = await tx.portfolioSnapshot.create({
  data: {
    snapshotDate: input.snapshotDate,
    usdToAudRate: input.usdToAudRate ?? null,
    userId,
    holdings: { create: [...] },
  },
  ...
});
```

**`getSnapshotTotals`**: include `usdToAudRate` in the return:
```typescript
return {
  snapshotId: snapshot.id,
  snapshotDate: snapshot.snapshotDate,
  usdToAudRate: snapshot.usdToAudRate ? Number(snapshot.usdToAudRate) : null,
  currencies: Object.values(currencyTotals),
};
```

**`getSnapshotById` / `getStockSnapshots`**: `usdToAudRate` is selected
automatically via Prisma once the schema field is added — no query change needed.

### `src/server/trpc/router/stock-asset.ts`

Add `getExchangeRate` query — reuses the existing service:

```typescript
import { getUSDtoAUDRate } from '@/server/services/exchange-rate.service';

// Inside stockAssetRouter:
getExchangeRate: protectedProcedure.query(async () => {
  const rate = await getUSDtoAUDRate();
  return { rate };
}),
```

---

## Phase 3 — NewSnapshotModal

**File**: `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx`

### 3a. Auto-fetch on open

```typescript
const { data: exchangeRateData } = trpc.stockAsset.getExchangeRate.useQuery(
  undefined,
  { enabled: isOpen },
);

// Pre-fill form when rate arrives
useEffect(() => {
  if (exchangeRateData?.rate && !form.getValues('usdToAudRate')) {
    form.setValue('usdToAudRate', exchangeRateData.rate);
  }
}, [exchangeRateData, form]);
```

### 3b. Form field (optional, collapsible under "Advanced")

Place below the snapshot date field. Use `NumericFormat` consistent with other
price fields in the form:

```tsx
<div>
  <Label htmlFor='usdToAudRate' className='cursor-pointer'>
    USD → AUD Rate
    <span className='ml-2 text-xs text-muted-foreground font-normal'>
      (auto-fetched · adjust if needed)
    </span>
  </Label>
  <Controller
    name='usdToAudRate'
    control={form.control}
    render={({ field }) => (
      <NumericFormat
        id='usdToAudRate'
        value={field.value ?? ''}
        onValueChange={({ floatValue }) => field.onChange(floatValue ?? null)}
        decimalScale={4}
        placeholder='e.g. 1.5470'
        className='mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring'
      />
    )}
  />
  {exchangeRateData?.rate && (
    <p className='mt-1 text-xs text-muted-foreground'>
      Live rate: 1 USD = {exchangeRateData.rate.toFixed(4)} AUD
    </p>
  )}
</div>
```

### 3c. Zod schema update

`createStockSnapshotSchema` now includes `usdToAudRate` (Phase 2), so the form
type `FormData = CreateStockSnapshotInput` picks it up automatically. No manual
form type change needed.

---

## Phase 4 — Display

### `src/app/(authorized)/assets/stocks/SummaryCards.tsx`

**USD card only** — add AUD equivalent below "Invested Amount":

```tsx
{total.currency === 'USD' && (
  <>
    {usdToAudRate ? (
      <div className='mt-3 pt-3 border-t border-border'>
        <p className='text-xs text-muted-foreground mb-2'>
          AUD Equivalent  ·  1 USD = {usdToAudRate.toFixed(4)} AUD
          {snapshotDate && (
            <span className='ml-1'>
              · {new Date(snapshotDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </p>
        <div className='flex justify-between items-end'>
          <div>
            <p className='text-xs text-muted-foreground mb-0.5'>Portfolio Value</p>
            <p className='text-lg font-semibold text-foreground'>
              {formatCurrency(total.totalValue * usdToAudRate, 'AUD')}
            </p>
          </div>
          <div className='text-right'>
            <p className='text-xs text-muted-foreground mb-0.5'>Invested Amount</p>
            <p className='text-base font-medium text-foreground'>
              {formatCurrency(total.totalCostBasis * usdToAudRate, 'AUD')}
            </p>
          </div>
        </div>
      </div>
    ) : (
      <p className='text-xs text-muted-foreground mt-2 pt-2 border-t border-border'>
        AUD equivalent not available — rate not recorded for this snapshot
      </p>
    )}
  </>
)}
```

**`SummaryCardsProps` update** — add `usdToAudRate` and `snapshotDate`:

```typescript
interface SummaryCardsProps {
  currencyTotals: CurrencyTotalFromService[];
  usdToAudRate: number | null;
  snapshotDate: Date | null;
}
```

**Call site** in `StockAssetsClient.tsx`:
```tsx
{totals && totals.currencies && (
  <SummaryCards
    currencyTotals={totals.currencies}
    usdToAudRate={totals.usdToAudRate ?? null}
    snapshotDate={snapshotDate}
  />
)}
```

### `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx`

**Currency view — USD Holdings section header**: add AUD equivalent line below
the Invested / Current / P/L row when `totals.usdToAudRate` is set:

```tsx
{currencyGroup.currency === 'USD' && totals?.usdToAudRate && (
  <p className='text-xs text-muted-foreground mt-0.5'>
    ≈ AUD {formatCurrency(
      currencyGroup.totalMarketValue * totals.usdToAudRate,
      'AUD',
    )}
    <span className='ml-2 opacity-70'>
      (1 USD = {Number(totals.usdToAudRate).toFixed(4)} AUD)
    </span>
  </p>
)}
```

Place this directly inside the currency section header `<div>`, below the existing
Invested / Current / P/L row — right-aligned.

**Brokerage view — USD sub-header**: same pattern inside the currency sub-header
`<div>` for `currencySection.currency === 'USD'`.

---

## Type Updates

### `src/types/stock-asset.types.ts`

Update `StockSnapshotTotals` to include `usdToAudRate`:

```typescript
export type StockSnapshotTotals = {
  snapshotId: string;
  snapshotDate: Date;
  usdToAudRate: number | null;   // ADD
  accounts: AccountTotalSummary[];
  currencyTotals: CurrencyTotal[];
};
```

---

## Acceptance Criteria

1. ✅ New snapshot can be created with `usdToAudRate` — auto-fetched, user-editable
2. ✅ Rate is persisted to `PortfolioSnapshot.usdToAudRate` in DB
3. ✅ Snapshots created before this feature have `usdToAudRate = null`; no UI broken
4. ✅ SummaryCards USD card shows AUD equivalent (value + invested) with rate + date
5. ✅ SummaryCards shows "rate not recorded" fallback when `usdToAudRate` is null
6. ✅ Currency view USD Holdings header shows `≈ AUD X,XXX (1 USD = 1.5470 AUD)`
7. ✅ Brokerage view USD sub-header shows same AUD equivalent
8. ✅ AUD card unaffected — no AUD equivalent line on AUD holdings
9. ✅ Migration is non-destructive (nullable field, no data loss)
10. ✅ No TypeScript errors in build

---

## File Inventory

| File | Action | Phase |
|---|---|---|
| `prisma/schema.prisma` | MODIFY — add `usdToAudRate Decimal?` to `PortfolioSnapshot` | 1 |
| `src/server/schema/stock-asset.schema.ts` | MODIFY — add `usdToAudRate` to `createStockSnapshotSchema` | 2 |
| `src/server/services/stock-asset.service.ts` | MODIFY — persist + return `usdToAudRate` | 2 |
| `src/server/trpc/router/stock-asset.ts` | MODIFY — add `getExchangeRate` query | 2 |
| `src/types/stock-asset.types.ts` | MODIFY — add `usdToAudRate` to `StockSnapshotTotals` | 2 |
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | MODIFY — auto-fetch rate, add form field | 3 |
| `src/app/(authorized)/assets/stocks/SummaryCards.tsx` | MODIFY — AUD equivalent section on USD card | 4 |
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | MODIFY — AUD line in USD section headers | 4 |
