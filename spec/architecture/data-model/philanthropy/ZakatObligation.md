# ZakatObligation

## Purpose
Represents the calculated zakat amount due for a specific reporting period and acts as the header record for related zakat payments.

## Domain
Philanthropy

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| calendarId | String | No | Unique foreign key to the associated calendar year. |
| amountDue | Decimal (`Money`) | No | Total zakat amount due for the period. |

## Relationships
### Belongs To
- CalendarYear (`calendarId` → `CalendarYear.id`)

### Has Many
- ZakatPayment

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `calendarId`
- Foreign key to `CalendarYear`

## Notes
The unique `calendarId` makes this effectively one zakat obligation per reporting period.