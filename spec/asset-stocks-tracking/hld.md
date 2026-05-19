# Asset Stocks Tracking: High-Level Design

## Document Info

- **Version**: 1.0
- **Date**: 2026-02-28
- **Status**: Validated against implementation
- **Based on**: assets-stocks-tracking-prd.md v1.1
- **Implementation Reference**: Bank Assets Cash Tracking

---

## Executive Summary

This feature enables authenticated users to track stock holdings across multiple brokerage accounts by taking point-in-time snapshots. Each snapshot captures a user's portfolio position on a specific date, including individual holdings with ticker, purchase details, current valuation, and realized/unrealized gains. The system supports multi-currency (AUD/USD), profit/loss calculations with automatic CGT discount eligibility flagging (≥12 months), and fiscal year filtering for tax planning.

### Key Characteristics
- **Multi-account**: Track stocks across multiple brokerage accounts (Business type=BROKERAGE)
- **Multi-currency**: Separate totals for AUD and USD (no conversion)
- **Snapshot-based**: Point-in-time captures; immutable holdings within snapshot; create new snapshot to update
- **Tax-ready**: CGT discount eligibility calculation, realized/unrealized P/L tracking
- **Fiscal year scoped**: Filter snapshots by fiscal year (FISCAL type CalendarYear)

---

## Feature Overview

### 1. Snapshot Management

A **snapshot** is a point-in-time capture of a user's stock portfolio on a specific date. Each snapshot contains zero or more **holdings** (individual stock positions).

**Operations**:
- Create new snapshot with multiple holdings (transactional)
- View snapshot details with account-grouped holdings
- Delete entire snapshot (cascades to all holdings)
- Edit holdings: Create new snapshot with updated data (conceptually immutable)

**Date Handling**:
- Snapshots can be dated to any date (past, present, future)
- Used for tax planning (historical snapshots) and projections (future dates)
- Query by fiscal year: resolve `CalendarYearId` → `fromDate..toDate` range

### 2. Holding Management

A **holding** is an individual stock position within a snapshot.

**Key Fields**:
- **Identity**: ticker (e.g., "CBA"), company name
- **Position**: quantity held, buy price, buy date
- **Valuation**: current price (manually updated per snapshot)
- **Sales** (optional): sale price, sale date, sold quantity (supports partial sales)
- **Metadata**: currency (AUD/USD), planned term (SHORT/MID/LONG), account reference

**Operations**:
- Create holding within new snapshot (via snapshot creation)
- Create holding within existing snapshot (future: add-to-existing feature)
- Update holding (edit form in new snapshot; service layer updates)
- Delete holding (removes from snapshot; cascades if last holding)

### 3. Account Grouping (UI-Level)

The UI groups holdings **by account** for display:
- One accordion per brokerage account
- Each accordion shows account-level totals (value, P/L, currency badge)
- Expandable to show holdings table with individual rows
- Holdings sorted alphabetically by ticker within each account

**Business Model**:
- Accounts are `Business` records with `type=BROKERAGE`
- Owned by authenticated user (`userId`)
- Each holding references an account via `accountId`

### 4. Multi-Currency Support

Each holding specifies its currency independently (`currency: CurrencyEnumType` = AUD or USD).

**Aggregation**:
- Grand totals grouped by currency (separate AUD total, separate USD total)
- No cross-currency conversion
- Each summary card displays one currency

**Display**:
- Summary cards: One per currency (AUD card, USD card)
- Account headers: Currency badge (AUD or USD)
- Table rows: Currency assumed from holding record

### 5. Profit/Loss Tracking

The system calculates and displays both **unrealized** and **realized** gains/losses.

#### Unrealized P/L (Current Holdings)
- **Formula**: `marketValue - costBasis` where:
  - `costBasis = buyPrice × quantity`
  - `marketValue = currentPrice × (quantity - soldQuantity || 0)`
- **Scope**: Applies to holdings with `soldQuantity = null` or `quantity - soldQuantity > 0`
- **Display**: Color-coded (green = gain, red = loss) as:
  - Absolute: $X,XXX.XX
  - Percentage: ±X.XX%

#### Realized P/L (Sold Holdings)
- **Formula**: `(salePrice × soldQuantity) - (buyPrice × soldQuantity)`
- **Scope**: Applies to holdings with `soldQuantity > 0`
- **Partial Sales**: If `soldQuantity < quantity`, remaining shares continue to accrue unrealized P/L
- **Display**: Color-coded, absolute amount

#### Account-Level Totals
- Sum all holding P/L within account
- Separate unrealized + realized subtotals

