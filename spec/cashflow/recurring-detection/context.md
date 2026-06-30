# Recurring & Subscriptions Detection — Context

## Problem

Subscriptions and other recurring payments are the highest-leverage "leak" insight in personal finance — users consistently under-estimate them, and apps like Rocket Money built whole businesses around surfacing them. Today the system has no concept of recurrence: every Netflix charge is just another expense row, and there's no way to ask "what subscriptions am I paying for, and which started in the last 3 months?"

## Architecture

- New table `RecurringSeries` (one row per detected recurring stream): `id`, `userId`, `payeeKey` (normalised merchant string), `cadence` (`monthly` | `fortnightly` | `weekly` | `yearly`), `expectedAmount`, `tolerance`, `confidence` (0–1), `firstSeenAt`, `lastSeenAt`, `status` (`active` | `inactive` | `dismissed`), audit fields.
- Nullable FK `recurringSeriesId` on `Transaction` linking individual occurrences.
- Detection service `detectRecurringSeries(userId)`:
  1. Group `Transaction`s by normalised payee + amount-bucket.
  2. For each group with ≥3 occurrences, compute interval distribution; classify cadence if intervals cluster within ±20% of a known cadence.
  3. Score `confidence` from interval-stability + amount-stability.
  4. Upsert series; backfill `recurringSeriesId` on member transactions.
- Detection runs:
  - On-demand from a "Refresh recurring detection" button on the Expense Summary report.
  - Server action invoked after CSV imports (best-effort, non-blocking).
- Surfaces:
  - **Expense Summary report** gets a populated "Subscriptions & Recurring" section (replaces the Phase 3 placeholder).
  - **Home `HeadsUpInsightColumn`** receives a new insight type `new_recurring_candidate` for newly-detected series.
  - **Cashflow Analytics** gets a "Recurring only" filter chip in the filter bar.
- Users can mark a series as `dismissed` (false positive) or `inactive` (cancelled). Both states exclude from active counts.

## Scope

- New `RecurringSeries` table + migration `add_recurring_series` (followed by `pnpm prisma migrate dev`, never `db push`).
- `Transaction.recurringSeriesId` nullable FK + index.
- `detectRecurringSeries` service + unit tests over fixture data.
- "Refresh" button on Expense Summary kicks off detection (server action).
- Expense Summary "Subscriptions & Recurring" section: list with cadence, expected amount, last charge, status toggle, drill-down to occurrences.
- New insight type `new_recurring_candidate` plumbed through `computeInsights`.
- Analytics filter chip: `Show recurring only` / `Hide recurring` / `All` (URL state).

## Out of Scope

- Auto-cancellation flows (no integration with merchants).
- LLM-based merchant categorisation (separate effort).
- Push / email notifications for new recurring detections.
- Multi-currency normalisation beyond what already exists.
