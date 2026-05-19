# Add Holding Improvements: Context & File Inventory

## Feature Summary

Two UX improvements to the stock holdings workflow:
1. **Prefill from previous snapshot**: When opening `NewSnapshotModal`, pre-populate all holdings from the most recent snapshot so the user only needs to update current prices rather than re-enter every field.
2. **Account pre-selection**: When clicking "Add Holding" from within a specific account's accordion in `StockAssetsClient`, `HoldingFormModal` opens with that account already selected in the dropdown.

Both are additive changes — no schema migrations, no new endpoints required.

---

## File Inventory

### Frontend (Modified)

| File | What Changes |
|------|-------------|
| `src/app/(authorized)/assets/stocks/StockAssetsClient.tsx` | Add `addingToAccountId: string \| null` state; pass it to `HoldingFormModal`; set it on "Add Holding" click; clear on modal close |
| `src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx` | Add `getMostRecentSnapshot` tRPC query; add "Prefill from previous" toggle button; populate `useFieldArray` from prior snapshot holdings on user action |
| `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` | Accept new `defaultAccountId?: string` prop; use it as default value for `accountId` in create-mode form |

### Backend API (No Changes Needed)

| File | Relevant Existing Endpoint |
|------|---------------------------|
| `src/server/trpc/router/stock-asset.ts` | `getMostRecentSnapshot` — already exists, takes `getSnapshotsSchema` (calendarYearId optional) |
| `src/server/controllers/stock-asset.controller.ts` | `getMostRecentSnapshotHandler` — already exists |
| `src/server/services/stock-asset.service.ts` | Returns `StockSnapshotWithHoldings \| null` with `holdings[].account` |

### Types & Schema (No Changes Needed)

| File | Relevant Types |
|------|---------------|
| `src/types/stock-asset.types.ts` | `StockHoldingWithAccount` — has all fields needed for prefill |
| `src/server/schema/stock-asset.schema.ts` | `createStockHoldingSchema` — defines `CreateStockHoldingInput` shape that prefill maps to |

---

## Current State (As-Is)

### NewSnapshotModal.tsx
- No prefill logic; starts with a single blank holding row
- `useFieldArray` with `name: 'holdings'` — already set up for multi-row, ready to receive prefilled data
- `defaultValues.holdings` has one empty row
- No call to `getMostRecentSnapshot`
- Props: `{ isOpen, onClose, onSuccess, brokerageAccounts }`

### HoldingFormModal.tsx
- In create mode, defaults `accountId` to `brokerageAccounts?.[0]?.id`
- Accepts: `{ isOpen, onClose, onSuccess, brokerageAccounts, snapshotId?, editingHolding? }`
- No `defaultAccountId` prop exists today

### StockAssetsClient.tsx
- "Add Holding" button (per account accordion):
  ```tsx
  <Button
    variant='secondary'
    onClick={() => {
      setEditingHolding(null);
      setIsHoldingFormModalOpen(true);
    }}
  >
  ```
- Does NOT capture which account's button was clicked
- `HoldingFormModal` rendered with `snapshotId={selectedSnapshotId || undefined}` but no account hint

---

## getMostRecentSnapshot Endpoint

```typescript
// router/stock-asset.ts
getMostRecentSnapshot: protectedProcedure
  .input(getSnapshotsSchema)         // { calendarYearId?: string, calendarType?: string }
  .query(({ input, ctx: { session } }) =>
    getMostRecentSnapshotHandler({ input, userId: session.user.id }),
  ),
```

Returns: `StockSnapshotWithHoldings | null`

```typescript
// StockSnapshotWithHoldings shape (from service):
{
  id: string;
  snapshotDate: Date;
  userId: string;
  holdings: StockHoldingWithAccount[];  // includes .account { id, name }
}
```

---

## Prefill Mapping (Previous Holdings → New Form)

When populating a new snapshot from a prior one, fields copy verbatim **except**:

| Field | Behaviour |
|-------|-----------|
| `ticker` | Copy as-is |
| `companyName` | Copy as-is |
| `accountId` | Copy as-is |
| `quantity` | Copy as-is |
| `buyPrice` | Copy as-is |
| `buyDate` | Copy as-is |
| `currency` | Copy as-is |
| `plannedTerm` | Copy as-is |
| `currentPrice` | **Set to 0** — user must update to today's price |
| `salePrice` | **Clear (null)** — sales belong to previous snapshot |
| `saleDate` | **Clear (null)** |
| `soldQuantity` | **Clear (null)** |

Rationale: The snapshot date is new (today), so current price is unknown and past sales should not carry over.

---

## UI Patterns in This Codebase

### useFieldArray pattern (NewSnapshotModal already uses this):
```tsx
const { fields, append, remove } = useFieldArray({ control, name: 'holdings' });
```

### Replacing all field array entries on prefill:
```tsx
// react-hook-form: replace entire array via reset()
reset({ snapshotDate: new Date(), holdings: prefillHoldings });
```

### tRPC query inside modal (pattern from HoldingFormModal):
```tsx
const { data: latestSnapshot } = trpc.stockAsset.getMostRecentSnapshot.useQuery(
  {},
  { enabled: isOpen }
);
```

---

## Security & Isolation

- `getMostRecentSnapshot` is a `protectedProcedure` — userId comes from session, never client
- `createHolding` / `createSnapshot` both verify account ownership server-side
- No new security surface — both enhancements are purely client-side default-value improvements
