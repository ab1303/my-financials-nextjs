# Period Picker — Low Level Design

## Types

```ts
// src/types/period.ts
export type PeriodPreset = 'MTD' | 'L3M' | 'L6M' | 'L12M' | 'YTD' | 'FY' | 'CUSTOM';
export type ComparisonMode = 'none' | 'prior_period' | 'prior_year';
export type DateRange = { from: Date; to: Date };
export type PeriodSelection = {
  preset: PeriodPreset;
  current: DateRange;
  comparison: DateRange | null;
  comparisonMode: ComparisonMode;
};
```

## Pure Utilities

| Function | Signature | Notes |
|---|---|---|
| `resolvePeriod` | `(preset, anchor: Date, fiscalYearType) → DateRange` | Pure, timezone-stable, returns inclusive `from`/exclusive `to`. |
| `resolveComparison` | `(current: DateRange, mode: ComparisonMode) → DateRange \| null` | `prior_period` shifts by the current length; `prior_year` shifts by 1 calendar year. |
| `formatPeriodLabel` | `(selection) → string` | E.g. "Last 6 months · vs prior period". |

All three are unit-tested with `vitest` against fixture dates (leap year, fiscal year crossover, month with 28/30/31 days).

## Component Contract

```tsx
<PeriodPicker
  value={selection}
  onChange={(next: PeriodSelection) => void}
  fiscalYearType={user.fiscalYearType}
  anchor={new Date()}                // for "today"-relative presets
  availablePresets={['MTD','L3M','L6M','L12M','YTD','FY','CUSTOM']}
  allowComparison
/>
```

- Renders a preset pill row + a comparison dropdown + (when `CUSTOM`) a date-range popover.
- Layout matches the existing Flowbite-style filter chips already used in `CashflowAnalyticsClient`.

## URL State Hook

```ts
// src/hooks/usePeriodQueryState.ts
const [selection, setSelection] = usePeriodQueryState({
  defaultPreset: 'L12M',
  fiscalYearType,
});
```

- Reads `?p=L6M&c=prior_year` (and `&from=…&to=…` when preset is `CUSTOM`).
- Writes via `router.replace` (no scroll, no history spam).
- SSR-safe: returns default on the server, hydrates from URL on mount.

## Verification Gate

- `pnpm run type-check`
- `pnpm run lint`
- `pnpm spec:check`
- Unit tests for `resolvePeriod` / `resolveComparison` / `formatPeriodLabel`.
- Visual smoke on `/dev/period-picker` demo route.
