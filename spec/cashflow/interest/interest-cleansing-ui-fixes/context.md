# Interest Cleansing UI Fixes — Context

## Problem Statement

The Interest Cleansing page fails to display unlinked interest credits, creates fiscal year records with incorrect months, and requires a confusing manual initialization step that orphans early-year transactions. These issues prevent accurate liability tracking and frustrate users.

## Scope

**In Scope:**

- Fixing the drawer to show all unlinked interest credits and integrate with the canonical evidence/ allocation UX defined in `interest-cleansing`
- Refactoring the UI to always show 12 months, remove the init button, and support inline manual override

## Existing Patterns

- `getYearlyCleansingData` merges 12-month calendar with optional liability data for display
- `CalendarYearPicker` is used for filtering and selecting the fiscal/calendar year
  Note: This UI-fixes slice should avoid prescribing linkage semantics (credit-only or debit-only). Allocation and evidence selection behavior must defer to the canonical `interest-cleansing` spec.
