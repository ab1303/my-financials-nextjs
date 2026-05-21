# Snapshot Entry Redesign — Low-Level Design (LLD)

## Phase Map

| Phase | Description | Files Changed |
|-------|-------------|---|
| 1 | Modal: tab toggle + conditional rendering for stocks/cash | `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` |
| 2 | Schema: allow cash-only snapshots (validation) | `src/server/schema/stock-asset.schema.ts` |
| 3 | Summary: unified Stocks + Cash + Total display | `src/app/(authorized)/assets/stocks/SummaryCards.tsx` |
| 4 | Router: add `updateStockSnapshot` mutation | `src/server/trpc/routers/stock-asset.ts` |
| 5 | Service: add update logic to handle stocks + cash | `src/server/services/stock-asset.service.ts` |
| 6 | UI: add Edit button to snapshot detail view; reuse modal for both create/edit | `src/app/(authorized)/assets/stocks/SnapshotView.tsx` + `NewSnapshotModal.tsx` |

**Dependencies:** 
- 1 → 2 → 3 (creation flow, completed)
- 4 → 5 → 6 (update flow, new)
- 6 depends on 5 (needs mutation), 6 depends on 1/2/3 (reuses modal)

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

## Phase 4: Update Mutation (tRPC Router)

### Goal
Add `updateStockSnapshot` mutation to allow updating existing snapshots with new/edited holdings and cash.

### Changes to `src/server/trpc/routers/stock-asset.ts`

```typescript
// Add new mutation alongside createStockSnapshot
export const stockAssetRouter = createTRPCRouter({
  // ... existing mutations
  
  updateStockSnapshot: privateProcedure
    .input(
      createStockSnapshotSchema.extend({
        snapshotId: z.string().cuid(),  // ADD: existing snapshot ID to update
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        // Verify snapshot exists and belongs to user
        const existing = await tx.portfolioSnapshot.findUniqueOrThrow({
          where: { id: input.snapshotId },
          include: { portfolio: true },
        });

        if (existing.portfolio.userId !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

        // Call service to update
        return stockAssetService.updateStockSnapshot(tx, input);
      });
    }),
});
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| Update existing snapshot with new stocks | integration | Mutation updates holdings; old holdings deleted |
| Update snapshot with new cash | integration | Mutation updates cash; old balances updated |
| Update snapshot both stocks + cash | integration | Both arrays updated in single transaction |
| Add cash to stocks-only snapshot | integration | Cash balances inserted for existing stocks |
| Remove all stocks, keep cash | integration | Stocks deleted, cash preserved |
| Forbidden: update another user's snapshot | security | Returns 403 if userId mismatch |

---

## Phase 5: Update Service Logic

### Goal
Implement `updateStockSnapshot` in service layer to handle atomic update of holdings + cash.

### Changes to `src/server/services/stock-asset.service.ts`

Add new export function after `createStockSnapshot`:

```typescript
export async function updateStockSnapshot(
  tx: PrismaClient,
  input: z.infer<typeof createStockSnapshotSchema> & { snapshotId: string },
) {
  const { snapshotId, holdings, cashBalances, snapshotDate, usdToAudRate } = input;

  // 1. Delete existing holdings for this snapshot
  if (holdings && holdings.length > 0) {
    await tx.stockHolding.deleteMany({
      where: { snapshotId },
    });
  }

  // 2. Delete existing cash balances for this snapshot
  if (cashBalances && cashBalances.length > 0) {
    await tx.brokerageCashBalance.deleteMany({
      where: { snapshotId },
    });
  }

  // 3. Create new holdings
  const createdHoldings = holdings && holdings.length > 0
    ? await tx.stockHolding.createMany({
        data: holdings.map((holding) => ({
          snapshotId,
          symbol: holding.symbol,
          accountId: holding.accountId,
          quantityOwned: holding.quantityOwned,
          averageBuyPrice: holding.averageBuyPrice,
          currentPrice: holding.currentPrice,
        })),
      })
    : null;

  // 4. Create new cash balances
  const createdCash = cashBalances && cashBalances.length > 0
    ? await tx.brokerageCashBalance.createMany({
        data: cashBalances.map((cb) => ({
          snapshotId,
          accountId: cb.accountId,
          currency: cb.currency,
          amount: cb.amount,
        })),
      })
    : null;

  // 5. Update snapshot metadata
  const updatedSnapshot = await tx.portfolioSnapshot.update({
    where: { id: snapshotId },
    data: {
      snapshotDate,
      usdToAudRate,
    },
  });

  return { snapshotId: updatedSnapshot.id, createdHoldings, createdCash };
}
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| Delete old holdings before creating new | unit | Old holdings removed via `deleteMany` |
| Delete old cash before creating new | unit | Old cash balances removed |
| Atomic transaction (all-or-nothing) | integration | Prisma transaction rolls back on error |
| Empty arrays handled gracefully | unit | No error if `holdings` or `cashBalances` is empty/undefined |

---

## Phase 6: Edit UI Integration

### Goal
Add "Edit Snapshot" button to snapshot detail view; reuse `NewSnapshotModal` for both create and edit modes.

### Changes to `NewSnapshotModal.tsx`

Enhance component to accept optional `snapshotId` prop for edit mode:

