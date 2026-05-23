# Calendar Attribution ADR — Context

## Problem Summary
The app's original use of `calendarId` as a foreign key for associating records with calendar years led to hardcoded logic, type errors, and inflexible date boundaries. This prevented correct handling of back-dated records and multi-dimensional attribution (e.g., a donation counting for both fiscal and zakat years).

## Domain Dependencies
This ADR is referenced by: cashflow/interest/interest-cleansing, cashflow/donations, cashflow/categories, and potentially all cashflow features.

## Scope
**IN scope:**
- How calendar years are defined and attributed to records
- Querying and UI patterns for calendar selection
- Multi-calendar attribution logic
- URL parameter standards for calendar selection

**OUT of scope:**
- Implementation details of individual feature pages
- UI design for year pickers
- Database migration scripts

## Known Constraints / Gotchas
- All queries must use date windows, not calendarId FKs, as the primary filter
- calendarId on ledger records is for audit trail only
- URL param for year must be `?year=<calendarYearId>` (not fromYear/toYear)
- Features must declare supported calendar types per screen

## Reference Format
Other specs should cite this ADR as:

`See [Calendar Attribution ADR](../../../architecture/calendar-attribution/lld.md#adr-X)`
