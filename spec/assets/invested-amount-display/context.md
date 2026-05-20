# Invested Amount Display — Context

## Problem

The SummaryCards and section headers on the Stock Assets page show only current
market value and P/L. Users — especially those calculating Zakat — need to see
their **invested amount** (cost basis = buyPrice × quantity) separately from the
current market value.

For Zakat, there are two scholarly approaches:
- **Market value** (AAOIFI / most contemporary scholars): Zakat on current price
- **Invested amount / cost basis**: Used by some scholars for long-term holdings

Since the app cannot take a scholarly position, showing both values lets the user
apply whichever basis their scholar recommends.

## Domain Dependencies

- Uses: `StockHolding.buyPrice`, `StockHolding.quantity` from [../hld.md](../hld.md)
- `totalCostBasis` is already computed by `getSnapshotTotals` service and present
  in the `CurrencyTotalFromService` interface — it is just not rendered
- Related: `stock-market-segregation` (adds currencyGroups / brokerageGroups memos
  which also need totalCostBasis for section header display)

## Scope

**In scope**
- `SummaryCards.tsx`: Add "Invested Amount" row showing `totalCostBasis`
- `StockAssetsClient.tsx`: Add `totalCostBasis` to `currencyGroups` and
  `brokerageGroups` memos; show it in the Currency and Brokerage view section headers

**Out of scope**
- Zakat nisab calculation or obligation logic
- Cost basis editing (buyPrice is set at holding creation)
- Per-holding invested amount column in the table (already visible as Buy Price × Qty)
- Any schema or tRPC changes