#### Grand Totals (by Currency)
- Sum all account totals for each currency independently
- Displayed in summary cards at page top

### 6. CGT Discount Eligibility

**Automatic Calculation** (Display-Only, Not Full Tax Workflow):
- **Eligible if**: Holding period ≥ 12 months (Australian CGT 50% discount for long-term holdings)
- **Holding Period**: Calculated as `differenceInMonths(saleDate || snapshotDate, buyDate)`
- **Display**: Checkmark badge on holdings table row if eligible

**Scope**:
- NOT a full tax return generation feature
- NOT ATO integration or formal tax documentation
- Provides visual awareness of CGT discount eligibility for the user

### 7. Fiscal Year Filtering

Snapshots are scoped and filtered by **fiscal year** (CalendarYear type=FISCAL).

**Flow**:
1. User selects fiscal year from dropdown (server provides `CalendarYearType` records)
2. Controller resolves `calendarYearId` → `fromDate` and `toDate` using `CalendarYear.fromYear/fromMonth/toYear/toMonth`
3. Service layer queries: `getStockSnapshots(userId, { fromDate, toDate })`
4. Results: All snapshots within fiscal year date range
5. UI: Snapshot selector populated with snapshots for selected year

**Integration**:
- Uses existing `CalendarYear` model (see Bank Assets pattern)
- Service method signature: `getStockSnapshots(userId, filters?: { fromDate?, toDate? })`

---

## Data Model

### Entity Relationships

```
User (1)
  ├─ PortfolioSnapshot (*)
  │   └─ StockHolding (*)
  │       └─ Business(accountId) [type=BROKERAGE]
  │
  └─ Business(userId) [type=BROKERAGE]
      └─ StockHolding (*)
          └─ PortfolioSnapshot
```

### PortfolioSnapshot
- **Represents**: Point-in-time portfolio capture on a specific date
- **Uniqueness**: Not enforced at DB level; user can create multiple snapshots on same date
- **Cascade Delete**: If user deleted, all snapshots + holdings deleted
- **Cascade Delete**: If snapshot deleted, all holdings deleted

### StockHolding
- **Represents**: Individual stock position within a snapshot
- **Uniqueness**: Not enforced; same stock can appear in multiple accounts/snapshots
- **Cascade Delete**: If snapshot deleted, holding deleted
- **Account Reference**: Must be owned by same user as snapshot (`Business.userId = User.id`)

---

## API Surface

### Queries (Read-Only, No Side Effects)

| Endpoint | Purpose | Inputs | Returns |
|----------|---------|--------|---------|
| `getSnapshots` | Fetch snapshots for fiscal year | `{ calendarYearId?, calendarType? }` | `PortfolioSnapshot[]` with holdings |
| `getMostRecentSnapshot` | Fetch latest snapshot | `{ calendarYearId?, calendarType? }` | `PortfolioSnapshot` or null |
| `getSnapshotById` | Fetch specific snapshot | `{ snapshotId }` | `PortfolioSnapshot` with holdings |
| `getSnapshotTotals` | Fetch aggregated totals | `{ snapshotId }` | `{ accounts[], currencyTotals[] }` |

### Mutations (State-Changing)

| Endpoint | Purpose | Inputs | Returns |
|----------|---------|--------|---------|
| `createSnapshot` | Create snapshot + holdings | `{ snapshotDate, holdings[] }` | `PortfolioSnapshot` with holdings |
| `createHolding` | Add holding to existing snapshot | `{ snapshotId, ticker, ... }` | `StockHolding` with account |
| `updateHolding` | Modify existing holding | `{ holdingId, ticker?, quantity?, ... }` | `StockHolding` updated |
| `deleteHolding` | Remove holding from snapshot | `{ holdingId }` | `{ success: true }` |
| `deleteSnapshot` | Delete entire snapshot + holdings | `{ snapshotId }` | `{ success: true }` |

**All endpoints**:
- Protected by NextAuth (session required)
- User scoped: All data filtered by authenticated `userId`
- Input validated via Zod schemas
- Errors handled with `handleCaughtError()` utility

---

## UI Architecture

### Page Structure