```typescript
interface NewSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId?: string;  // ADD: if present, edit mode; if absent, create mode
}

export function NewSnapshotModal({
  isOpen,
  onClose,
  snapshotId,
}: NewSnapshotModalProps) {
  const isEditMode = !!snapshotId;
  
  // Fetch snapshot data if editing
  const { data: snapshotData, isLoading: isLoadingSnapshot } = 
    trpc.stockAsset.getSnapshotDetails.useQuery(
      { snapshotId: snapshotId! },
      { enabled: isEditMode && isOpen }
    );

  // Use update mutation if editing, create if creating
  const createSnapshot = trpc.stockAsset.createStockSnapshot.useMutation({...});
  const updateSnapshot = trpc.stockAsset.updateStockSnapshot.useMutation({...});

  // Prefill form when snapshot data loads
  useEffect(() => {
    if (isEditMode && snapshotData) {
      reset({
        snapshotDate: snapshotData.snapshotDate,
        usdToAudRate: snapshotData.usdToAudRate ?? undefined,
        holdings: snapshotData.holdings ?? [],
      });
      // Also populate cash state from snapshotData.cashBalances
      setCashBalanceAmounts(...);
    }
  }, [snapshotData, isEditMode]);

  const onSubmit = async (data: ...) => {
    if (isEditMode) {
      await updateSnapshot.mutateAsync({ ...data, snapshotId: snapshotId! });
    } else {
      await createSnapshot.mutateAsync(data);
    }
    // Invalidate queries, close modal, etc.
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>
          {isEditMode ? 'Edit Snapshot' : 'New Stock Snapshot'}  {/* ← Toggle title */}
        </DialogTitle>
        {/* Rest of modal unchanged; tab toggle, form sections all reused */}
      </DialogContent>
    </Dialog>
  );
}
```

### Changes to `SnapshotView.tsx` (or snapshot detail page)

Add "Edit" button in snapshot header:

```typescript
export function SnapshotHeader({ snapshotId }: { snapshotId: string }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <div className='flex justify-between items-center'>
      <h1 className='text-2xl font-bold'>Snapshot</h1>
      <Button
        onClick={() => setIsEditModalOpen(true)}
        variant='outline'
      >
        ✏️ Edit
      </Button>
      
      <NewSnapshotModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        snapshotId={snapshotId}  {/* ← Pass ID for edit mode */}
      />
    </div>
  );
}
```

### New tRPC Query: `getSnapshotDetails`

Add to router (needed for prefill in edit mode):

```typescript
getSnapshotDetails: privateProcedure
  .input(z.object({ snapshotId: z.string().cuid() }))
  .query(async ({ ctx, input }) => {
    const snapshot = await ctx.prisma.portfolioSnapshot.findUniqueOrThrow({
      where: { id: input.snapshotId },
      include: {
        portfolio: true,
        holdings: true,
        cashBalances: true,
      },
    });

    if (snapshot.portfolio.userId !== ctx.session.user.id) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }

    return {
      snapshotId: snapshot.id,
      snapshotDate: snapshot.snapshotDate,
      usdToAudRate: snapshot.usdToAudRate,
      holdings: snapshot.holdings,
      cashBalances: snapshot.cashBalances,
    };
  }),
```

### TDD Test Cases
| Test | Type | Verifies |
|------|------|----------|
| Edit button visible on snapshot view | unit | Button renders with ✏️ icon |
| Clicking Edit opens modal in edit mode | unit | Modal opens with `snapshotId` prop |
| Modal title changes to "Edit Snapshot" | unit | Conditional `DialogTitle` text |
| Prefill loads holdings + cash | integration | Form fields populated from snapshot data |
| Submit calls `updateSnapshot` mutation (not create) | unit | Correct mutation called based on `isEditMode` |
| Success redirects/refreshes snapshot view | integration | Post-update, cache invalidated and UI updated |

---

## File Inventory

| File | Action | Change Description |
|------|--------|---|
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | MODIFY | Add `snapshotId` optional prop; add `isEditMode` logic; prefill form from snapshot data; toggle title; call appropriate mutation |
| `src/server/trpc/routers/stock-asset.ts` | MODIFY | Add `updateStockSnapshot` mutation with CUID validation and user ownership check |
| `src/server/services/stock-asset.service.ts` | MODIFY | Add `updateStockSnapshot` function with atomic delete-then-create pattern |
| `src/app/(authorized)/assets/stocks/SnapshotView.tsx` | MODIFY | Add Edit button header; pass `snapshotId` to modal; manage edit modal state |
| `src/server/trpc/routers/stock-asset.ts` | MODIFY | Add `getSnapshotDetails` query for edit prefill |

---

## Edge Cases & Integration Points

### Edit Mode: Data Mutation
- **Scenario:** User edits snapshot, changes 1 stock, removes 2 others, adds new cash
- **Expected:** Old holdings deleted, new ones created, cash updated atomically
- **Verify:** Transaction rolls back if any step fails; snapshot state consistent

### Edit Mode: Prefill Timing
- **Scenario:** User opens modal, waits for data to load, then starts editing
- **Expected:** Form fields populated once `snapshotData` available; no duplicate submissions
- **Verify:** `useEffect` dependency array correct; mutation loading state prevents double-submit

### Security: Ownership Check
- **Scenario:** User tries to edit snapshot via URL manipulation (direct snapshotId)
- **Expected:** If not owned by user, mutation/query returns 403 FORBIDDEN
- **Verify:** Both `updateStockSnapshot` and `getSnapshotDetails` check `portfolio.userId`

### UI: Modal Reuse for Create/Edit
- **Scenario:** User creates snapshot, then edits it, then creates new one
- **Expected:** Modal switches between create ↔ edit modes without state pollution
- **Verify:** Title changes, form resets correctly, mutations called appropriately

---

## Success Metrics

✅ **Edit Discoverability:** "Edit" button clearly visible on snapshot detail  
✅ **Modal Reuse:** Same modal UI for both create and edit (DRY principle)  
✅ **Atomic Updates:** All holdings + cash updated together (no partial states)  
✅ **Prefill Accuracy:** Form loaded with correct existing data  
✅ **Security:** Ownership check prevents cross-user edits  
✅ **Completeness:** No TypeScript errors; build passes; existing tests remain green  

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
