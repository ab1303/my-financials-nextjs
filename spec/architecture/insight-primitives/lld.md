# Insight Primitives — Low Level Design

## File Layout

```
src/components/insights/
  Sparkline.tsx
  TrendDelta.tsx
  InsightCard.tsx
  KpiTile.tsx
  index.ts
  __tests__/
    TrendDelta.test.tsx
    Sparkline.test.tsx
```

## Component Contracts

```tsx
<Sparkline
  points={number[]}             // length 2..24 typical
  accent="positive" | "negative" | "neutral"
  ariaLabel="Last 12 months of groceries"
  height={20}                   // default
  width={80}                    // default
/>

<TrendDelta
  current={number}
  baseline={number}
  baselineLabel="vs prior 3 months"
  format="percent" | "currency"
/>

<InsightCard
  variant="rising" | "falling" | "anomaly" | "milestone"
  icon={ReactNode}
  headline={string}
  body={string}
  cta?={{ label: string; href?: string; onClick?: () => void }}
  onDismiss?={() => void}
/>

<KpiTile
  label={string}
  value={string}                // pre-formatted
  delta?={TrendDeltaProps}
  sparkline?={SparklineProps}
/>
```

## Rendering Notes

- `Sparkline`: inline `<svg>` with a single `<path>`; no React-chart-lib instance per cell (cheap on long lists).
- `TrendDelta`: when `baseline === 0`, render `—` rather than `Infinity%`.
- `InsightCard`: uses `role="region"` + `aria-labelledby`; dismiss button focuses the next card.
- `KpiTile`: replaces the existing inline KPI markup on Home and Income Summary in later phases.

## Verification Gate

- `pnpm run type-check`
- `pnpm run lint`
- `pnpm spec:check`
- Component tests for `TrendDelta` (zero baseline, negative, flat) and `Sparkline` (single point, NaN guard).
- Manual visual smoke on `/dev/insights`.
