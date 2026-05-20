# Stocks Tracking — Low Level Design

## Implementation Status

Most of this feature is implemented. This LLD documents the implemented design and outstanding gaps.

### Completed
- ✅ Database models: `PortfolioSnapshot`, `StockHolding`
- ✅ Service layer: CRUD, aggregation, date-range filtering
- ✅ Zod validation schemas
- ✅ tRPC router: all queries + mutations
- ✅ Frontend pages and components (core layout)
- ✅ Calculation utilities
- ✅ Fiscal year filtering
- ✅ Add holding to existing snapshot (`createHolding` via "Add Holding" button)
- ✅ Prefill from previous snapshot in `NewSnapshotModal`

---

## API Surface

### Queries

| Endpoint | Inputs | Returns |
|---|---|---|
| `getSnapshots` | `{ calendarYearId?, calendarType? }` | `PortfolioSnapshot[]` with holdings |
| `getMostRecentSnapshot` | `{ calendarYearId?, calendarType? }` | `PortfolioSnapshot` or null |
| `getSnapshotById` | `{ snapshotId }` | `PortfolioSnapshot` with holdings |
| `getSnapshotTotals` | `{ snapshotId }` | `{ accounts[], currencyTotals[] }` |

### Mutations

| Endpoint | Inputs | Returns |
|---|---|---|
| `createSnapshot` | `{ snapshotDate, holdings[] }` | `PortfolioSnapshot` with holdings |
| `createHolding` | `{ snapshotId, ticker, ... }` | `StockHolding` with account |
| `updateHolding` | `{ holdingId, ticker?, quantity?, ... }` | Updated `StockHolding` |
| `deleteHolding` | `{ holdingId }` | `{ success: true }` |
| `deleteSnapshot` | `{ snapshotId }` | `{ success: true }` |

All endpoints: protected by NextAuth, scoped by `userId`, Zod-validated.

---

## Calculation Functions

**File:** `src/utils/stock-asset-calculations.ts`

```typescript
calculateHoldingMetrics(holding: StockHolding, snapshotDate: Date): {
  costBasis:           number;   // buyPrice × quantity
  marketValue:         number;   // currentPrice × (quantity - soldQuantity)
  unrealizedPL:        number;   // marketValue - costBasis
  unrealizedPLPercent: number;
  realizedPL:          number;   // (salePrice × soldQuantity) - (buyPrice × soldQuantity)
  holdingPeriodMonths: number;
  cgtEligible:         boolean;  // holdingPeriodMonths >= 12
}

formatCurrency(value: number, currency: 'AUD' | 'USD'): string
  // AUD → "$X,XXX.XX"
  // USD → "US$X,XXX.XX"

getPLColorClass(pl: number): string   // "text-green-600" | "text-red-600"
getTermStatusLabel(plannedTerm, actualMonths): "On Track" | "Ahead" | "Behind"
```

---

## Service-Layer Aggregation

**`getSnapshotTotals(snapshotId, userId)`:**

1. Fetch snapshot with all holdings + account info
2. Group holdings by account
3. For each account:
   - Group by currency
   - Sum `marketValue` → account total value
   - Sum `unrealizedPL` + `realizedPL` → account P/L
4. For each currency (across all accounts): sum account totals
5. Return: `{ snapshotId, snapshotDate, accounts[], currencyTotals[] }`

---

## Component Architecture

```
/assets/stocks [Server Component]
└─ StockAssetsClient [Client Component]
    ├─ Fiscal Year Selector
    ├─ Snapshot Selector
    ├─ SummaryCards (AUD card, USD card)
    ├─ Account Accordions
    │   └─ Holdings Table [per account]
    │       └─ Columns: Stock, Qty, BuyPrice, BuyDate, CurrentPrice, MarketValue, P/L, P/L%, Term, Holding, SalePrice, SaleDate, CGTEligible, Actions
    ├─ NewSnapshotModal
    │   └─ "↩ Prefill from previous" button → getMostRecentSnapshot
    ├─ HoldingFormModal
    │   └─ defaultAccountId prop for accordion-context pre-selection
    └─ Delete Confirmation Dialogs
```

---

## Outstanding Gaps

### Gap 1: Brokerage Sub-Account Model (Priority: High)

**Problem:** `StockHolding.accountId` references `Business` (institution). Users with multiple accounts at same brokerage (IRA + Individual) cannot distinguish them.

**Fix:** Schema migration to reference `BankAccount` (sub-account) instead of `Business`. Requires two-level dependent select in `HoldingFormModal`.

**Effort:** ~2–3 days. Low risk if done before any prod stock data; high risk afterwards.

**Spec:** `spec/asset-stocks-tracking/brokerage-account-model/`

---

## Fiscal Year Filtering Flow

1. User selects fiscal year from dropdown
2. Controller resolves `calendarYearId` → `fromDate` + `toDate` using `CalendarYear.fromYear/fromMonth/toYear/toMonth`
3. Service: `getStockSnapshots(userId, { fromDate, toDate })`
4. Snapshot selector populated for selected year

---

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/stock-asset.service.ts` | MODIFY | Full CRUD + `getSnapshotTotals` aggregation |
| `src/server/api/routers/stock-asset.ts` | MODIFY | All queries + mutations |
| `src/server/api/root.ts` | MODIFY | Register `stockAsset` router |
| `src/app/(authorized)/assets/stocks/page.tsx` | MODIFY | Server Component shell |
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | MODIFY | Main Client Component |
| `src/app/(authorized)/assets/stocks/_components/NewSnapshotModal.tsx` | MODIFY | Pre-fill from most recent |
| `src/app/(authorized)/assets/stocks/_components/HoldingFormModal.tsx` | MODIFY | Create/edit holding; `defaultAccountId` |
| `src/utils/stock-asset-calculations.ts` | MODIFY | `calculateHoldingMetrics` + formatting utils |
