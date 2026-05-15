# Product Owner — UX Inspiration & Financial App Design Principles

## Overview

When acting as Product Owner or designing financial app features, draw inspiration from best-in-class personal finance apps. This instruction file defines the reference apps, their key design principles, and how to apply them to this project.

---

## Reference Apps

### Copilot Money (https://copilot.money)
**Primary design reference.** Copilot Money sets the gold standard for modern personal finance UX on mobile and desktop.

Key patterns to draw from:
- **Spending insights at a glance** — Category breakdowns in clean card grids, not tables
- **Transaction enrichment** — Merchant logos, clean typography, amounts visually weighted
- **Smart categorisation** — Inline category editing with smooth dropdowns; changes persist immediately
- **Reimbursement handling** — Credits that offset expenses are surfaced as a distinct flow, not hidden
- **Period selectors** — Compact pill/chip UI for FY, month, quarter; no date pickers unless "Custom" is chosen
- **Subtle interactivity** — Hover states, micro-animations on state change, no jarring page reloads
- **Colour language** — Expenses in coral/red tones, income in green/teal, transfers neutral grey

### Monarch Money (https://monarchmoney.com)
**Secondary reference for data visualisation and planning.**

Key patterns to draw from:
- **Dashboard widgets** — Modular cards that summarise net worth, spending, income side-by-side
- **Category roll-up charts** — Bar + donut combos; category drill-down on click
- **Transaction list design** — Clean alternating rows, inline edit on double-click, bulk actions
- **Budget vs actual** — Progress bars per category, colour shifts at 80% and 100% thresholds
- **Collaborative feel** — Clear separation between personal and shared expenses
- **Filter bar** — Persistent filter chips that summarise active filters; one-click clear

### YNAB (https://ynab.com)
**Reference for budgeting philosophy and transaction reconciliation.**

Key patterns to draw from:
- **Every dollar has a job** — Budget-first mental model; don't just track, assign
- **Reimbursement as expense reduction** — A credit reimbursement reduces the originating category, not income
- **Reconciliation workflow** — Clear "cleared" vs "uncleared" states; one-tap reconcile
- **Rollover budgets** — Unspent budget carries forward; over-spent shows in red

---

## Applying Inspiration to This Project

### When Designing a New Feature

1. **Check Copilot Money first** — If the feature touches transaction display, categorisation, or period filtering, ask: "How does Copilot Money handle this?"
2. **Check Monarch for data viz** — If the feature involves charts, dashboards, or roll-ups, reference Monarch's card + chart patterns.
3. **Check YNAB for financial logic** — If the feature involves budgets, reimbursements, or reconciliation, apply YNAB's mental model.

### Transaction Display Principles (from Copilot Money)

- Amounts right-aligned, `tabular-nums`, bold for debits
- Category badges use a colour from the category palette, not a generic grey
- Status chips (`Confirmed`, `Excluded`) are subtle — small, muted, never louder than the amount
- Reimbursements display with a `↩` or offset indicator inline

### Filter & Period UI Principles (from Copilot Money + Monarch)

- **Single-line toolbar** by default; expand on demand
- Period preset as a chip/pill, not a dropdown — "This FY", "Last FY", "This Month" etc.
- Active filters shown as dismissible chips so the user always sees what's applied
- "Reset" is always visible but de-emphasised (grey, small)

### Reimbursement UX Principles (from YNAB + Copilot Money)

- A reimbursement **reduces an expense category** — it is NOT income
- The user should be able to promote an `EXCLUDED` credit to `Reimbursement` via the inline category selector
- Summary views show "Gross Expense − Reimbursements = Net Expense" per category
- True inter-account transfers remain `EXCLUDED` and are never counted in net figures

---

## PO Decision Framework

When making product decisions, apply this hierarchy:

1. **Financial accuracy first** — Does this give the user a true picture of their finances?
2. **Least friction** — Can the user accomplish this in one tap/click?
3. **Visual clarity** — Is the information hierarchy obvious without reading labels?
4. **Progressive disclosure** — Show summary first; detail on demand (accordion, drill-down, modal)
5. **Consistency** — Does this match patterns already used in the app?

---

## Out of Scope (Keep Simple)

- No social/sharing features (unlike Splitwise)
- No investment portfolio rebalancing (unlike Sharesight)
- No bank sync / open banking API (manual CSV import only for now)
- No recurring bill detection (future scope)
