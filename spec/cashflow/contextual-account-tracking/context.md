# Contextual Account Tracking — Context

## Problem Summary

Users are confused by the "Tracked" toggle in the Bank Accounts table. The concept is unfamiliar, appears too early, and lacks explanation. This leads to misuse and unresolved transfer warnings.

## Domain Dependencies
- See `spec/cashflow/hld.md` for domain architecture
- See `spec/cashflow/multi-account-transfer-integrity/` for transfer matching logic

## Scope Table
| IN SCOPE | OUT OF SCOPE |
|----------|--------------|
| Remove "Tracked" column from Bank Accounts table | Changes to transfer matching algorithm |
| Add advanced section with `isTracked` toggle and explanation | New onboarding or education flows |
| Add 4th orphan resolution button in OrphanResolutionPanel | Undo/redo for tracking changes |
| Extend `resolveOrphan` mutation to support tracking update | Schema changes |

## Existing Patterns to Reuse
- `trpc.bankAccount.updateTracking` mutation
- OrphanResolutionPanel component
- BankAccountsSection component

## Known Constraints & Gotchas
- "Off-budget" is not user-facing; use plain language
- Counterpart account detection may be ambiguous; fallback to EXCLUDED if not found
- No new Prisma migration required
- UI must remain simple for new users; advanced controls are hidden by default
