# Calendar Attribution — Context

## Problem Statement

The application supports multiple calendar year types (Fiscal, Calendar, Zakat, Islamic), but there is ambiguity around whether a single financial transaction can be attributed to multiple calendar years simultaneously.

This is an architectural decision about multi-dimensional accounting: should a $500 donation on a given date be recorded in only one calendar's ledger, or should it be attributable to multiple independent calendar systems?

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature depends on understanding:
- **Cashflow domain**: How transactions, donations, and zakat payments are recorded and attributed
- **Data modeling**: Prisma schema relationships and constraint patterns (FK, @unique)

## Scope

### In Scope
- Transaction-as-source-of-truth architecture decision
- Multi-calendar attribution (can a single transaction be in multiple calendar ledgers?)
- Schema design for cross-calendar linking (how are FKs and unique constraints applied?)
- Date boundary edge cases (when a transaction straddles calendar year boundaries)

### Out of Scope
- Calendar year type definitions (that's cashflow domain)
- UI changes or reporting visualizations
- User configuration of calendar attribution rules
