# ExpenseLedger

## Purpose
Acts as the per-user, per-calendar ledger header for monthly expense aggregates, grouping summarized spend into a reporting period.

## Domain
Expenses

## Status
Active

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