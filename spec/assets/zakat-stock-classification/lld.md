# Zakat Stock Classification — Low Level Design

## Phase Map

| Phase | Scope | Key Files |
|-------|-------|----------|
| 1 | Calculation utils + tRPC | `src/utils/zakat-calculations.ts`, `src/server/api/routers/stock-asset.ts` |
| 2 | Stocks badges | `src/app/(authorized)/assets/stocks/_components/ZakatBasisBadge.tsx`, `columns.tsx`, `HoldingFormModal.tsx` |
| 3 | Zakat page button + modal | `src/app/(authorized)/zakat/ZakatCalculationPanel.tsx`, `ZakatCalculationModal.tsx`, `form.tsx` |

---

## Phase 1: Calculation Utilities & tRPC

### TypeScript Interfaces

```typescript
export type ZakatBasis = 'MARKET_VALUE' | 'COST_BASIS';

export type HoldingZakatSummary = {
  holdingId: string;
  ticker: string;
  companyName: string;
  plannedTerm: 'SHORT_TERM' | 'MID_TERM' | 'LONG_TERM';
  basis: ZakatBasis; // per PO: cost basis for long-term preserves investment intent
  zakatableValue: number;
  costBasis: number;
  marketValue: number;
  zakatAmount: number;
  currency: 'AUD' | 'USD';
  holdingPeriodMonths: number;
  termWarning: boolean;
};

export type ZakatPortfolioSummary = {
  snapshotDate: Date;
  holdings: HoldingZakatSummary[];
  subtotalShortTerm: number;
  subtotalLongTerm: number;
  totalZakatableValue: number;
  totalZakatAmount: number;
  usdHoldingsExcluded: number;
  holdingsWithWarning: number;
};
```

### Zod Schemas

```typescript
import { z } from 'zod';

export const ZakatBasisSchema = z.enum(['MARKET_VALUE', 'COST_BASIS']);

export const HoldingZakatSummarySchema = z.object({
  holdingId: z.string(),
  ticker: z.string(),
  companyName: z.string(),
  plannedTerm: z.enum(['SHORT_TERM', 'MID_TERM', 'LONG_TERM']),
  basis: ZakatBasisSchema,
  zakatableValue: z.number(),
  costBasis: z.number(),
  marketValue: z.number(),
  zakatAmount: z.number(),
  currency: z.enum(['AUD', 'USD']),
  holdingPeriodMonths: z.number(),
  termWarning: z.boolean(),
});

export const ZakatPortfolioSummarySchema = z.object({
  snapshotDate: z.date(),
  holdings: z.array(HoldingZakatSummarySchema),
  subtotalShortTerm: z.number(),
  subtotalLongTerm: z.number(),
  totalZakatableValue: z.number(),
  totalZakatAmount: z.number(),
  usdHoldingsExcluded: z.number(),
  holdingsWithWarning: z.number(),
});
```

### Function Signatures

```typescript
export function getZakatBasis(plannedTerm: 'SHORT_TERM' | 'MID_TERM' | 'LONG_TERM'): ZakatBasis;
export function computeHoldingZakat(holding: /* see interface */, snapshotDate: Date): HoldingZakatSummary;
export function computePortfolioZakat(holdings: /* StockHolding[] */, snapshotDate: Date): ZakatPortfolioSummary;
```

### tRPC
- Add `getZakatPortfolioSummary({ zakatCalendarYearId })` to `stock-asset` router.
- Returns `ZakatPortfolioSummary | null`.

### TDD Test Cases

| Test | Type | Verifies |
|------|------|----------|
| All long-term holdings | Unit | Cost basis used for all, correct subtotal/total |
| All short-term holdings | Unit | Market value used for all, correct subtotal/total |
| Mixed holdings | Unit | Correct basis per holding, correct totals |
| Partial sale | Unit | Cost basis uses full original quantity for long-term |
| USD holdings | Unit | Excluded from AUD total, note shown |
| No buyDate | Unit | Holding period = 0, warning shown |
| No snapshot | Integration | Returns null, disables button |

