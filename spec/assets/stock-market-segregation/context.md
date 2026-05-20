# Stock Market Segregation — Context

## Problem

The Stock Assets page groups holdings by brokerage account only. For investors trading
in both ASX (AUD) and US markets (USD), this mixes currencies in a single flat table,
making it difficult to:

- Understand total exposure per market at a glance
- Identify which holdings are subject to AUD vs USD price movements
- Plan for tax (Australian CGT applies differently to foreign-sourced income)
- Mirror the mental model used by brokerage platforms like Moomoo, which segregate
  AU and US holdings clearly

The solution is a **grouping toggle** on the Stock Holdings section that lets the user
switch between two hierarchical views — without any re-fetching or data changes.

## Domain Dependencies

- Uses: `PortfolioSnapshot`, `StockHolding` (with `currency: CurrencyEnumType`) from
  [../hld.md](../hld.md)
- Uses: `getSnapshotTotals` service — already returns `currencies[]` with nested
  `accounts[]` and `holdings[]`; no service changes required
- Related: `stocks-tracking` (parent feature — this extends its display layer only)
- Related: `SummaryCards` already renders 🇦🇺 AUD / 🇺🇸 USD split at the top of the page —
  the grouping toggle makes the accordion consistent with those cards

## Two Views

### Currency view (default)
Top-level sections by currency, brokerage accounts as sub-groups:

```
🇦🇺 AUD Holdings
  └─ Moomoo — Universal  [accordion]
       └─ holdings table (IVV, WTC, MOAT...)

🇺🇸 USD Holdings
  └─ Moomoo — Universal  [accordion]
       └─ holdings table (HUBS, NVDA, GOOGL, MSFT...)
```

Best for: understanding total market exposure, tax planning, matching SummaryCards.

### Brokerage view
Top-level sections by brokerage account, currency as sub-groups:

```
Moomoo — Universal  [accordion]
  ├─ 🇦🇺 AUD
  │    └─ holdings table (IVV, WTC, MOAT...)
  └─ 🇺🇸 USD
       └─ holdings table (HUBS, NVDA, GOOGL, MSFT...)
```

Best for: reviewing a specific broker account, operational portfolio management.

## Scope

**In scope**
- Toggle control (segmented button) in the "Stock Holdings" section header
- Currency view: sections per currency → accordions per brokerage account → holdings table
- Brokerage view: accordions per brokerage account → currency sub-headers → holdings table
- Toggle state persisted to `localStorage` (survives page refresh)
- Per-currency subtotal row at the bottom of each currency section/sub-section
- No data re-fetching — both views derive from `totals.currencies` already in memory

**Out of scope**
- Three-level nesting (currency → brokerage → sub-account) — sub-account model tracked
  separately in stocks-tracking spec
- Sorting controls within tables
- Filtering by market/exchange code (e.g. ASX vs NYSE/NASDAQ)
- Currency conversion or combined AUD+USD total
- Mobile-optimised collapsed view (future)