```
/assets/stocks [Server Component]
├─ Metadata (title, description)
├─ Auth check → error or proceed
├─ Fetch calendar years
├─ Render layout
└─ <Suspense>
    └─ StockAssetsClient [Client Component]
        ├─ Fiscal Year Selector (onChange → URL params)
        ├─ Snapshot Selector (onChange → requery holdings)
        ├─ SummaryCards
        │   ├─ AUD card (totalValue, unrealizedPL, realizedPL)
        │   └─ USD card (totalValue, unrealizedPL, realizedPL)
        ├─ Account Accordions
        │   └─ Holdings Table [per account]
        │       ├─ Columns: Stock, Qty, BuyPrice, BuyDate, CurrentPrice, MarketValue, P/L, P/L%, Term, Holding, SalePrice, SaleDate, CGTEligible, Actions
        │       └─ Row Actions: Edit, Delete
        ├─ NewSnapshotModal [Client Component]
        │   ├─ Date picker (snapshot date)
        │   ├─ Account selector
        │   ├─ Form: Add holdings inline
        │   └─ Submit → mutation
        ├─ HoldingFormModal [Client Component]
        │   ├─ Ticker, Company, Quantity, BuyPrice, BuyDate, CurrentPrice
        │   ├─ Currency, PlannedTerm
        │   ├─ SalePrice, SaleDate, SoldQuantity (optional)
        │   └─ Submit → mutation (create or update)
        └─ Delete Confirmation Dialogs [hidden]
```

### Client Component State

**StockAssetsClient state**:
- `selectedYear: OptionType | null` — fiscal year selection
- `selectedSnapshotId: string | null` — active snapshot ID
- `selectedSnapshot: OptionType | null` — snapshot details
- `snapshotOptions: OptionType[]` — available snapshots for year
- `editingHolding: StockHoldingWithAccount | null` — for edit modal
- `isNewSnapshotModalOpen: boolean`
- `isHoldingFormModalOpen: boolean`
- `deleteConfirm: { snapshotId, snapshotDate } | null`
- `deleteHoldingConfirm: { holdingId, ticker, snapshotId } | null`

**Data Fetching** (tRPC):
- `trpc.stockAsset.getSnapshots.useQuery()` — all snapshots for year
- `trpc.stockAsset.getMostRecentSnapshot.useQuery()` — default snapshot
- `trpc.stockAsset.getSnapshotTotals.useQuery()` — aggregated totals
- `trpc.stockAsset.createSnapshot.useMutation()` — new snapshot
- `trpc.stockAsset.updateHolding.useMutation()` — edit holding
- `trpc.stockAsset.deleteHolding.useMutation()` — remove holding
- `trpc.stockAsset.deleteSnapshot.useMutation()` — delete snapshot

---

## Calculations & Business Logic

### Calculation Functions (in `src/utils/stock-asset-calculations.ts`)

- `calculateHoldingMetrics(holding, snapshotDate)` → `{ costBasis, marketValue, unrealizedPL, unrealizedPLPercent, realizedPL, holdingPeriodMonths, cgtEligible }`
- `formatCurrency(value, currency)` → `"$X,XXX.XX"` or `"US$X,XXX.XX"`
- `formatQuantity(qty)` → `"1,234.50"`
- `formatPrice(price)` → `"$X.XX"`
- `formatPercentage(pct)` → `"±X.XX%"`
- `formatHoldingPeriod(months)` → `"8 months"` or `"1 year, 3 months"`
- `getPLColorClass(pl)` → `"text-green-600"` or `"text-red-600"`
- `getPLBgColorClass(pl)` → `"bg-green-50"` or `"bg-red-50"`
- `getTermStatusColorClass(status)` → `"text-green-600"` / `"text-yellow-600"` / `"text-red-600"`
- `getTermStatusLabel(plannedTerm, actualMonths)` → `"On Track"` / `"Ahead"` / `"Behind"`

### Service-Layer Aggregation

**getSnapshotTotals(snapshotId, userId)**:
- Fetch snapshot with all holdings + account info
- Group holdings by account
- For each account:
  - Group by currency
  - Sum `marketValue` → account total value
  - Sum `unrealizedPL` → account unrealized P/L
  - Sum `realizedPL` → account realized P/L
- For each currency (across all accounts):
  - Sum account totals by currency
  - Return as `currencyTotals: [{ currency, totalValue, unrealizedPL, realizedPL }]`
- Return structure: `{ snapshotId, snapshotDate, accounts[], currencyTotals[] }`

---

## Known Gaps & Limitations

### Not Yet Implemented

1. **Prefill from Previous Snapshot** (PRD §4.4 - Priority: High)
   - **Intent**: When creating new snapshot, pre-populate form with most recent holdings
   - **Why Not**: UI integration incomplete; backend ready via `getMostRecentSnapshot()`
   - **Effort**: Fetch latest snapshot in NewSnapshotModal, populate form fields
   - **Future Phase**: Will reduce data entry for frequent snapshot creators
   - **Spec**: `spec/asset-stocks-tracking/add-holding-improvements/`

