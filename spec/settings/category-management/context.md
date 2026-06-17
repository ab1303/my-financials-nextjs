# Category Management Context

Category management provides lookup tables for income sources, expense categories, and special categories. These are referenced throughout the app for transaction classification and reporting. Special categories are system-managed and not user-editable.

## Domain Dependencies
- See `spec/settings/hld.md` for IncomeSource, ExpenseCategory, SpecialCategory models

## IN Scope
- CRUD for income sources and expense categories
- List special categories (read-only)
- Tabs for each category type
- tRPC routers for mutations

## OUT of Scope
- Deleting special categories
- Cross-feature category usage
- Category color/icon management beyond current fields
- Bulk import/export

## Patterns to Reuse
- tRPC router for CRUD
- Client Component with tabs
- Table display with action columns
- Zod schema for validation

## Constraints/Gotchas
- Special categories: isEditable=false disables edit/delete
- Category names must be unique
- Only active categories shown in selection UIs