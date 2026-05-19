# Context: Date Entry UX Improvements for Stock Holdings

## Problem Summary
- "Sale Date" (optional) field blocks form save with "Invalid date" error if left empty due to Zod validation, despite being marked optional.
- "Buy Date" is required, causing friction for users who don't remember exact dates; users must leave the app to check broker statements.

## File Inventory
| File | Change |
|---|---|
| src/server/schema/stock-asset.schema.ts | Make `buyDate` optional in `stockHoldingEntrySchema`; fix `saleDate` validation to skip empty |
| src/app/(authorized)/assets/stocks/NewSnapshotModal.tsx | Add month/year quick-pick for Buy Date; support null buyDate; add CGT warning |
| src/app/(authorized)/assets/stocks/HoldingFormModal.tsx | Same as above |
| src/server/services/stock-asset.service.ts | Handle null buyDate in calculations |
| src/utils/stock-asset-calculations.ts | Update `calculateHoldingMetrics()` for missing buyDate |

## Current Zod Schemas
```typescript
export const stockHoldingEntrySchema = object({
  ...
  buyDate: z.coerce.date({ required_error: 'Buy date is required' }),  // ← CHANGE: make optional with defaults
  ...
  saleDate: z.coerce.date().optional().nullable(),  // ← BUG: empty value fails validation
  ...
});

export const updateStockHoldingSchema = object({
  holdingId: string({ required_error: 'Holding ID is required' }),
  // ... all fields optional
  buyDate: z.coerce.date().optional(),
  saleDate: z.coerce.date().optional().nullable(),
  // ...
});
```

## Current Calculation Logic
- `calculateHoldingMetrics(holding, snapshotDate)` uses `holding.buyDate` to determine holding period and CGT eligibility. Assumes buyDate is always present.

## Business Rule
- Snapshots are immutable, but holdings within them remain editable after creation.

## Constraints
- Use HTML5 `<input type="month">` for month/year quick-pick; fallback to text input if unsupported.

## Data Flow
Form → Zod validation → Service layer → Calculation utility → UI display
