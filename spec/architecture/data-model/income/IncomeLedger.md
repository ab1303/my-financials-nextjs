# IncomeLedger

## Status
⚠️ **DEPRECATED** — Fiscal-year scoping moved to Transaction date range queries.

## Purpose (Historical)
Previously acted as a per-user, per-calendar container for income records. This was part of a CQRS-like pattern that has been consolidated.

## Deprecation Rationale

The `IncomeLedger` table exists solely to group `IncomeRecord` rows by fiscal year. Since `IncomeRecord` is deprecated (see [`IncomeRecord.md`](./IncomeRecord.md)), the grouping mechanism is no longer needed.

Fiscal-year scoping is now handled via date-range queries on `Transaction`:

```sql
SELECT * FROM Transaction 
WHERE type = 'CREDIT' 
  AND status = 'CONFIRMED'
  AND date BETWEEN calendarYear.startDate AND calendarYear.endDate
  AND userId = ?
```

## Migration Path

- Delete all `IncomeLedger` rows
- Remove `incomeLedgerId` FK from any remaining data structures
- Fiscal-year queries use `CalendarYear.fromYear/fromMonth/toYear/toMonth` to resolve date ranges

See: [`spec/cashflow/income/income-source-of-truth/`](../../cashflow/income/income-source-of-truth/) for full rationale.
