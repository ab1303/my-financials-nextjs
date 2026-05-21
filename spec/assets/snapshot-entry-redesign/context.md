# Snapshot Entry Redesign — Feature Context

## Problem Summary

Currently, the `NewSnapshotModal` treats stock holdings and idle cash balances as separate entry flows:
- Cash entry is hidden in a conditional section only visible after adding a stock holding
- Users cannot record a snapshot with only cash and no stocks
- Summary cards show stocks and cash totals separately, not unified
- Users adding cash to existing snapshots have poor discoverability

This feature redesigns the entry modal to unify stock and cash as first-class entry types with:
1. **Segmented toggle** ("📈 Stocks" / "💰 Cash") at the top of the modal to choose entry type
2. **Unified summary** cards that show Stocks + Cash + Total Portfolio Value breakdown
3. **Economic model** where all holdings (stocks, cash) are treated as portfolio assets

## Domain Dependencies

See [spec/assets/hld.md](../hld.md) for:
- **Asset Architecture (AD-1)**: Portfolio snapshot structure and relations
- **Multi-Currency Support (AD-2)**: AUD/USD handling via exchange rates
- **BrokerageCashBalance model** (prior brokerage-cash-holdings feature)

This feature builds on:
- `PortfolioSnapshot` + `StockHolding` + `BrokerageCashBalance` models
- Existing `getSnapshotTotals` service (now extended to include cash breakdown)
- `SummaryCards` component (now shows unified totals)

## Scope Boundary

| IN SCOPE | OUT OF SCOPE |
|----------|--------------|
| Add toggle ("Stocks" / "Cash") to NewSnapshotModal | Editing/deleting holdings after snapshot |
| Show only relevant form fields per tab | Cash transfer between accounts |
| Unified summary showing Stocks + Cash + Total | Portfolio rebalancing suggestions |
| Pass both stocks and cash to `createSnapshot` mutation | Performance charts or trends |
| Update `SummaryCards` to show breakdown | Expense ratio or fee calculations |
| Allow cash-only snapshots | Dividend tracking |

## Schema References

**Models unchanged** — uses existing:
- `PortfolioSnapshot` with relations to both `StockHolding` and `BrokerageCashBalance`
- `StockHolding` for equity holdings
- `BrokerageCashBalance` for idle cash per account/currency

**New tRPC shape** (service already computes this):
```typescript
totals {
  snapshotId: string;
  snapshotDate: Date;
  usdToAudRate: number | null;
  currencyTotals: {
    currency: 'AUD' | 'USD';
    totalValue: number;         // stocks market value
    totalCash: number;          // cash in this currency
    totalCostBasis: number;
    totalUnrealizedPL: number;
    totalRealizedPL: number;
  }[];
  cashBalances: {
    accountId: string;
    accountName: string;
    currency: 'AUD' | 'USD';
    amount: number;
  }[];
}
```

## Existing Patterns to Reuse

1. **Field Array pattern** (react-hook-form): Currently used for stock holdings; extend for cash entries
2. **NumericFormat** wrapper: Existing for price inputs; reuse for cash amounts
3. **Account selector pattern**: Existing institution/account dropdowns; reuse in cash section
4. **Service/Type pattern**: `getSnapshotTotals` already returns cash breakdown; no backend changes needed
5. **Zod validation**: Existing `cashBalanceEntrySchema` + `stockHoldingEntrySchema`; reuse

## Gotchas & Constraints

- **Toggle state management**: Must persist which tab user is on during form interaction (UX expectation)
- **Mixed entries**: User can add both stocks and cash in one snapshot — summary must account for both
- **Empty state handling**: Allow snapshot with cash only (no stocks), unlike current validation
- **Mobile responsiveness**: Toggle should work on small screens (consider vertical stack or horizontal scroll)
- **Prefill behavior**: When prefilling from previous snapshot, both stocks and cash should be prepopulated
