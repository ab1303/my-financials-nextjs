# Interest Cleansing UI Fixes — High Level Design (HLD)

## Problem Summary
The Interest Cleansing page has three critical issues:
- The FROM LEDGER column shows empty despite unlinked interest transactions existing, due to the drawer calling the wrong service.
- Fiscal year BankInterestLiability records have incorrect month values, breaking month-to-transaction matching.
- The UX model is poor: users must initialize months, which orphans early-year transactions and confuses the workflow.

## Solution Overview
This feature delivers a three-phase solution:
1. **Drawer Fix**: Update the drawer to call `getUnlinkedInterestTransactions` so all unlinked interest credits are shown.
2. **Cleanup**: Provide a script to delete broken fiscal year BankInterestLiability records, allowing users to re-initialize cleanly.
3. **UX Refactor**: Refactor the UI to always show all 12 months, remove the init button, and allow inline manual overrides per month.

## Architecture Decisions
| Decision | Rationale |
|---|---|
| Use `getUnlinkedInterestTransactions` in drawer | Ensures correct interest credits are shown for linking |
| Cleanup via script, not migration | Safer, user-controlled, avoids accidental data loss |
| Always show 12 months in UI | Prevents orphaned transactions, improves clarity |
| Manual override is per-month, inline | Simplifies user workflow, avoids modal complexity |
| No automatic re-initialization | User must re-init after cleanup for transparency |

## Data Model Impact
- **BankInterestLiability**: Old records with wrong `month` must be deleted and recreated. New records use correct `month` logic.
- **amountDue**: Now optional per month; UI merges liability data with 12-month calendar.

## Success Criteria
- FROM LEDGER column always shows all unlinked interest credits for the selected year/month.
- No fiscal year BankInterestLiability records exist with incorrect months after cleanup.
- UI always displays 12 months, with inline manual override and no init button.
- User can re-initialize liabilities after cleanup without errors.

## Out of Scope / Future Phases
- Automated migration of broken records (manual cleanup only)
- Bulk edit or import of manual overrides
- Changes to BankInterestPayment or Transaction models
