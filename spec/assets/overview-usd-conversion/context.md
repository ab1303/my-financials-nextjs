# Overview USD Conversion — Context

## Problem

The Assets Overview page shows **"Stocks (AUD only)"** — USD holdings are silently
excluded from the stock total and net worth trend. This was a deliberate simplification
before FX rate support existed.

Now that `PortfolioSnapshot.usdToAudRate Decimal?` is stored at snapshot creation time
(see `snapshot-fx-rate` feature), we can correctly include USD holdings by converting
them to AUD at the snapshot's historical rate.

## Impact

- **Stock card** understates total portfolio value (missing all US stocks)
- **Net Worth Trend** chart misses US stocks across all data points
- **Total Assets** card is therefore also understated

## Domain Dependencies

- `PortfolioSnapshot.usdToAudRate` (added in `snapshot-fx-rate`) — rate used for conversion
- `getNetWorthTrend` in `asset-dashboard.service.ts` — the query to fix
- `AssetSummaryCards.tsx` — the "Stocks (AUD only)" label to update

## Scope

**In scope**
- Remove `where: { currency: AUD }` filter from `getNetWorthTrend`'s holdings query
- Convert USD holdings using the snapshot's `usdToAudRate`; skip USD holdings where rate is null (graceful degradation for old snapshots without rate)
- Update "Stocks (AUD only)" label → "Stocks (AUD equiv.)"
- Add a note on the card when some snapshots have no rate (so USD was partially excluded)

**Out of scope**
- Live FX rate fallback for old snapshots (user can backfill via pencil icon on Stock page)
- GBP/EUR holdings
- Backfilling rates automatically
