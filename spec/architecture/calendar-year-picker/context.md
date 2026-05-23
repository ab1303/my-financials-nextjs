# Calendar Year Picker — Context

## Problem Summary
Year selection patterns are inconsistent across feature pages, leading to poor UX and technical debt. Each page implements its own toggle and dropdown logic, with mismatched labels, URL params, and no shared component. This spec standardises the calendar year picker as a reusable infrastructure UI component.

## Domain Dependencies
- Relies on Calendar Attribution ADR ([spec/architecture/calendar-attribution/lld.md](../calendar-attribution/lld.md)) for calendar type semantics and year boundaries.

## Scope
**IN scope:**
- Shared CalendarYearPicker component (type toggle + year dropdown)
- URL param standardisation (`?year=<calendarYearId>`, survives refresh)
- Migration of bank-interest and donations pages to use new component
- Service fix for correct date boundaries

**OUT of scope:**
- Per-feature customisation beyond declared API
- Legacy support for `?fromYear`/`?toYear` params
- Non-cashflow features

## Known Constraints
- react-select must use unstyled + classNames pattern for dark mode
- URL state must persist across refresh and navigation
- Only pages listed below will be migrated

## Pages to Migrate
- bank-interest (form.tsx, page.tsx)
- donations (form.tsx)