---

## Phase 2: Stocks Table Badges

### Components
- `ZakatBasisBadge.tsx`: Renders badge (🟢 Cost, 🔵 Market, ⚠ Review) with tooltip.
- Add badge column to `columns.tsx`.
- Add contextual copy to `HoldingFormModal.tsx` under term selector.

### TDD Test Cases

| Test | Type | Verifies |
|------|------|----------|
| Badge shows correct color | Unit | Based on plannedTerm and holding period |
| Tooltip explains basis | Unit | Tooltip content matches PO rationale |
| Warning badge for <12mo | Unit | ⚠ badge shown for long-term <12mo |
| Form hint appears | Integration | Contextual copy shown when Zakat year exists |

---

## Phase 3: Zakat Page Button & Modal

### Components
- `ZakatCalculationPanel.tsx`: Button + warning banner
- `ZakatCalculationModal.tsx`: Breakdown modal
- Integrate into `form.tsx` below `amountDue`

### TDD Test Cases

| Test | Type | Verifies |
|------|------|----------|
| Button visible with Zakat year | Integration | Button appears when year selected |
| Modal shows breakdown | Integration | Modal opens, shows correct per-holding breakdown |
| Use amount fills input | Integration | "Use this amount" fills `amountDue` |
| USD holdings note | Integration | Note shown if all holdings are USD |
| Disabled state | Integration | Button disabled if no snapshot |

---

## File Inventory

| File | Action | Description |
|---|---|---|
| `src/utils/zakat-calculations.ts` | CREATE | Calculation logic |
| `src/server/api/routers/stock-asset.ts` | MODIFY | Add tRPC query |
| `src/app/(authorized)/assets/stocks/_components/ZakatBasisBadge.tsx` | CREATE | Badge component |
| `src/app/(authorized)/assets/stocks/_table/columns.tsx` | MODIFY | Add badge column |
| `src/app/(authorized)/assets/stocks/_components/HoldingFormModal.tsx` | MODIFY | Add form hint |
| `src/app/(authorized)/zakat/ZakatCalculationPanel.tsx` | CREATE | Button/banner |
| `src/app/(authorized)/zakat/ZakatCalculationModal.tsx` | CREATE | Modal |
| `src/app/(authorized)/zakat/form.tsx` | MODIFY | Integrate panel/modal |
| `src/app/(authorized)/zakat/_types.ts` | MODIFY | Add types |
| `src/utils/__tests__/zakat-calculations.test.ts` | CREATE | Unit tests |

---

## Edge Case Handling Table

| Scenario | Behaviour |
|---|---|
| ETF down 40% from cost | Cost basis used (per PO, preserves intent) |
| Partial sale of long-term ETF | Cost basis uses full original quantity |
| New user, no holdings | Button disabled, message shown |
| All USD holdings | Zero AUD, note shown |
| No buyDate | Holding period = 0, warning badge |
| Multiple snapshots | Use most recent on/before Zakat year end |

---

## Example Calculation Walkthroughs

### ETF Cost Basis (Long-term)
- Buy 100 units @ $100 = $10,000
- Current price $60 (down 40%)
- Zakat basis: $10,000 (cost), not $6,000 (market)
- Zakat due: $10,000 × 2.5% = $250

### Short-term Market Value
- Buy 50 units @ $20 = $1,000
- Current price $30
- Zakat basis: $1,500 (market)
- Zakat due: $1,500 × 2.5% = $37.50

### Partial Sale (Long-term)
- Buy 200 units @ $50 = $10,000
- Sell 100 units, 100 remain
- Zakat basis: $10,000 (original cost, not reduced)
- Zakat due: $10,000 × 2.5% = $250

---

## Migration Notes
- No schema changes required; all fields exist.
- No migrations needed.

---

