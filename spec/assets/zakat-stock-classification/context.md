# Zakat Stock Classification — Context

## Problem Statement: Dual Valuation Requirement

Islamic finance requires Zakat on stocks to be calculated using two different valuation bases, depending on the investor’s intent:
- **Short-term/trading holdings**: Zakat is due on the *market value* at the Zakat anniversary (trading stock, ʿurūḍ al-tijāra).
- **Long-term/buy-and-hold holdings (including ETFs)**: Zakat is due on the *cost basis* (original investment), not the current market value (aṣl al-māl principle).

This duality is essential for Shariah compliance and user trust. The app must support both, with clear logic and user override.

## PO Rationale & Decisions (20-May 2026)

### 1. Classification Logic
- Use `StockHolding.plannedTerm` (SHORT_TERM → Market Value, MID/LONG_TERM → Cost Basis).
- App auto-suggests based on holding period, but user can override.
- Show ⚠ review badge if period < 12mo but classified as long-term.

### 2. UX Architecture (3 Touchpoints)
- **Stocks table** (`/assets/stocks`): Zakat Basis badge (🟢 Cost, 🔵 Market, ⚠ Review) + tooltip.
- **Zakat page** (`/zakat`): "📊 Calculate from Portfolio" button.
- **Modal**: Line-by-line breakdown, subtotals, final Zakat @ 2.5%, with warning flags.

### 3. Classification Hybrid Approach
- App auto-classifies by `plannedTerm`.
- Shows warning badge for mismatches (e.g., "held 6mo but marked LONG_TERM").
- Tooltips explain *why* (Islamic finance principle: SHORT_TERM uses market value, LONG_TERM uses cost basis).
- User can override for their own Shariah interpretation.

### 4. Net Worth Display Unchanged
- Net worth remains market value (portfolio worth).
- Zakat is a separate *compliance lens*, not a wealth lens.
- `/zakat` is the single source of truth for Zakat-basis values.
- Dashboard keeps net worth simple and trustworthy.

### 5. Edge Cases Resolved
- ETF down 40% from cost → Use cost basis (per Islamic finance: you owe Zakat on what you invested).
- Partial sale of long-term ETF → Full quantity stays long-term (liquidation doesn’t recharacterise intent).
- New user, year 1, no history → Button disabled with message "Add holdings first".
- All USD holdings → Zero AUD total, note: "Enter amount manually — USD conversion not in scope".

### 6. Classification Transparency
- Plain English UI (no Arabic: "buy-and-hold" not "aṣl al-māl").
- Tooltip on each badge explains the mapping.
- Form hint beneath term selector in `HoldingFormModal`.
- Modal shows which basis was used for each holding and the math.

### 7. Calculate Button Behavior
- One-click computation from latest portfolio snapshot.
- Pre-fills `amountDue` but requires explicit save.
- Preserves manual workflow for untracked assets (gold, property, receivables).
- Shows breakdown modal for user verification before saving.

