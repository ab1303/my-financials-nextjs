# Income Management — Context

## Problem
Users need to record and review income to maintain an accurate cash position across monthly and fiscal-year views.

## Architecture
- **Source of Truth**: `Transaction` table (`type=CREDIT`, `status=CONFIRMED`).
- **Classification**: Automated (BANK/LLM) + Manual (`source=MANUAL`).
- **Reporting**: Monthly/fiscal-year breakdown.

## Scope
- Tracking imported and manual CREDIT transactions.
- Fiscal-year and Annual-year filtering.
- Bank account filtering.
