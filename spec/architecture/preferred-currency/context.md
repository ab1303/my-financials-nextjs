# Preferred Currency — Context

## Problem Statement

The application stores financial data (transactions, budgets, balances) in multiple currencies (AUD, USD, etc.). It needs to support:
1. **Per-transaction currency** — Each transaction is recorded in its native currency
2. **User preference** — Users can set a preferred display currency (AUD, USD, etc.)
3. **Conversion** — Display amounts in preferred currency using current exchange rates
4. **Reporting** — Reports should respect user's preferred currency

## Goals

1. **Define currency storage strategy** — How currency is represented in the database
2. **Implement currency conversion** — Rules for converting between currencies
3. **Establish exchange rate updates** — How and when exchange rates are refreshed
4. **Create display patterns** — How to format and show currency in UI

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature applies to ALL domains (transactions are multi-currency; all displays should respect user preference).

## Scope

### In Scope
- Currency code storage (ISO 4217 format: AUD, USD, etc.)
- Per-user preferred currency setting
- Exchange rate lookup and caching
- Currency conversion logic
- Display formatting (currency symbol, decimal places)
- Reporting with currency conversion

### Out of Scope
- Real-time exchange rate updates (set to daily refresh)
- Cryptocurrency support
- Cryptographic or secure exchange rate sources