### 8. What NOT to Build (MVP Guardrails)
- ❌ Nisab input field (static note; user's responsibility).
- ❌ Auto-populate on page load (always require explicit click).
- ❌ Arabic terminology in UI.
- ❌ Dashboard Zakat view (`/zakat` is the home).
- ❌ Automatic amountDue write-back (user must confirm).

## Scope

**In Scope:**
- Zakat Breakdown Panel on `/zakat` page
- Per-holding Zakat badges in Stocks table
- "Calculate from Portfolio" button
- Zakat Summary Modal with breakdown
- Informational Nisab proximity (no enforcement)
- Calculation logic in `src/utils/zakat-calculations.ts`

**Out of Scope:**
- Nisab management, net worth changes, USD conversion, Arabic UI, dashboard Zakat view, auto-write

## Domain Dependencies
- **Assets HLD**: PortfolioSnapshot, StockHolding, PlannedTermEnum
- **Zakat model**: ZakatObligation.amountDue
- **Stocks holdings**: plannedTerm, buyPrice, quantity, currentPrice, buyDate, soldQuantity

## Key UX Decisions (with PO Reasoning)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Use plannedTerm for classification | Reuses existing intent, avoids extra field, aligns with user mental model |
| 2 | 3 UI touchpoints | Ensures transparency and user control at every step |
| 3 | Hybrid auto/manual classification | Balances automation with user override for Shariah diversity |
| 4 | Net worth stays market value | Prevents confusion, keeps dashboard trustworthy |
| 5 | Edge cases handled explicitly | Avoids user frustration, ensures compliance |
| 6 | Plain English, tooltips | Maximizes clarity, avoids jargon |
| 7 | Explicit calculation flow | User must confirm, preserves manual flexibility |
| 8 | MVP guardrails | Prevents scope creep, keeps feature focused |

## Out of Scope (with Reasoning)
- **Nisab input/management**: User responsibility, not enforced by app
- **Net worth dashboard changes**: Zakat is a compliance lens, not a wealth metric
- **USD conversion**: Not in scope for MVP, manual entry only
- **Arabic UI**: Plain English only for clarity
- **Auto-write to amountDue**: User must confirm, avoids accidental overwrites

## Edge Case Table

| Scenario | Resolution |
|---|---|
| ETF down 40% from cost | Use cost basis (per PO, preserves intent) |
| Partial sale of long-term ETF | Full quantity stays long-term (no recharacterisation) |
| New user, no holdings | Button disabled, message shown |
| All USD holdings | Zero AUD, note shown |
| No buyDate | Holding period = 0, warning badge shown |
| Multiple snapshots | Use most recent on/before Zakat year end |

## Domain Links
- See `spec/assets/hld.md` for asset model
- See `spec/cashflow/donations/zakat/lld.md` for ZakatObligation
- See `spec/assets/stocks-tracking/lld.md` for plannedTerm and snapshot logic


## Problem

The current Zakat feature requires the user to manually type `amountDue` each year with no assistance from the app.
The system already knows the user's portfolio (via `PortfolioSnapshot` + `StockHolding`), and each holding already
carries a `plannedTerm: InvestmentTermEnumType` (SHORT_TERM | MID_TERM | LONG_TERM) that maps directly to Islamic
finance Zakat valuation rules. The app should bridge that gap: compute a Zakat-eligible portfolio value from the
most recent snapshot, let the user understand why each holding is valued a certain way, and populate `amountDue`
with a one-click calculation rather than a manual figure.

## Islamic Finance Background (PO Reference)

| Holding classification | Zakat valuation basis | Scholarly rationale |
|---|---|---|
| SHORT_TERM (speculative / active trading) | **Market value** at Zakat anniversary date | Trading stock (ʿurūḍ al-tijāra) — valued at what it would realise today |
| MID_TERM / LONG_TERM (buy-and-hold, ETFs, growth investing) | **Cost basis** (original purchase price × quantity) | Investment assets (aṣl al-māl) — core capital preserved; only growth above cost is zakatable by some scholars. Using cost basis is the more conservative / widely adopted opinion for passive investors |

> **Nisab threshold**: 2024 gold nisab ≈ 85g gold ≈ AU$8,000 (varies). If total zakatable wealth < nisab, Zakat
> is not yet obligatory. The app should show nisab proximity but enforcement is the user's responsibility.

## Domain Dependencies

- **Assets HLD** (`spec/assets/hld.md`): `PortfolioSnapshot`, `StockHolding`, `InvestmentTermEnumType`; the HLD
  already lists "Zakat Nisab calculation on dashboard" as out of scope — this feature is the spec that brings
  it in-scope at the Zakat page level, not the dashboard.
- **Zakat LLD** (`spec/cashflow/donations/zakat/lld.md`): `ZakatObligation.amountDue` is currently a manual
  decimal — this feature adds a server-computed suggestion path without removing manual override.
- **Stocks Tracking LLD** (`spec/assets/stocks-tracking/lld.md`): `calculateHoldingMetrics`,
  `StockSnapshotTotals`, and the existing `plannedTerm` field on `StockHolding` are the primary data sources.
- **Calendar** (`CalendarYear` of type `ZAKAT`): Zakat year date range is used to select the relevant
  `PortfolioSnapshot` (most recent snapshot on or before `toDate` of selected Zakat year).

## Scope

**In scope:**
- A new **Zakat Breakdown Panel** on the existing `/zakat` page showing how `amountDue` was computed
- Per-holding Zakat classification badges in the Stocks holdings table (`/assets/stocks`)
- A **"Calculate from Portfolio"** button on the Zakat form that populates `amountDue` from the portfolio
- A **Zakat Summary Modal** / expandable panel showing the line-by-line calculation per holding
- Nisab proximity indicator (informational only — no enforcement, no religious advice)
- Calculation logic encapsulated in `src/utils/zakat-calculations.ts` (pure functions, fully testable)

**Out of scope:**
- Automatic Zakat year creation or Nisab threshold management (user still creates ZAKAT calendar years)
- Net worth dashboard changes (market value remains the net worth metric — Zakat value is a separate lens)
- Currency conversion (AUD holdings only, same rule as net worth dashboard)
- Jurisprudential advice, fatwa display, or scholar citation UI
- Dividend / income Zakat (separate Islamic finance rule set — future feature)
- Property / super Zakat (no asset models for these yet)
- Fully automated `amountDue` write-back without user confirmation

## Key UX Decisions

### Decision 1: Classification via existing `plannedTerm` field
The `StockHolding.plannedTerm` field already captures the user's intent. We **re-use it** for Zakat rather
than adding a new `zakatCategory` field. The mapping is:
- `SHORT_TERM` → market value Zakat basis
- `MID_TERM` → cost basis Zakat basis
- `LONG_TERM` → cost basis Zakat basis

The term is set at holding-entry time in `HoldingFormModal`. Users who haven't set a term default to
`LONG_TERM` (safer for Zakat purposes — lower obligation). App shows a gentle nudge to review term
classifications before running Zakat calculation.

### Decision 2: "Calculate from Portfolio" is a suggestion, not an override
The button computes a value and pre-fills the `amountDue` input — the user must still confirm/save.
This preserves the existing manual workflow for users who calculate independently or adjust for
assets not tracked in the app (gold, property, receivables).

### Decision 3: Net worth stays as market value
The net worth dashboard continues to show market value. Zakat valuation (cost basis for long-term)
is a **compliance lens**, not a wealth lens. Mixing them would confuse portfolio tracking. The Zakat
page is the canonical home for the Zakat-basis view.

### Decision 4: Auto-suggest term from holding period, user owns final decision
When a holding has no `buyDate` or has `LONG_TERM` but has been held < 12 months, show a warning
badge: "⚠ Review term — held only N months". This nudges correctness without being prescriptive.
The classification tooltip explains the rule in plain language, not Arabic terminology.