## Integration Points
- Calculation utils: `src/utils/zakat-calculations.ts`
- tRPC: `src/server/api/routers/stock-asset.ts`
- UI: Stocks table, Zakat page, modal

---

## Acceptance Criteria
- All 8 PO decisions are traceable in code and UI
- Edge cases handled as per table
- TDD tests cover all scenarios
- No scope creep beyond PO rationale


## Summary

This feature adds a portfolio-derived Zakat calculation engine to the existing `/zakat` page. It reuses
`StockHolding.plannedTerm` as the classification source, adds pure calculation utilities, extends the
Zakat form with a "Calculate from Portfolio" suggestion flow, and decorates the Stocks holdings table
with per-holding Zakat classification badges and explanations.

---

## 1. Calculation Utility — `src/utils/zakat-calculations.ts`

Pure functions with no side effects. All inputs are plain numbers (no Prisma types).

```typescript
// Zakat valuation basis per holding
export type ZakatBasis = 'MARKET_VALUE' | 'COST_BASIS';

export type HoldingZakatSummary = {
  holdingId:      string;
  ticker:         string;
  companyName:    string;
  plannedTerm:    'SHORT_TERM' | 'MID_TERM' | 'LONG_TERM';
  basis:          ZakatBasis;         // derived from plannedTerm
  zakatableValue: number;             // the value used in Zakat calculation
  costBasis:      number;             // buyPrice × quantity (pre-sold)
  marketValue:    number;             // currentPrice × remainingQuantity
  zakatAmount:    number;             // zakatableValue × 0.025
  currency:       'AUD' | 'USD';
  holdingPeriodMonths: number;
  termWarning:    boolean;            // true if period < 12m but term is MID/LONG
};

export type ZakatPortfolioSummary = {
  snapshotDate:        Date;
  holdings:            HoldingZakatSummary[];  // AUD only
  subtotalShortTerm:   number;  // sum of market values for SHORT_TERM
  subtotalLongTerm:    number;  // sum of cost bases for MID + LONG
  totalZakatableValue: number;  // subtotalShortTerm + subtotalLongTerm
  totalZakatAmount:    number;  // totalZakatableValue × 0.025
  usdHoldingsExcluded: number;  // count of USD holdings not included
  holdingsWithWarning: number;  // count with termWarning = true
};

export const ZAKAT_RATE = 0.025; // 2.5%

// Maps plannedTerm → ZakatBasis
export function getZakatBasis(plannedTerm: InvestmentTermEnumType): ZakatBasis {
  return plannedTerm === 'SHORT_TERM' ? 'MARKET_VALUE' : 'COST_BASIS';
}

// Computes a single holding's Zakat summary
export function computeHoldingZakat(
  holding: Pick<StockHolding, 'id' | 'ticker' | 'companyName' | 'plannedTerm' |
    'buyPrice' | 'quantity' | 'currentPrice' | 'soldQuantity' | 'currency' | 'buyDate'>,
  snapshotDate: Date,
): HoldingZakatSummary

// Computes portfolio-level Zakat summary (AUD only)
export function computePortfolioZakat(
  holdings: StockHolding[],
  snapshotDate: Date,
): ZakatPortfolioSummary
```

### Business Rules Encoded

| Rule | Implementation |
|---|---|
| SHORT_TERM → market value | `currentPrice × (quantity - soldQuantity)` |
| MID/LONG_TERM → cost basis | `buyPrice × quantity` (total originally invested, pre-sale) |
| Partial sales (MID/LONG) | Cost basis uses **full original quantity**, not `(quantity - soldQuantity)` — the investment intent was long-term; partial liquidation doesn't recharacterise the remaining position |
| USD holdings excluded | `currency !== 'AUD'` holdings are skipped; count surfaced in summary |
| Fully sold holdings | `isFullySold === true` → `zakatableValue = 0`; still shown in breakdown with $0 |
| Missing buyDate | Holding period = 0 months; `termWarning = true` if term is MID/LONG |
| Term/period mismatch warning | `holdingPeriodMonths < 12 && plannedTerm !== 'SHORT_TERM'` |

