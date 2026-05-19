# Asset Stocks Tracking: Context & File Inventory

## Feature Summary

Track stock holdings across multiple brokerage accounts with point-in-time snapshots. Supports multi-currency (AUD/USD), profit/loss calculations, CGT discount eligibility, and fiscal year filtering for tax planning.

## File Inventory

### Frontend

| File | Type | Purpose |
|------|------|---------|
| `src/app/(authorized)/assets/stocks/page.tsx` | Server Component | Entry point; fetches calendar years, renders page structure, injects initial data |
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | Client Component | Main UI orchestrator; manages modals, selections, data fetching via tRPC |
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | Client Component | Create snapshot form with prefill from previous snapshot |
| `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` | Client Component | Add/edit individual stock holdings within a snapshot |
| `src/app/(authorized)/assets/stocks/SummaryCards.tsx` | Client Component | Display AUD/USD totals with P/L summaries |

### Backend API

| File | Type | Purpose |
|------|------|---------|
| `src/server/trpc/router/stock-asset.ts` | tRPC Router | API endpoints (4 queries, 5 mutations); all protected by NextAuth |
| `src/server/controllers/stock-asset.controller.ts` | Controller | Request handling, session extraction, error handling |
| `src/server/services/stock-asset.service.ts` | Service | Business logic: CRUD, aggregations, date-range filtering |
| `src/server/schema/stock-asset.schema.ts` | Zod Schemas | Input validation for all endpoints |

### Database & Types

| File | Type | Purpose |
|------|------|---------|
| `prisma/schema.prisma` | Prisma Schema | Models: `PortfolioSnapshot`, `StockHolding`, relations |
| `src/types/stock-asset.types.ts` | TypeScript Types | Type exports: `StockHoldingWithAccount`, etc. |
| `src/utils/stock-asset-calculations.ts` | Utilities | Calculations: P/L, holding periods, term status, formatting |

## Database Models

### PortfolioSnapshot
- **Primary Key**: `id` (CUID)
- **Foreign Keys**:
  - `userId` → `User.id` (cascade delete)
- **Fields**:
  - `snapshotDate: DateTime` — date of the snapshot
  - `createdAt, updatedAt: DateTime`
- **Relations**:
  - `holdings: StockHolding[]` — all holdings in this snapshot
- **Indexes**:
  - `(userId, snapshotDate)` — for efficient fiscal year queries

### StockHolding
- **Primary Key**: `id` (CUID)
- **Foreign Keys**:
  - `snapshotId` → `PortfolioSnapshot.id` (cascade delete)
  - `accountId` → `Business.id` (type=BROKERAGE)
- **Fields**:
  - `ticker: String` — stock symbol (e.g., "CBA", "VAS")
  - `companyName: String` — company name
  - `quantity: Decimal` — shares held
  - `buyPrice: Decimal @db.Money` — purchase price per share
  - `buyDate: DateTime` — purchase date
  - `currentPrice: Decimal @db.Money` — current price (manually updated)
  - `currency: CurrencyEnumType` — AUD or USD
  - `plannedTerm: InvestmentTermEnumType` — SHORT/MID/LONG
  - `salePrice: Decimal? @db.Money` — sale price (if sold)
  - `saleDate: DateTime?` — sale date (if sold)
  - `soldQuantity: Decimal?` — quantity sold (partial sales supported)
  - `createdAt, updatedAt: DateTime`
- **Indexes**:
  - `(snapshotId)`, `(accountId)`, `(ticker)`

## Key Validations

### Input Constraints (Zod Schemas)
- **snapshotDate**: Required, must be a valid date
- **ticker**: Non-empty string, max 10 chars (e.g., "CBA", "VAS.AX")
- **companyName**: Non-empty string
- **quantity**: Decimal, must be > 0
- **buyPrice, currentPrice**: Decimal, must be ≥ 0
- **buyDate**: Valid date, cannot be in future
- **currency**: Must be valid `CurrencyEnumType` (AUD/USD)
- **plannedTerm**: Must be valid `InvestmentTermEnumType` (SHORT/MID/LONG)
- **accountId**: Must belong to user and be type=BROKERAGE

### Business Rules
- Each holding must belong to an account owned by the authenticated user
- Account must have type=BROKERAGE
- Snapshot date can be any date (including historical or future for planning)
- Partial sales: `soldQuantity` ≤ `quantity`
- Zero quantity after sale: not allowed; if fully sold, keep quantity and set appropriate `soldQuantity`
- Holdings are immutable within a snapshot; edit creates new holding in new snapshot

## Route Path

- **Actual Route**: `/assets/stocks` (not `/cashflow/stocks` as initially specified in PRD)
- **Entry Point**: `src/app/(authorized)/assets/stocks/page.tsx`
- **Navigation Path**: Assets → Stocks (in sidebar navigation)

## Fiscal Year Integration

