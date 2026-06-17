# BankInterestLiability

## Purpose
Tracks the monthly interest-cleansing liability owed for a specific bank and reporting period, with related payment records attached when settlement occurs.

## Domain
Philanthropy

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| month | Int | No | Liability month number. |
| year | Int | No | Liability year number. |
| amountDue | Decimal (`Money`) | No | Interest amount due for cleansing. |
| bankId | String | No | Foreign key to the bank/business. |
| calendarId | String | No | Foreign key to the reporting period. |

## Relationships
### Belongs To
- Business (`bankId` → `Business.id`)
- CalendarYear (`calendarId` → `CalendarYear.id`)

### Has Many
- BankInterestPayment

## Indexes & Constraints
- Primary key on `id`
- Foreign keys to `Business` and `CalendarYear`

## Notes
Although liabilities remain active, payments are in transition from `BankInterestPayment` to `DonationPayment` with purpose `INTEREST_CLEANSING`.