---

## 2. Server Layer Extension

### New tRPC query — `stockAsset.getZakatPortfolioSummary`

```typescript
// Input
{ zakatCalendarYearId: string }

// Resolves the Zakat year's date range from CalendarYear.toYear/toMonth
// Finds the most recent PortfolioSnapshot on or before that date
// Calls computePortfolioZakat() on its holdings
// Returns ZakatPortfolioSummary | null (null if no snapshot found)
```

Added to `src/server/api/routers/stock-asset.ts` — protected, scoped by `userId`.

### No schema changes required
`StockHolding.plannedTerm` already exists. No migration needed.

---

## 3. Zakat Page Changes — `/zakat`

### 3.1 ZakatForm Extension (`form.tsx` or new `ZakatCalculationPanel.tsx`)

**"Calculate from Portfolio" button** — shown beneath the `amountDue` input field.

```
┌─────────────────────────────────────────────────────────────┐
│  Zakat Year:  [ 2024–2025 ▼ ]                               │
│                                                             │
│  Amount Due:  [ $2,450.00        ]                          │
│               ┌───────────────────────────────────┐         │
│               │ 📊 Calculate from Portfolio       │         │
│               │ Based on snapshot: 30 Jun 2025    │         │
│               └───────────────────────────────────┘         │
│                                                             │
│  ⚠ 2 holdings have term/period mismatches. Review below.   │
└─────────────────────────────────────────────────────────────┘
```

**Clicking "Calculate from Portfolio":**
1. Calls `stockAsset.getZakatPortfolioSummary({ zakatCalendarYearId })`
2. Opens a `ZakatCalculationModal` (see §3.2)
3. Modal has "Use this amount: $X,XXX.XX" → populates `amountDue` input (does not auto-save)
4. User reviews, optionally edits, then saves via existing "Save Obligation" flow

**No snapshot found state:** Button shows "No portfolio snapshot found before [date]. Add one on the Stocks page."

### 3.2 `ZakatCalculationModal.tsx` — Breakdown View

```
┌────────────────────────────────────────────────────────────────────────┐
│  📊 Zakat Calculation — 2024–2025                          [✕ Close]  │
│  Based on portfolio snapshot: 30 June 2025                             │
├────────────────────────────────────────────────────────────────────────┤
│  HOLDING             TERM        BASIS         VALUE      ZAKAT (2.5%) │
│  ─────────────────────────────────────────────────────────────────────│
│  VGS (Vanguard Int.)  Long-term  Cost Basis    $45,200    $1,130.00    │
│  A200 (ASX 200 ETF)   Long-term  Cost Basis    $28,000    $700.00      │
│  CBA (Commonwealth)   Short-term Market Value  $9,800     $245.00      │
│  WBC ⚠               Long-term  Cost Basis    $11,600    $290.00      │
│    └─ ⚠ Held 8 months — consider reviewing term classification         │
│                                                                        │
│  ── AUD Subtotals ──────────────────────────────────────────────────── │
│  Long/Mid-term (cost basis)                   $84,800    $2,120.00     │
│  Short-term (market value)                     $9,800    $  245.00     │
│  ─────────────────────────────────────────────────────────────────────│
│  Total Zakatable Value:                       $94,600                  │
│  Total Zakat (2.5%):                                      $2,365.00    │
│                                                                        │
│  ℹ  3 USD holdings excluded (no AUD conversion in scope)              │
│  ℹ  Zakat rate: 2.5% (1/40). Nisab: ~AU$8,000 (gold standard 2025)   │
│  ℹ  Add amounts for gold, property, receivables manually if applicable│
│                                                                        │
│  [ Use $2,365.00 as Amount Due ]              [ Cancel ]              │
└────────────────────────────────────────────────────────────────────────┘
```

**Key UX notes:**
- `⚠` badges link to a tooltip: "This holding has been held for N months but is classified as Long-term.
  If this is a speculative/trading position, change the term on the Stocks page."
