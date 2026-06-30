# Insight Primitives — Context

## Problem

The four analytics surfaces (Home, Cashflow Analytics, Income Summary, Expense Summary) all need the same visual building blocks to surface insights: a tiny inline trend graph, a "+12%" delta chip, a headline-style insight card, and an enriched KPI tile. If each surface invents its own, we get drift in colour, sizing, accessibility, and dark-mode behaviour — and the "top mover" on Home will visually disagree with the "top mover" on Analytics.

## Architecture

A new shared module `src/components/insights/` housing four primitives that compose freely:

- **`<Sparkline>`** — 12-point inline SVG, no axes, no tooltip, single accent colour, fixed aspect.
- **`<TrendDelta>`** — pill rendering `+12.4% ▲` / `−4.1% ▼` / `• flat`, semantic colour, accessible label ("up 12.4 percent versus prior 3 months").
- **`<InsightCard>`** — icon + headline + one-sentence body + optional CTA. Variants: `rising` / `falling` / `anomaly` / `milestone`.
- **`<KpiTile>`** — replaces the flat KPI cards: value + `<TrendDelta>` + `<Sparkline>`.

All primitives are pure presentational components; they accept data and render. They do not fetch.

## Scope

- Four primitives above, with TypeScript props, dark-mode support, and Flowbite-compliant styling.
- Storybook-equivalent demo route `/dev/insights` rendering each primitive in all variants.
- Accessibility: every chip has an `aria-label`; insight cards are landmarks (`role="region"`); sparklines have textual fallback (`<title>`).
- No data fetching, no business logic. Purely presentational.

## Out of Scope

- Insight ranking / data shaping (Phase 1).
- Surface integration (Phases 2–5).
- Animation polish beyond CSS transitions already used elsewhere.
- A full Storybook setup — the existing convention is a `/dev/*` demo route.