2. ~~**Snapshot Date Editing**~~ — **Won't Do (By Design)**
   - A snapshot is an immutable historical record; its date is its identity
   - Editing the date would corrupt financial history and risk fiscal year boundary issues
   - Correct UX: delete the snapshot and recreate with the right date — now low-friction via the Prefill feature
   - Removed from future roadmap

### Implemented (Previously Listed as Gaps)

3. ~~**Add Holding to Existing Snapshot**~~ ✅ **CLOSED**
   - **Was**: Not integrated into UI; endpoint exists
   - **Now**: `HoldingFormModal` with `createHolding` mutation wired via "Add Holding" button in each account accordion's `Disclosure.Panel`. Account pre-selection UX improvement tracked in `spec/asset-stocks-tracking/add-holding-improvements/`

### Design Scope Boundaries

1. **CGT Discount is Display-Only**
   - **Calculation**: Automatic ≥12 months check with checkmark badge
   - **NOT Included**: Tax return generation, ATO forms, formal tax documentation
   - **Reason**: Out of scope; focus on user awareness

2. **No Real-Time Price Feeds**
   - Manual entry of current price for each holding
   - No market API integration (future enhancement)

3. **No Dividend Tracking**
   - Separate feature; links to Income ledger with source=STOCKS

4. **No Currency Conversion**
   - AUD and USD totals displayed separately
   - User responsible for manual conversion if needed

---

## Implementation Status

### Completed (At Time of Spec)
- ✅ Database models: PortfolioSnapshot, StockHolding
- ✅ Service layer: CRUD, aggregation, date-range filtering
- ✅ Controller layer: Request handling, error wrapping
- ✅ Zod validation schemas
- ✅ tRPC router: All queries + mutations
- ✅ Frontend pages and components (core layout)
- ✅ Calculation utilities
- ✅ Fiscal year filtering

### Outstanding / Partial
- ~~⚠️ Prefill from previous~~ ✅ Implemented — `getMostRecentSnapshot` + "↩ Prefill from previous" button in `NewSnapshotModal`
- ~~⚠️ Snapshot date editing~~ — Won't Do (By Design)
- ~~⚠️ Account pre-selection UX~~ ✅ Implemented — `defaultAccountId` prop on `HoldingFormModal`; pre-selects account from accordion context

### Closed Since Original Spec
- ✅ Add-to-existing snapshot: `createHolding` endpoint wired via `HoldingFormModal` + "Add Holding" button per account accordion

---

## Success Criteria

### User Experience
- Users can create, view, and delete snapshots
- Account accordions group holdings clearly
- Summary cards display correct totals (AUD/USD separate)
- P/L calculations accurate and color-coded
- CGT eligibility flag visible for ≥12 month holdings
- Fiscal year filter enables tax year switching

### Technical
- All endpoints protected by NextAuth
- User isolation: queries scoped to authenticated user
- Response time: < 500ms for snapshot queries
- Error handling: Generic client errors, detailed server logs
- Validation: All inputs validated before DB operations

### Data Integrity
- Snapshot creation transactional (all-or-nothing)
- Cascade delete prevents orphaned holdings
- Account ownership verified before mutations
- Decimal precision maintained for money values

---

## Future Enhancements

1. **Prefill Feature** — Pre-populate new snapshot from previous
2. ~~**Snapshot Date Editing**~~ — Won't Do (By Design; snapshot date is an immutable historical marker)
3. **Add-to-Existing** — Append holding to non-latest snapshot
4. **Real-Time Prices** — API integration with market data (IEX, Twelve Data, etc.)
5. **Price History** — Track price changes over time for charting
6. **Alerts** — Notify on price targets, portfolio milestones
7. **Export** — CSV export for tax filing
8. **Dividend Integration** — Link to Income ledger for dividend tracking
9. **Currency Conversion** — Display multi-currency totals with FX rates
10. **Portfolio Rebalancing** — Recommendations based on asset allocation targets

---

## Reference & Related Features

- **Bank Assets Cash Tracking** (`/cashflow/bank`) — Similar snapshot pattern, used as implementation reference
- **Income Ledger** (`/income`) — Future dividend link (source=STOCKS)
- **Calendar Years** — Existing fiscal year model for filtering
- **Business Settings** — Brokerage account management (type=BROKERAGE)
- **NextAuth** — Session-based user authentication