- "Cost Basis" and "Market Value" have an info icon `ⓘ` with tooltip explaining the rule in plain English:
  - *Cost Basis: "You pay Zakat on what you originally invested, not the current price.
    This applies to buy-and-hold investments and ETFs (MID/LONG term)."*
  - *Market Value: "You pay Zakat on what the shares are worth today.
    This applies to short-term / trading positions."*
- Modal is read-only except for the "Use this amount" action
- The Zakat rate line and Nisab note are informational; no enforcement

---

## 4. Stocks Holdings Table — Classification Badges

### 4.1 Zakat Badge Column

Add a lightweight "Zakat" column to the holdings table in `StockAssetsClient.tsx` / `columns.tsx`.

```
| TERM        | ZAKAT BASIS    |
|-------------|----------------|
| Short-term  | 🔵 Market Val  |
| Mid-term    | 🟢 Cost Basis  |
| Long-term   | 🟢 Cost Basis  |
| (+ warning) | ⚠ Review Term |
```

Badge component:

```tsx
// ZakatBasisBadge.tsx  (co-located in _components/)
type Props = {
  plannedTerm: InvestmentTermEnumType;
  holdingPeriodMonths: number;
};

// Renders:
// SHORT_TERM  → blue  badge "Market Value"
// MID/LONG    → green badge "Cost Basis"
// + warning   → amber badge "⚠ Review" with tooltip
```

### 4.2 Tooltip content (plain language)

```
Long-term / Mid-term → "Cost Basis":
"For buy-and-hold investments, Zakat is calculated on your original
investment amount (cost basis), not today's market price."

Short-term → "Market Value":
"For trading/speculative holdings, Zakat is calculated on the
current market price of your position."

⚠ Review Term:
"You've classified this as Long-term but it's been held only N months.
If you're actively trading this position, update the term to Short-term
on the edit form so Zakat is calculated correctly."
```

### 4.3 Term field in `HoldingFormModal`

Add contextual copy beneath the existing `plannedTerm` select:

```
Planned Term: [ Long-term ▼ ]
              ┌────────────────────────────────────────────────────┐
              │ ℹ Zakat: Long/Mid-term → cost basis                │
              │          Short-term   → market value               │
              └────────────────────────────────────────────────────┘
```

This copy appears only when a ZAKAT calendar year exists for the user
(check via context or a simple boolean prop passed from the server).

---

## 5. Edge Case Handling

| Scenario | Behaviour |
|---|---|
| ETF held 5 yrs, market value dropped 40% | Cost basis used — Zakat is on $50K invested, not $30K market value. User sees both values in breakdown modal. No special handling needed; this is correct per Islamic finance rules. |
| Partial sale of long-term ETF (sold 50%) | Cost basis uses **original full quantity × buyPrice**; `soldQuantity` is ignored for Zakat basis. Fully sold holdings show $0 Zakat value. |
| New user, year 1, no portfolio snapshot | "Calculate from Portfolio" shows "No snapshot found — add your holdings on the Stocks page first." Manual `amountDue` entry still fully functional. |
| Holding with no `buyDate` | `holdingPeriodMonths = 0`; `termWarning = true` for MID/LONG. App nudges: "Add a buy date on the Stocks page for accurate term verification." |
| All holdings are USD | `totalZakatableValue = 0`; modal shows "All holdings are in USD — AUD conversion not available. Enter amount manually." |
| User has no `PortfolioSnapshot` at all | Button disabled with tooltip: "No portfolio data. Add a snapshot on the Stocks page." |
| Multiple snapshots near Zakat year end | Uses "most recent snapshot on or before `CalendarYear.toYear/toMonth` end date" — same strategy as net worth dashboard. |

---

## 6. Net Worth Dashboard — No Changes

