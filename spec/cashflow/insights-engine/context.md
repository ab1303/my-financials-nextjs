# Insights Engine — Context

## Problem

Every analytics surface needs to answer the same questions — what's the top mover? what's anomalous this period? is the user's savings rate improving? — but today, each chart and each KPI is computed independently. The result is visual fragmentation: the "top expense" on Home can disagree with the "top expense" on Analytics if their period assumptions drift even slightly.

We need **one server-side function** that takes a period + comparison + filtered transactions and returns a ranked list of typed `Insight`s. All four surfaces consume the same engine via tRPC.

## Architecture

- Pure module `src/server/services/insights/compute-insights.ts` exporting `computeInsights(input) → Insight[]`.
- Input: `{ period, comparison, userId, bankAccountId?, includeCategoryIds?, excludeCategoryIds? }`.
- Output: ranked `Insight[]` (highest signal first). Each insight carries `type`, `severity`, `headline`, `body`, `metric`, `drillDownFilter` (compatible with the existing `AnalyticsDrillDownDrawer`).
- Exposed as tRPC procedure `insights.forPeriod` under `src/server/trpc/router/insights.ts`.
- Pure, deterministic, no side effects → unit-testable against fixture transactions.

## Insight Catalogue (initial)

| Type | Trigger | Headline example |
|---|---|---|
| `top_expense_category` | Largest debit category in period | "Home is your biggest expense — $31,154 (24.5%)" |
| `top_mover_up` | Category with largest % increase vs comparison (min sample) | "Eating out is up 32% vs last 3 months (+$1,740)" |
| `top_mover_down` | Category with largest % decrease | "Travel is down 48% vs prior period (−$2,750)" |
| `anomaly_month` | Period total > mean + 1.5σ over rolling 6 | "Jan spending was 2.3× your monthly average" |
| `savings_rate_change` | Δ savings rate > 5pp vs comparison | "Your savings rate dropped from 22% to 14%" |
| `income_concentration` | Top income source > 80% of total | "91% of income comes from Employment — high concentration" |
| `new_recurring_candidate` | (Phase 6) New payee appearing monthly | (Phase 6 surface) |

## Scope

- Pure `computeInsights` function with deterministic ranking.
- Catalogue of 6 insight types listed above (Phase 6 adds the 7th).
- tRPC procedure `insights.forPeriod`.
- Vitest unit tests against fixture transaction sets covering each insight type's trigger and non-trigger cases.
- No UI consumers in this phase.

## Out of Scope

- UI rendering — consumed by Phases 2–5.
- Recurring detection (Phase 6).
- Forecast-based insights (Phase 7).
- Per-user thresholds / user-tuneable insight preferences.
