# IncomeLedger

## Purpose
Acts as a per-user, per-calendar container for income records, grouping detailed income events under a specific reporting period.

## Domain
Income

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
- IncomeRecord

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[calendarId, userId]`
- Foreign keys to `CalendarYear` and `User`

## Notes
This table is the ledger header for detailed income entries.