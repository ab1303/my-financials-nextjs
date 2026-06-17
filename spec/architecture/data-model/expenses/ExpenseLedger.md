# ExpenseLedger

## ⚠️ DEPRECATED

> **This table is deprecated.** Expense data is now sourced directly from the `Transaction` table
> (type=DEBIT, status=CONFIRMED). Expense totals and monthly breakdowns are computed via live
> queries on Transaction, not materialized into a ledger structure.
>
> **Migration path:** No data migration needed — expense views already read from Transaction.
> This table remains in schema for historical compatibility but should not be referenced by
> new code. See `spec/cashflow/hld.md` Architecture Decision #2.

## Purpose
~~Acts as the per-user, per-calendar ledger header for monthly expense aggregates, grouping summarized spend into a reporting period.~~

## Domain
Expenses

## Status
**Deprecated** — superseded by live Transaction queries

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| calendarId | String | No | Foreign key to the reporting period. |
| userId | String | No | Owner user foreign key. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- CalendarYear (`calendarId` → `CalendarYear.id`)
- User (`userId` → `User.id`)

### Has Many
- MonthlyExpenseSummary

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[calendarId, userId]`
- Foreign keys to `CalendarYear` and `User`

## Notes
This table stores expense summary headers, not raw transaction lines.