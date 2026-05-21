# Snapshot Entry Redesign — Low-Level Design (LLD)

## Phase Map

| Phase | Description | Files Changed |
|-------|-------------|---|
| 1 | Modal: tab toggle + conditional rendering for stocks/cash | `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` |
| 2 | Schema: allow cash-only snapshots (validation) | `src/server/schema/stock-asset.schema.ts` |
| 3 | Summary: unified Stocks + Cash + Total display | `src/app/(authorized)/assets/stocks/SummaryCards.tsx` |

**Dependencies:** 1 → 2 (validation check) → 3 (display)

---

## Phase 1: Modal UI Redesign

### Goal
Add tab toggle to `NewSnapshotModal` so users can switch between adding stock holdings and cash balances. Both arrays are collected and sent to `createSnapshot` on submit.

### Implementation Details

#### State Management
```typescript
// Add to NewSnapshotModal component
const [activeEntryTab, setActiveEntryTab] = useState<'stocks' | 'cash'>('stocks');

// Existing field arrays + cash state remain unchanged:
const { fields, append, remove } = useFieldArray({ control, name: 'holdings' });
const [cashBalanceAmounts, setCashBalanceAmounts] = useState<Record<string, { AUD: number; USD: number }>>({});
```

#### Tab Control UI
Place **after** the "USD → AUD Rate" field, **before** "Stock Holdings" section:

```typescript
<div className='flex gap-2 border-b border-border mb-4'>
  <button
    type='button'
    onClick={() => setActiveEntryTab('stocks')}
    className={`px-4 py-2 font-medium transition-colors ${
      activeEntryTab === 'stocks'
        ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
        : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    📈 Stocks
  </button>
  <button
    type='button'
    onClick={() => setActiveEntryTab('cash')}
    className={`px-4 py-2 font-medium transition-colors ${
      activeEntryTab === 'cash'
        ? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground hover:text-foreground'
    }`}
  >
    💰 Cash
  </button>
</div>
```

#### Conditional Rendering

**Stocks Section** (show if `activeEntryTab === 'stocks'`):
```typescript
{activeEntryTab === 'stocks' && (
  <div>
    <div className='flex justify-between items-center mb-4'>
      <h3 className='text-lg font-semibold text-foreground'>Stock Holdings</h3>
      {latestSnapshot && (
        <Button type='button' variant='secondary' onClick={handlePrefill} disabled={isLoadingPrefill}>
          {isLoadingPrefill ? 'Loading...' : '↩ Prefill from previous'}
        </Button>
      )}
    </div>
    {/* existing holdings fieldArray code */}
    <button type='button' onClick={() => append({...})}>
      <Plus className='w-4 h-4' />
      Add Another Holding
    </button>
  </div>
)}
```

**Cash Section** (show if `activeEntryTab === 'cash'`):
```typescript
{activeEntryTab === 'cash' && (
  <div>
    <div>
      <h3 className='text-lg font-semibold text-foreground'>💰 Idle Cash Balances</h3>
      <p className='text-sm text-muted-foreground mt-1'>Enter unallocated cash sitting in each brokerage account</p>
    </div>
    {(() => {
      const watchedHoldings = watch('holdings');
      const uniqueAccountIds = [...new Set(watchedHoldings.filter(h => h.accountId).map(h => h.accountId))];
      
      if (uniqueAccountIds.length === 0) {
        return (
          <div className='mt-4 p-4 bg-muted rounded-lg text-muted-foreground text-sm'>
            Add a stock holding first to select an account for cash entry
          </div>
        );
      }
      
      return (
        <div className='mt-4 space-y-4'>
          {uniqueAccountIds.map(accountId => (
            <div key={accountId} className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              {/* AUD + USD cash inputs */}
            </div>
          ))}
        </div>
      );
    })()}
  </div>
)}
```

#### Form Submission (unchanged)
```typescript
const processedData = {
  ...data,
  holdings: [...],
  cashBalances: Object.entries(cashBalanceAmounts)
    .flatMap(([accountId, amounts]) => [
      ...(amounts.AUD > 0 ? [{ accountId, currency: 'AUD' as const, amount: amounts.AUD }] : []),
      ...(amounts.USD > 0 ? [{ accountId, currency: 'USD' as const, amount: amounts.USD }] : []),
    ]),
};
await createSnapshot.mutateAsync(processedData);
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| Toggle switches between tabs | unit | `activeEntryTab` state updates on button click |
| Stocks section visible on 'stocks' tab | unit | Conditional rendering shows holdings fieldArray when tab === 'stocks' |
| Cash section visible on 'cash' tab | unit | Conditional rendering shows cash inputs when tab === 'cash' |
| Both stocks and cash submitted together | integration | Form submission includes both arrays in payload |
| Prefill loads both stocks and cash | integration | `handlePrefill` populates `holdings` fieldArray + `cashBalanceAmounts` state |

---

## Phase 2: Schema Validation Update

### Goal
Allow snapshots with cash but no stocks (currently requires at least 1 holding).

### Changes to `stock-asset.schema.ts`

```typescript
// Current (line 54-61):
export const createStockSnapshotSchema = object({
  snapshotDate: z.coerce.date({ required_error: 'Snapshot date is required' }),
  usdToAudRate: z.coerce.number().positive().optional().nullable(),
  holdings: z
    .array(stockHoldingEntrySchema)
    .min(1, 'At least one holding is required'),  // ← REMOVE THIS
  cashBalances: z.array(cashBalanceEntrySchema).optional(),
});

// New:
export const createStockSnapshotSchema = object({
  snapshotDate: z.coerce.date({ required_error: 'Snapshot date is required' }),
  usdToAudRate: z.coerce.number().positive().optional().nullable(),
  holdings: z.array(stockHoldingEntrySchema).optional(),
  cashBalances: z.array(cashBalanceEntrySchema).optional(),
}).refine(
  data => (data.holdings?.length ?? 0) + (data.cashBalances?.length ?? 0) > 0,
  {
    message: 'Add at least one holding or cash balance',
    path: ['holdings'],  // focus on holdings field in UI
  }
);
```

**Rationale:** 
- `.optional()` allows empty arrays
- `.refine()` ensures at least ONE of the two arrays has data
- Error path points to `holdings` field (UX: user sees error near first tab)

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| Valid: stocks array only | unit | Zod passes when `holdings.length > 0` and `cashBalances = undefined` |
| Valid: cash array only | unit | Zod passes when `cashBalances.length > 0` and `holdings = undefined` |
| Valid: both arrays | unit | Zod passes when both arrays have entries |
| Invalid: both empty | unit | Zod fails with message 'Add at least one holding or cash balance' |
| Invalid: both undefined | unit | Zod fails (both falsy) |

---

## Phase 3: Summary Cards Redesign

### Goal
Show unified portfolio breakdown: Stocks + Cash = Total Portfolio Value.

### Changes to `SummaryCards.tsx`

#### Type Definition Update
```typescript
// Update interface (line ~14):
interface CurrencyTotalFromService {
  currency: string;
  totalValue: number;           // existing: stocks market value
  totalCash?: number;           // NEW: idle cash for this currency
  totalCostBasis: number;
  totalUnrealizedPL: number;
  totalRealizedPL: number;
  accounts: any[];
}
```

#### Display Logic Update
Replace the "Portfolio Value" section (around line ~100-135) with unified breakdown:

```typescript
// Old (line ~111-120):
<div>
  <p className='text-sm text-muted-foreground mb-1'>Portfolio Value</p>
  <p className='text-2xl font-bold text-foreground'>
    {formatCurrency(total.totalValue, total.currency as any)}
  </p>
</div>

// New:
<div>
  <p className='text-sm text-muted-foreground mb-1'>
    {(total.totalCash ?? 0) > 0 ? 'Total Portfolio Value' : 'Portfolio Value'}
  </p>
  <p className='text-2xl font-bold text-foreground'>
    {formatCurrency((total.totalValue ?? 0) + (total.totalCash ?? 0), total.currency as any)}
  </p>
  {(total.totalCash ?? 0) > 0 && (
    <div className='text-xs text-muted-foreground mt-1 space-y-0.5'>
      <div>Stocks: {formatCurrency(total.totalValue, total.currency as any)}</div>
      <div>Cash: {formatCurrency(total.totalCash, total.currency as any)}</div>
    </div>
  )}
</div>
```

#### AUD Equivalent Update (USD card only)
```typescript
// Line ~224-244: USD → AUD conversion
// Update to include cash:

const totalInAud = (total.totalValue + (total.totalCash ?? 0)) * usdToAudRate;
const stocksInAud = total.totalValue * usdToAudRate;
const cashInAud = (total.totalCash ?? 0) * usdToAudRate;

<div className='flex justify-between items-end'>
  <div>
    <p className='text-xs text-muted-foreground mb-0.5'>Portfolio Value</p>
    <p className='text-lg font-semibold text-foreground'>
      {formatCurrency(totalInAud, 'AUD')}
    </p>
    {(total.totalCash ?? 0) > 0 && (
      <p className='text-xs text-muted-foreground mt-1'>
        Stocks: {formatCurrency(stocksInAud, 'AUD')}, Cash: {formatCurrency(cashInAud, 'AUD')}
      </p>
    )}
  </div>
  <div className='text-right'>
    <p className='text-xs text-muted-foreground mb-0.5'>Invested Amount</p>
    <p className='text-base font-medium text-foreground'>
      {formatCurrency(total.totalCostBasis * usdToAudRate, 'AUD')}
    </p>
  </div>
</div>
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| Show "Portfolio Value" when cash = 0 | unit | Label and value only show stocks total |
| Show "Total Portfolio Value" when cash > 0 | unit | Label changes; value = stocks + cash |
| Show "Stocks | Cash" breakdown when cash > 0 | unit | Breakdown rows visible with correct amounts |
| AUD equiv includes cash (USD card) | unit | Conversion: `(stocks + cash) * rate` |
| P/L logic unchanged | unit | Unrealized/Realized P/L sections unchanged |

---

## File Inventory

| File | Action | Change Description |
|------|--------|---|
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | MODIFY | Add `activeEntryTab` state; add tab toggle buttons; conditionally render stocks/cash sections; keep existing form logic |
| `src/server/schema/stock-asset.schema.ts` | MODIFY | Change `holdings` validation from `.min(1)` to `.optional()`; add `.refine()` to require at least one array has data |
| `src/app/(authorized)/assets/stocks/SummaryCards.tsx` | MODIFY | Add `totalCash` to `CurrencyTotalFromService` type; update display to show Stocks + Cash + Total breakdown; update AUD equiv calculation |

---

## Edge Cases & Integration Points

### Edge Case 1: Cash-Only Snapshot
- **Scenario:** User opens modal, switches to "Cash" tab, adds only cash (no stocks)
- **Expected:** Form submits with empty `holdings: []` + populated `cashBalances`
- **Verify:** Backend doesn't crash; dashboard/asset views handle empty holdings gracefully

### Edge Case 2: Prefill with Both Types
- **Scenario:** User prefills from snapshot with both stocks and cash
- **Expected:** `handlePrefill` populates both `holdings` fieldArray and `cashBalanceAmounts` state
- **Verify:** Both tabs show populated data; form ready to edit

### Edge Case 3: Tab Switch Preserves Data
- **Scenario:** User adds 3 stocks, switches to "Cash" tab, adds cash, switches back to "Stocks" tab
- **Expected:** Original 3 stocks still in the form; no data loss
- **Verify:** `holdings` fieldArray state unchanged when tab switches

### Edge Case 4: Mobile: Tab Control Overflow
- **Scenario:** On small screen, tabs may overflow
- **Expected:** Tabs remain tappable; consider horizontal scroll or stack vertically
- **Verify:** Mobile usability testing; no horizontal scroll of entire modal

### Integration: Summary Cards
- **Scenario:** User creates snapshot with both stocks and cash; navigates to dashboard
- **Expected:** Summary card shows "Total Portfolio Value" with Stocks + Cash breakdown
- **Verify:** `getSnapshotTotals` returns `currencyTotals[].totalCash`; `SummaryCards` renders breakdown

---

## Success Metrics

✅ **Discoverability:** Both "Stocks" and "Cash" tabs equally prominent  
✅ **Simplicity:** Only relevant fields shown per tab (cognitive load reduced)  
✅ **Flexibility:** Users can record cash-only, stocks-only, or mixed snapshots  
✅ **Consistency:** Summary shows unified "Stocks + Cash = Total" (matches user mental model)  
✅ **Completeness:** No TypeScript errors; build passes; existing tests remain green  
✅ **Mobile:** Tab control works on small screens  
