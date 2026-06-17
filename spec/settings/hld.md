# Settings Domain High-Level Design (HLD)

The settings domain centralizes all app-wide configuration, providing foundational data and preferences for all other features. It manages global calendar years, user profile settings, and category lookup tables. All financial features reference settings data for correct scoping, display, and validation.

## Architecture Decisions

1. **Global Calendar Years**: CalendarYear rows are global, not per-user, ensuring consistent year boundaries for all users and features.
2. **Server Actions for Calendar CRUD**: Calendar management uses Server Actions for progressive enhancement and cache revalidation, not tRPC.
3. **tRPC for Profile/Category**: Profile and category management use tRPC routers for type safety and file upload support.
4. **System-Managed Special Categories**: Special categories are non-editable in UI and protected in backend logic.
5. **Enum-Driven Types**: Calendar and currency types are enforced via Prisma enums for referential integrity and validation.

## Data Model Summary

| Model             | Purpose                                 | Key Fields                        |
|-------------------|-----------------------------------------|-----------------------------------|
| CalendarYear      | Defines fiscal/annual/zakat years       | id, fromYear, toYear, type, lockedAt |
| User              | Stores user profile & preferences       | id, name, email, preferredCurrency, fiscalYearType, timezone, avatarStorageUrl |
| IncomeSource      | Lookup for income categories            | id, name, isActive                |
| ExpenseCategory   | Lookup for expense categories           | id, name, iconName, isActive      |
| SpecialCategory   | System-managed categories               | id, name, isEditable, isActive    |

## Features in Domain

| Feature                | Route                        | Description                                      |
|------------------------|------------------------------|--------------------------------------------------|
| Calendar Management    | /settings/calendar           | Manage fiscal/zakat/annual years                 |
| Profile Settings       | /settings/profile            | User profile, currency, fiscal year, avatar      |
| Category Management    | /settings/categories         | Manage income, expense, special categories       |
| AI Usage (admin only)  | /settings/ai-usage           | View AI spend by user/date (admin only)          |

## Success Criteria
- All financial features reference correct calendar year
- Profile and preferences update instantly and persist
- Category tables are consistent, with system categories protected
- Admin-only features are access-controlled
- No direct DB edits outside tRPC/Server Actions

## Out of Scope
| Area                        | Reason/Notes                        |
|-----------------------------|-------------------------------------|
| Bank/brokerage management   | Managed under banking domain        |
| Password/account deletion   | Not in current scope                |
| Team/multi-user settings    | Not supported                       |
| Notification preferences    | Future feature                      |
| Data backup/export          | Future feature                      |