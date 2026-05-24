# DonationLedger

## Purpose
Acts as the per-calendar-year header for donation tracking, grouping donation payments under a single reporting period.

## Domain
Philanthropy

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| calendarId | String | No | Unique foreign key to the reporting period. |

## Relationships
### Belongs To
- CalendarYear (`calendarId` → `CalendarYear.id`)

### Has Many
- DonationPayment

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `calendarId`
- Foreign key to `CalendarYear`

## Notes
This ledger header supports period-based donation reporting without duplicating calendar metadata on each payment.