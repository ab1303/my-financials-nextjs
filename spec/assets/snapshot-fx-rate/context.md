# Snapshot FX Rate — Context

## Problem

The Stock Assets page displays USD holdings in USD only. Users who trade in both
ASX (AUD) and US markets (USD) need to see their **USD portfolio value expressed
in AUD** to understand total wealth in a single currency — particularly for:

- **Zakat** — obligation calculated in a single currency (AUD for AU residents)
- **Net worth context** — AUD bank assets + AUD-equivalent stock value
- **Tax planning** — ATO requires foreign income reported in AUD

### Why "live rate" is insufficient

A historical snapshot taken 6 months ago should show the AUD equivalent **at that
date's rate**, not today's. Using today's rate on a January 2025 snapshot misrepresents
the portfolio's historical AUD value. Therefore the rate must be **stored with the
snapshot at creation time**.

### Existing infrastructure

`exchange-rate.service.ts` already fetches the live USD→AUD rate from
`open.er-api.com` (1-hour cache, fallback 1.55). This service is reused — no new
API integration required.

## Domain Dependencies

- Uses: `PortfolioSnapshot` model from [../hld.md](../hld.md) — adds `usdToAudRate`
- Uses: `exchange-rate.service.ts` — already used by `ai-usage` router
- Related: `stock-market-segregation` — the Currency/Brokerage view section headers
  that need AUD equivalent lines
- Related: `invested-amount-display` — SummaryCards layout that gains an AUD row

## Scope

**In scope**
- `usdToAudRate Decimal?` added to `PortfolioSnapshot` (nullable — old snapshots
  have no rate; UI degrades gracefully)
- `createStockSnapshotSchema` — add optional `usdToAudRate` field
- `stock-asset.service.ts` — persist rate on create; return on reads
- `stockAssetRouter` — expose `getExchangeRate` query (reuses exchange-rate.service)
- `NewSnapshotModal` — auto-fetch live rate, pre-fill editable field, user can adjust
- `SummaryCards` — AUD equivalent row on USD card; rate + date shown as footnote
- `StockAssetsClient` — AUD equivalent in USD Holdings section header (Currency view)
  and USD sub-header (Brokerage view)

**Out of scope**
- AUD→USD (only USD→AUD needed)
- GBP, EUR or other currencies
- Updating rate on existing snapshots (rate is immutable once set, like snapshot date)
- Net worth chart USD→AUD consolidation (separate feature)
- Realised FX gain/loss tracking
