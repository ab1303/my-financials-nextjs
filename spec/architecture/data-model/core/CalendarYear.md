# CalendarYear

## Purpose
Defines a reusable year range window for fiscal, annual, or zakat reporting so multiple ledger and obligation tables can reference the same period definition.

## Domain
Core

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| description | String | No | Human-readable label for the year range. |
| fromYear | Int | No | Start year number. |
| fromMonth | Int | No | Start month number. |
| toYear | Int | No | End year number. |
| toMonth | Int | No | End month number. |
| type | CalendarEnumType | Yes | Calendar mode: `ZAKAT`, `ANNUAL`, or `FISCAL`. |
| lockedAt | DateTime | Yes | Timestamp when the period was locked from edits. |

## Relationships
### Belongs To
- None

### Has Many
- ZakatObligation
- BankInterestLiability
- IncomeLedger
- ExpenseLedger
- DonationLedger

## Indexes & Constraints
- Primary key on `id`

## Notes
This is a shared period dimension table used across multiple financial domains.