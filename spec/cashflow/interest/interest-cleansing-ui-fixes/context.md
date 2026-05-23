# Interest Cleansing UI Fixes — Context

## Problem Statement
The Interest Cleansing page fails to display unlinked interest credits, creates fiscal year records with incorrect months, and requires a confusing manual initialization step that orphans early-year transactions. These issues prevent accurate liability tracking and frustrate users.

## Scope
**In Scope:**
- Fixing the drawer to show all unlinked interest credits
- Deleting and recreating fiscal year BankInterestLiability records with correct months
- Refactoring the UI to always show 12 months, remove the init button, and support inline manual override

**Out of Scope:**
- Automated migration of broken records
- Changes to payment/transaction models
- Bulk import/edit of overrides

## Existing Patterns
- `getYearlyCleansingData` merges 12-month calendar with optional liability data for display
- `CalendarYearPicker` is used for filtering and selecting the fiscal/calendar year

## Known Constraints
- Fiscal year records created before the month calculation fix must be deleted before the new UI works correctly
- User must manually re-initialize after cleanup

## Dependencies
- Drawer and month calculation fixes are already implemented
- Cleanup must run before UI refactor is effective
