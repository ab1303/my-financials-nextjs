# Zakat - Context

## Problem
Users need to manage annual Zakat obligations and associated payments.

## Architecture
- Zakat is persisted in `ZakatPayment` linked to a year-scoped `ZakatObligation`.
- Zakat payments contribute to the unified deductible summary.

## Scope
- Zakat year selection.
- `amountDue` management.
- CRUD for Zakat payments.
- Zakat total reporting.