- **CalendarYear Model**: Used to filter snapshots by fiscal year (type=FISCAL)
- **Date-Range Resolution**: Controller converts `calendarYearId` to `fromDate..toDate` using `CalendarYear.fromYear/fromMonth` and `CalendarYear.toYear/toMonth`
- **Service Layer**: `getStockSnapshots()` accepts `{ fromDate?, toDate? }` filter
- **UI**: Fiscal year selector at top of page, snapshot selector updates based on year selection

## Currency Support

- **Multi-currency**: Separate totals for AUD and USD (no conversion)
- **Per-Holding Currency**: Each `StockHolding.currency` specifies its currency
- **Aggregation**: Service and UI group totals by currency
- **Display**: Summary cards show separate AUD and USD cards

## Calculations

All calculations are:
1. **Computed on-the-fly** in service layer (`getSnapshotTotals()`)
2. **Formatted for display** via `src/utils/stock-asset-calculations.ts`

### Cost Basis
```
costBasis = buyPrice × quantity
```

### Market Value
```
marketValue = currentPrice × (quantity - soldQuantity || 0)
```

### Unrealized P/L (unsold holdings)
```
unrealizedPL = marketValue - costBasis
unrealizedPLPercent = (unrealizedPL / costBasis) × 100
```

### Realized P/L (sold holdings)
```
realizedPL = (salePrice × soldQuantity) - (buyPrice × soldQuantity)
```

### Holding Period (in months)
```
holdingPeriod = differenceInMonths(saleDate || snapshotDate, buyDate)
```

### CGT Discount Eligibility
- **Eligible if**: `holdingPeriod ≥ 12 months` (Australian CGT 50% discount for >= 12 months)
- **Calculation Point**: If sold, check at sale date; if unsold, check at snapshot date
- **Display**: Checkmark badge if eligible

## Known Gaps vs. PRD

### Not Yet Implemented (TODOs)
1. **Prefill from previous snapshot** (PRD 4.4)
   - Feature: When creating new snapshot, form should pre-populate with most recent holdings
   - Status: Business logic ready (`getMostRecentSnapshot()`)
   - UI: `NewSnapshotModal` needs to call query and populate `useFieldArray`
   - Spec: `spec/asset-stocks-tracking/add-holding-improvements/`
   
2. **Snapshot date editing** (PRD 4.4 - Priority: Low)
   - Feature: Edit modal to allow changing snapshot date after creation
   - Status: No current implementation
   - Notes: Would require copying snapshot to new date and deleting old

### Implemented (Closed)
3. ~~**Add holding to existing snapshot**~~ ✅ **CLOSED** (PRD 4.5)
   - Was: API endpoint exists, UI not integrated
   - Now: `HoldingFormModal` + `createHolding` wired via "Add Holding" button per account accordion in `StockAssetsClient`
   - Remaining UX polish: Account pre-selection — tracked in `spec/asset-stocks-tracking/add-holding-improvements/`

### Display-Only, Not Full Workflow
1. **CGT Discount Calculation** (PRD 4.6)
   - Current: Checkbox on UI showing if eligible (≥12 months)
   - NOT: Full tax workflow, ATO integration, or reporting
   - Scope: Display-only calculation for user awareness

## UI Component Structure

### Page Layout
```
Page (Server) ──→ initialData (calendarYears, selectedYear)
  └─ StockAssetsClient (Client)
      ├─ Fiscal Year Selector
      ├─ Snapshot Selector
      ├─ SummaryCards (AUD/USD totals)
      ├─ Account Accordions
      │   └─ Holdings Table (per account)
      ├─ NewSnapshotModal
      └─ HoldingFormModal
```

### State Management
- **Server State**: Calendar years, selected fiscal year (URL params)
- **Client State**: 
  - Selected snapshot ID
  - Editing holding (null or StockHoldingWithAccount)
  - Modal open/close states
  - Delete confirmation state
- **Data Fetching**: tRPC hooks (`useQuery`, `useMutation`)

## Testing Considerations

### Unit Tests
- Calculation functions (P/L, holding period, CGT eligibility)
- Input validation (Zod schemas)
- Date-range resolution from CalendarYear

### Integration Tests
- Full snapshot CRUD flow
- Multi-account aggregation
- Date-range filtering by fiscal year
- User isolation (userId scoping)

### E2E Tests
- User creates snapshot with multiple holdings
- Edit and delete holdings
- Fiscal year switching updates display
- Summary cards update correctly

## Performance Considerations

- **Indexes**: `(userId, snapshotDate)` for fast fiscal year queries
- **N+1**: Service layer uses `include: { holdings: { include: { account } } }` to prevent N+1
- **Aggregation**: Computed on-demand in service layer; no separate totals table
- **Caching**: tRPC queries can be revalidated after mutations

## Security & Privacy

- **User Scoping**: All queries filtered by authenticated `userId`
- **Account Ownership**: Service verifies all `accountId`s belong to user and are type=BROKERAGE
- **Session Injection**: `userId` extracted from NextAuth session; never passed from client
- **Error Handling**: Generic errors returned to client; sensitive details logged server-side
