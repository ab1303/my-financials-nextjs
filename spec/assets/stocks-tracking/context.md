# Stocks Tracking — Context

## Problem

Users with stock investments in multiple brokerage accounts have no way to track holdings, profit/loss, CGT eligibility, or portfolio value over time. Each CSV tax report requires manually calculating these numbers. There is no single view across brokerage accounts, no support for multi-currency (AUD/USD), and no fiscal year scoping for tax planning.

## Domain Dependencies

- Uses: `PortfolioSnapshot`, `StockHolding` models from domain HLD
- Patterns: Same snapshot-based pattern as bank-assets; `Business` records with `type=BROKERAGE` as account container; fiscal year filtering via `CalendarYear.fromYear/toYear` date range
- Related features: net-worth-dashboard (reads `PortfolioSnapshot` for AUD-only totals in trend chart), income management (future dividend integration via `IncomeRecord` with `source=STOCKS`)

## Scope

**In scope:**
- Point-in-time portfolio snapshot creation with multiple holdings
- Multi-account: holdings grouped by brokerage account (Business type=BROKERAGE)
- Multi-currency: AUD and USD totals displayed separately (no conversion)
- Unrealized P/L: `(quantity - soldQuantity) * currentPrice - costBasis`
- Realized P/L: `(salePrice * soldQuantity) - (buyPrice * soldQuantity)`
- CGT discount eligibility flag: holding period ≥ 12 months
- Fiscal year filtering for snapshot queries
- Edit holdings (new snapshot pre-fill) and delete snapshots/holdings

**Out of scope:**
- Brokerage sub-account model (separate spec: `spec/asset-stocks-tracking/brokerage-account-model/`)
- Real-time price feeds
- Dividend tracking (links to Income ledger — separate feature)
- Currency conversion
- Portfolio rebalancing recommendations
- Snapshot date editing (won't do — snapshot date is immutable by design)

## Known Constraints

- Snapshot date is intentionally immutable — it is the snapshot's identity; delete and recreate with correct date
- `StockHolding.accountId` references `Business` (institution) not `BankAccount` (sub-account) — gap identified post-implementation, tracked in `spec/asset-stocks-tracking/brokerage-account-model/`
- `@@unique` not enforced at DB level for snapshots — user can create multiple on same date
- Calculation functions live in `src/utils/stock-asset-calculations.ts` — client-side only

## Files

| File | Action | Description |
|---|---|---|
| `src/server/services/stock-asset.service.ts` | MODIFY | `getSnapshots`, `getMostRecentSnapshot`, `getSnapshotTotals`, `createSnapshot`, `createHolding`, `updateHolding`, `deleteHolding`, `deleteSnapshot` |
| `src/server/api/routers/stock-asset.ts` | MODIFY | tRPC router: all queries + mutations |
| `src/app/(authorized)/assets/stocks/page.tsx` | MODIFY | Server Component: fetches calendarYears, passes to client |
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | MODIFY | Client Component: snapshot selector, account accordions, modals |
| `src/app/(authorized)/assets/stocks/_components/NewSnapshotModal.tsx` | MODIFY | Pre-fill from most recent snapshot |
| `src/app/(authorized)/assets/stocks/_components/HoldingFormModal.tsx` | MODIFY | Create/edit holding form |
| `src/utils/stock-asset-calculations.ts` | MODIFY | `calculateHoldingMetrics`, `formatCurrency`, `getPLColorClass`, etc. |
