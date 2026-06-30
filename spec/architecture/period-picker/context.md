# Period Picker — Context

## Problem

The Cashflow Analytics page and the Income Summary report both filter by a single fiscal/annual calendar year via `CalendarYearPicker`. That control is correct for surfaces that are fundamentally calendar-bound (assets, zakat, donations) but wrong for analytical surfaces, where users want:

- **Rolling windows** (last 3 / 6 / 12 months, MTD, YTD) — to see *recent* behaviour rather than full-year totals dominated by old data.
- **Custom ranges** — to scope a single trip, a renovation, a job change.
- **Period-over-period comparison** — to answer "is this month normal?" by overlaying the prior period or the same period last year.

Today none of this is possible without re-importing or hand-filtering transactions.

## Architecture

- **`<PeriodPicker>`** Client Component under `src/components/insights/PeriodPicker.tsx`.
- Presets: `MTD`, `L3M`, `L6M`, `L12M`, `YTD`, `FY` (uses the user's fiscal year type from `getUserFiscalYearType`), `CUSTOM`.
- Comparison axis: `none` | `prior_period` (same length immediately before) | `prior_year` (same calendar range one year earlier).
- Emits a strict `{ current: DateRange, comparison: DateRange | null, preset, comparisonMode }` payload.
- A companion hook `usePeriodQueryState` binds the payload to URL search params (`p=`, `c=`, `from=`, `to=`) so deep links and browser Back work.
- The legacy `CalendarYearPicker` is **not** removed — it remains the right primitive for calendar-bound flows.

## Scope

- New `<PeriodPicker>` component with presets + custom date range + comparison toggle.
- New `DateRange`, `PeriodPreset`, `ComparisonMode` types in `src/types/period.ts`.
- New `usePeriodQueryState` hook for URL serialisation.
- Pure utility `resolvePeriod(preset, anchor, fiscalYearType) → DateRange` with unit tests.
- Pure utility `resolveComparison(current, mode) → DateRange | null` with unit tests.
- Dark-mode + Flowbite styling parity from day 1.
- No surface integration in this phase — a demo route under `/dev/period-picker` (gated to dev only) is acceptable for visual verification.

## Out of Scope

- Replacing `CalendarYearPicker` anywhere in the app (deferred to the surface phases).
- Persisting period preferences server-side (URL is the source of truth for now).
- Calendar quarter / week presets (can be added later without API break).
