# Snapshot Entry Redesign — High-Level Design

## Problem & Solution

**Problem:**
- Cash entry is hidden/conditional in current modal; users with only idle cash cannot record snapshots
- Stock and cash entry flows are asymmetrical and inconsistent
- Summary cards show stocks and cash as separate metrics, not unified portfolio value
- UX for adding cash to existing snapshots is poor

**Solution:**
Redesign `NewSnapshotModal` with a segmented toggle ("📈 Stocks" / "💰 Cash") that lets users choose which type of holding to add. All holdings (stocks and cash) are unified in the summary as portfolio assets. The backend already supports this; only UI redesign needed.

---

## Architecture Decisions

### AD-1: Unified "Holdings" Mental Model
**Rationale:** Stocks and cash are both portfolio assets — they're interchangeable from an economic perspective. Treating them differently in the UI creates cognitive load. One entry form with a toggle makes intent clear.

**Implementation:**
- Keep separate Zod schemas (`stockHoldingEntrySchema`, `cashBalanceEntrySchema`) at validation layer
- In component state, track both arrays: `holdings[]` and `cashBalances[]`
- On submit, pass both to `createSnapshot` mutation (unchanged endpoint)
- Backend already aggregates both into `getSnapshotTotals` response

### AD-2: Segmented Tab Control (Not Modal Sections)
**Rationale:** Tab control is the industry pattern (Moomoo, Charles Schwab, Fidelity) for switching between entry types. It's:
- Highly discoverable (both options equally prominent)
- Mobile-friendly (tabs adapt to small screens)
- Familiar to financial app users
- Explicit (user chooses intent upfront)

**Implementation:**
- Two tabs: "📈 Stocks" (default) and "💰 Cash"
- Active tab determines which section renders
- Tab state persists during form interaction (UX expectation)
- Form fields hidden when switching tabs (clean UX)

### AD-3: No Backend Changes Required
**Rationale:** The backend (`getSnapshotTotals`, `asset-dashboard.service.ts`) already computes unified totals with cash breakdown. This is purely a UI reorganization.

**Implementation:**
- Existing `createSnapshot` mutation accepts both `holdings[]` and `cashBalances[]`
- Existing service returns `currencyTotals[].totalCash` for each currency
- No schema or service changes

### AD-4: Allow Cash-Only Snapshots
**Rationale:** A user with only idle cash (no active stocks) should be able to record it. Current validation requires at least one holding; this feature relaxes that.

**Implementation:**
- Modify `createStockSnapshotSchema` validation: allow empty `holdings[]` if `cashBalances[]` has entries
- Zod: `z.array(stockHoldingEntrySchema).optional()` instead of `.min(1, ...)`
- Backend logic already handles empty holdings

### AD-5: Prefill Both Stocks and Cash
**Rationale:** When prefilling from a previous snapshot, both holdings and cash should carry forward for consistency.

**Implementation:**
- `getMostRecentSnapshot` query already includes both `holdings` and `cashBalances`
- In `handlePrefill`, populate both `holdings` field array and `cashBalances` state
- On form reset, clear both

### AD-6: Summary Cards Show Unified Breakdown
**Rationale:** Portfolio value should always show: Stocks + Cash = Total. This is standard in financial apps.

**Implementation:**
- `SummaryCards` receives `currencyTotals` where each entry has `totalValue` (stocks) + `totalCash`
- Display: "Total Portfolio Value" (large, bold), then "  Stocks: $X | Cash: $Y"
- For USD cards, AUD equivalent includes both: `(totalValue + totalCash) * rate`

---

## Phase Map

| Phase | Description | Files Changed |
|-------|-------------|---|
| 1 | Modal redesign: add tab toggle, show stock/cash sections conditionally | `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` |
| 2 | Update form validation: allow cash-only snapshots | `src/server/schema/stock-asset.schema.ts` |
| 3 | Summary redesign: show unified Stocks + Cash + Total | `src/app/(authorized)/assets/stocks/SummaryCards.tsx` |

**Dependencies:** 1 → 2 (validation) → 3 (display)

---

## Component/Service Changes (High-Level)

### NewSnapshotModal.tsx
- Add tab state: `activeTab: 'stocks' | 'cash'`
- Conditional rendering:
  - If tab === 'stocks': show stock holdings section + "+ Add Another Holding" button
  - If tab === 'cash': show cash balances section + "+ Add Another Cash Balance" button
- Keep all form fields for both types available
- On submit: include both `holdings` and `cashBalances`

### SummaryCards.tsx
- Update `CurrencyTotalFromService` to include `totalCash?: number`
- Update display logic:
  - If `totalCash > 0`: show "Total Portfolio Value (large) + breakdown"
  - Else: show "Portfolio Value (large)" as before
