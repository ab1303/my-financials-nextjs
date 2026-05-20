# Snapshot All Banks Display — Context

## Problem

The Bank Assets Cash Tracking page currently only renders accordion sections for banks that already have entries in the selected snapshot. If a user has ANZ configured but no ANZ accounts in the snapshot, ANZ is invisible — they have no way to discover they can add it.

The solution is to render **all configured banks** in the accordion, with banks missing from the snapshot showing an empty state with an "Add Account" CTA. This enables users to extend snapshot coverage without creating a new one.

## Domain Dependencies

- Uses: `BankBalanceSnapshot`, `BankBalanceRecord`, `BankAccount` models from [../hld.md](../hld.md)
- Uses: Business/Bank relationship queries for fetching all user-configured banks
- Related: `net-worth-dashboard` (companion feature for combined asset views)
- Related: `bank-assets` (asset tracking within snapshots)

## Scope

**In scope**
- Render all configured banks (not just those with snapshot entries)
- Show empty-state row for banks with no entries ("No accounts tracked in this snapshot")
- "Add Account" CTA on empty-state banks opens inline add-entry form
- Frontend-only change — no schema or tRPC changes required
- All necessary data already fetched in BankAssetsClient

**Out of scope**
- Banks with zero configured accounts (show "No accounts configured" message)
- Sorting/ordering beyond existing alpha sort by bankName
- Stock assets (PortfolioSnapshot) — separate feature
- Batch "add all banks to snapshot" — per-bank Add Account sufficient
