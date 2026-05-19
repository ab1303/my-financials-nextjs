# Low-Level Design: Date Entry UX Improvements for Stock Holdings

## Phase Map
| Phase | Scope | Depends On |
|---|---|---|
| 1 | Fix saleDate validation; Zod schema changes | — |
| 2 | UI: month/year picker in both modals | Phase 1 |
| 3 | Service layer: handle null buyDate in calculations | Phase 2 |
| 4 | Add CGT education warning | Phase 3 |
| 5 | DB migration: make buyDate nullable (deferred) | — |

## Phase Details
### Phase 1: Zod Schema Changes
- In `stockHoldingEntrySchema`:
  - Change `buyDate: z.coerce.date({ required_error: ... })` → `buyDate: z.coerce.date().optional().nullable()`
  - For `saleDate`, add logic: if value is empty string/null/undefined, skip validation (allow null)
- Pseudocode:
  ```typescript
  buyDate: z.coerce.date().optional().nullable(),
  saleDate: z.preprocess(val => val === '' || val == null ? undefined : val, z.coerce.date().optional().nullable()),
  ```

### Phase 2: Month/Year Picker UI
- In both modals, add toggle for "Exact date" vs "Month/Year" entry
- If "Month/Year" selected, show `<input type="month">`; on submit, parse to `new Date(year, month-1, 1)`
- If left blank, buyDate is null
- Default to snapshot date if buyDate is null

### Phase 3: Service Layer
- In `calculateHoldingMetrics(holding, snapshotDate)`:
  - If `holding.buyDate` is null/undefined, use `snapshotDate` for holding period/CGT
  - Function signature:
    ```typescript
    function calculateHoldingMetrics(holding: StockHolding, snapshotDate: Date): MetricsResult
    ```

### Phase 4: CGT Education Warning
- Inline component below Buy Date field
- Wording: "⚠️ CGT eligibility requires 12+ months holding. Leave blank to use snapshot date."

### Phase 5: DB Migration (Deferred)
- If/when making `buyDate` nullable in DB:
  - Prisma migration: `ALTER TABLE StockHolding MODIFY buyDate DateTime NULL;`

## TDD Test Cases
| Test | Type | Verifies |
|---|---|---|
| Save holding with empty saleDate | Unit/Integration | saleDate validation skipped when empty; form saves successfully |
| Save holding without buyDate | Unit/Integration | buyDate optional; form saves with null; defaults to snapshot date in calculations |
| Month/year input parses to first day of month | Unit | Input "06/2023" → `new Date(2023, 5, 1)` |
| Edit holding to refine buyDate | Integration | HoldingFormModal updates buyDate via mutation; recalculates CGT eligibility |
| CGT warning displays when buyDate is null | Component | Warning renders; includes helper text about snapshot date |
| Holding period calculation with null buyDate | Unit | Falls back to snapshot date; holding period = 0 months if snapshot today |

## Integration Points
- Form modals → Zod validation → tRPC mutation → service layer → calculation utility → UI

## Edge Cases
- Null buyDate in past snapshots
- Snapshot date before expected date range