- For USD cards: include cash in AUD equivalent calculation

### stock-asset.schema.ts
- Modify `createStockSnapshotSchema`:
  ```typescript
  holdings: z.array(stockHoldingEntrySchema).optional(),
  cashBalances: z.array(cashBalanceEntrySchema).optional(),
  // Custom validation: at least one of holdings or cashBalances required
  z.object({...}).refine(
    data => data.holdings?.length > 0 || data.cashBalances?.length > 0,
    { message: 'Add at least one holding or cash balance' }
  )
  ```

---

## Success Criteria

✅ Users can toggle between "📈 Stocks" and "💰 Cash" tabs in the modal  
✅ Users can record a snapshot with only cash (no stocks)  
✅ Summary cards show "Stocks | Cash | Total" breakdown per currency  
✅ Cash-only snapshots don't break dashboard or asset views  
✅ Prefill populates both stocks and cash from previous snapshot  
✅ No TypeScript errors; build passes  
✅ Mobile: tabs remain usable on small screens  

---

## Out of Scope / Future

| Item | Rationale |
|------|-----------|
| ~~Editing holdings/cash after snapshot~~ | **✅ IMPLEMENTED** via "Edit" modal for comprehensive changes + "Add Holding" for quick-adds |
| Deleting individual holdings/cash | Out of scope for this redesign |
| Inline prefill editing | Future: allow user to prefill and edit in one flow |
| Cash deposits/withdrawals tracking | Future: separate feature for cash flow |
| Multi-currency cash input | MVP supports AUD/USD; future: more currencies |

---

## Dual-Flow UX Pattern: "Add Holding" + "Edit Snapshot"

### AD-7: Separate UX Flows for Different User Intents
**Rationale:** Users edit snapshots in two distinct patterns:
1. **Quick-add (70%)**: "I forgot to record GOOG yesterday" → Add one holding to existing snapshot
2. **Comprehensive-edit (30%)**: "I need to review Q1 snapshot" → Update snapshot date, multiple holdings, cash

Forcing both through one modal violates **command specificity** principle — they're semantically different operations. Separate flows optimize for each.

**Implementation:**
- **"Add Holding" button** (inline, under each brokerage):
  - Quick form for single holding entry (account, ticker, qty, price)
  - Uses lightweight `createHolding` mutation (existing)
  - No snapshot date change
  - Fast, focused, minimal modal
  
- **"Edit Snapshot" button** (in snapshot header):
  - Full modal reusing `NewSnapshotModal`
  - Can change snapshot date, FX rate
  - Can update/add/delete multiple holdings + cash
  - Uses `updateSnapshot` mutation
  - Comprehensive, atomic

**Why this is better UX:**
- ✅ **Affordance matches intent**: "Add" button → add one thing; "Edit" → review all
- ✅ **Performance**: Quick-add uses minimal API (one holding create vs full snapshot update)
- ✅ **Discoverability**: "Add Holding" button positioned exactly where user wants to use it (under brokerage)
- ✅ **Task-oriented**: Each flow optimized for its task (like Gmail's "Quick reply" vs "Edit draft")
- ✅ **Power-user friendly**: Advanced users can choose the right tool
- ✅ **Real-world fit**: Matches actual workflow (add after snapshot, edit rarely)

**Examples in real products:**
- Gmail: "Quick reply" (one action) vs "Edit draft" (full editor)
- Figma: "Add element" (inline) vs "Edit document" (settings modal)
- Notion: "Quick add item" (inline) vs "Edit page properties" (settings modal)

---

## Phase Map (Updated)

| Phase | Description | Files Changed |
|-------|-------------|---|
| 1 | Modal redesign: add tab toggle, show stock/cash sections conditionally | `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` |
| 2 | Update form validation: allow cash-only snapshots | `src/server/schema/stock-asset.schema.ts` |
| 3 | Summary redesign: show unified Stocks + Cash + Total | `src/app/(authorized)/assets/stocks/SummaryCards.tsx` |
| 4 | **Update Mutation**: Add `updateSnapshot` to tRPC router | `src/server/trpc/router/stock-asset.ts` |
| 5 | **Update Service**: Implement atomic snapshot update logic | `src/server/services/stock-asset.service.ts` + controller |
| 6 | **Edit UI**: Add "Edit" button to snapshot view, reuse modal for edit mode | `NewSnapshotModal.tsx`, `StockAssetsClient.tsx` |
| 7 | **Quick-Add UX**: Ensure "Add Holding" button remains as separate quick-add flow | `HoldingFormModal.tsx` (no changes needed) |

**Dependencies:** 
- 1 → 2 → 3 (creation flow)
- 4 → 5 → 6 (update flow) 
- 7 is independent (existing feature, retained as-is)
