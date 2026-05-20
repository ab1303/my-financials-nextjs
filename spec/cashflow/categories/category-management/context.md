# Category Management — Context

## Problem
Cashflow categories are foundational taxonomy, but the current management experience is split across inconsistent patterns. Expense categories already exist as database records but lack first-class management UX, while income sources were specified as a hardcoded enum that requires schema work for routine taxonomy changes. The feature needs a single management surface that makes taxonomy maintenance operational rather than deployment-driven and keeps income, expense, and donation-oriented categorization aligned.

## Domain Dependencies
- Uses the taxonomy patterns in `../../hld.md`, especially database-backed lookup records, soft-delete semantics, and server-side name resolution
- Relies on income, expense, donation, and interest-cleansing cashflow features consuming managed category/source records as their shared vocabulary where applicable
- Shares import-boundary resolution rules with the csv-import domain when labels arrive as strings

## Scope
**In scope:**
- Settings-driven CRUD for managed category vocabularies
- Replacing enum-backed income source selection with database-backed records
- Safe deactivate vs delete behavior for records already referenced by financial data
- Updating forms, filters, and import entry points to consume the managed lookup model

**Out of scope:**
- Category merge/consolidation workflows
- Icon-management UX beyond existing persisted fields
- Per-user taxonomy partitioning changes
- Bulk recategorization of existing transactions

## Known Constraints
- Historical records must remain readable after renames or deactivation.
- Client code should not own fallback or matching rules for imported category labels.
- CRUD access is authenticated and server-mediated only.