The `NetWorthDashboardClient.tsx` trend chart continues to use market value for all holdings.
The Zakat valuation basis (cost basis for long-term) is surfaced **only** on:
1. The `/zakat` page (calculation modal + suggestion panel)
2. The `/assets/stocks` holdings table (Zakat badge column)

This separation is intentional: market value is the wealth lens; Zakat basis is the compliance lens.
These are different questions answered on different pages.

---

## 7. Component & File Inventory

| File | Action | Description |
|---|---|---|
| `src/utils/zakat-calculations.ts` | **CREATE** | Pure Zakat calculation functions: `computeHoldingZakat`, `computePortfolioZakat`, `getZakatBasis`, `ZAKAT_RATE` |
| `src/server/api/routers/stock-asset.ts` | **MODIFY** | Add `getZakatPortfolioSummary` query |
| `src/app/(authorized)/zakat/ZakatCalculationModal.tsx` | **CREATE** | Breakdown modal with line-by-line view and "Use this amount" CTA |
| `src/app/(authorized)/zakat/ZakatCalculationPanel.tsx` | **CREATE** | "Calculate from Portfolio" button + mismatch warning banner |
| `src/app/(authorized)/zakat/form.tsx` | **MODIFY** | Embed `ZakatCalculationPanel` below `amountDue` input |
| `src/app/(authorized)/zakat/_types.ts` | **MODIFY** | Add `ZakatPortfolioSummary`, `HoldingZakatSummary`, `ZakatBasis` types |
| `src/app/(authorized)/assets/stocks/_components/ZakatBasisBadge.tsx` | **CREATE** | Badge component: green/blue/amber based on term + period warning |
| `src/app/(authorized)/assets/stocks/_table/columns.tsx` | **MODIFY** | Add Zakat basis column using `ZakatBasisBadge` |
| `src/app/(authorized)/assets/stocks/_components/HoldingFormModal.tsx` | **MODIFY** | Add contextual Zakat copy beneath `plannedTerm` select |
| `src/utils/__tests__/zakat-calculations.test.ts` | **CREATE** | Unit tests for all calculation functions + edge cases |

---

## 8. Acceptance Criteria

- [ ] "Calculate from Portfolio" button is shown when a Zakat year is selected
- [ ] Clicking it opens `ZakatCalculationModal` with correct per-holding breakdown
- [ ] SHORT_TERM holdings show market value; MID/LONG show cost basis
- [ ] "Use $X.XX as Amount Due" pre-fills the `amountDue` input (does not auto-save)
- [ ] Holdings with `holdingPeriodMonths < 12` and term `MID_TERM`/`LONG_TERM` show `⚠` warning
- [ ] USD holdings are excluded with an explanatory note
- [ ] Fully-sold holdings appear in breakdown with $0 Zakat value
- [ ] If no AUD snapshot exists before Zakat year end, button shows disabled state with explanation
- [ ] Zakat badge column in stocks table shows correct basis for each holding
- [ ] Tooltip on badge explains the rule in plain English (no Arabic/religious terminology)
- [ ] Contextual Zakat copy appears in `HoldingFormModal` beneath `plannedTerm` select
- [ ] No changes to net worth dashboard market-value totals
- [ ] `computePortfolioZakat` unit tests cover: all-long-term, all-short-term, mixed, partial sale, USD exclusion, no buyDate, empty holdings

---

## 9. Open Questions for Implementation

| # | Question | Recommended default |
|---|---|---|
| Q1 | Should `ZakatCalculationModal` be a drawer (slide-in) or a centred modal? | Centred modal — same pattern as existing confirm dialogs |
| Q2 | Should the Zakat badge column be visible by default or opt-in (toggleable)? | Visible by default — it's the most contextually relevant new information |
| Q3 | Do we want a Nisab input field (user enters their nisab threshold)? | No for MVP — show a static informational note; user is responsible |
| Q4 | Should `amountDue` be auto-populated on page load if a portfolio summary is available? | No — always require explicit "Calculate from Portfolio" click to avoid confusing manual users |
