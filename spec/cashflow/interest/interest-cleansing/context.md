# Interest Cleansing – Context

## Problem Summary
The Interest Cleansing feature tracks both religious obligation (interest received and cleansed in a calendar year) and tax deductibility (cleansing donations paid in the fiscal year for ATO purposes). The original implementation incorrectly restricted the page to ANNUAL years and hardcoded Jan-Dec windows, causing errors for FISCAL years and back-dated records. The correct design is calendar-reactive: all queries use the selected CalendarYear's window, supporting both ANNUAL and FISCAL types.

## Domain Dependencies
- [Cashflow Domain HLD](../hld.md)
- [Calendar Attribution ADR-1, ADR-4](../../../architecture/calendar-attribution/lld.md)
- [Calendar Year Picker ADR](../../../architecture/calendar-year-picker/lld.md)

## Scope
**IN scope:**
- Tracking interest received and cleansing donations by selected CalendarYear (ANNUAL or FISCAL)
- CalendarYearPicker integration for calendar type selection
- Correct date-range queries for liabilities and donations
- Back-dating support via historical CalendarYear records

**OUT of scope:**
- Zakat calendar support
- Manual tax advice or ATO integration
- Editing or deleting CalendarYear records from this page

## Known Constraints
- Cleansing donations are tax-deductible in Australia (ATO)
- The app does not provide tax or legal advice
