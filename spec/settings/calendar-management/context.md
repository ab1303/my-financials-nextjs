# Calendar Management Context

Calendar management enables creation, editing, and locking of fiscal, annual, and zakat years. All financial records (expenses, income, zakat, donations) are scoped to a CalendarYear. Locking a year prevents further edits, ensuring data integrity for finalized periods.

## Domain Dependencies
- See `spec/settings/hld.md` for architecture, models, and enum types

## IN Scope
- Create, edit, delete calendar years
- Lock/unlock years
- Support FISCAL, ANNUAL, ZAKAT types
- Server Actions for CRUD
- UI table and form

## OUT of Scope
- Per-user calendar years
- Non-Gregorian calendar logic
- Bulk import/export
- Automated year rollover

## Patterns to Reuse
- Server Component + Client Wrapper pattern
- Zod schema for form validation
- Table display with action columns
- Server Actions for mutation + revalidation

## Constraints/Gotchas
- Locked years cannot be edited/deleted
- All features must reference a valid CalendarYear
- Only one unlocked year per type is allowed at a time