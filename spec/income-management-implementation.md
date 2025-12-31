# Income Management - Implementation Tracking

## Overview

Implementation tracking for [Income Management PRD](./income-management-prd.md)

**Feature:** Income Management (CRUD + Summary Pages)  
**Started:** December 31, 2025  
**Status:** IN PROGRESS (Phase 6 Complete - Income Summary Page Added)  
**Target Completion:** January 2026

## Implementation Progress

### ✅ Phase 1: Database Schema & Models (COMPLETED)

- [x] **Database Schema** - Create Income and IncomeEntry models in schema.prisma
  - [x] IncomeSourceEnumType enum: EMPLOYMENT, STOCKS, BONDS, RENTAL, BUSINESS, FREELANCE, OTHER
  - [x] Income model: id, calendarId (unique), userId, entries[], createdAt, updatedAt
  - [x] IncomeEntry model: id, dateEarned, amount (Decimal @db.Money), source, incomeId, createdAt, updatedAt
  - [x] Calendar year integration with CalendarEnumType.FISCAL
  - [x] User scoping through foreign key relationships (userId in Income, onDelete: Cascade)
  - [x] Unique constraint on [calendarId, userId] for Income model
  - [x] Index on [incomeId, dateEarned] for IncomeEntry model for performance
- [x] **Database Migrations** - Create and apply new migration for income tables
  - [x] Migration: `20251231052609_add_income_models` (timestamp generated at runtime)
  - [x] Foreign key constraints to CalendarYear and User
  - [x] Cascade delete from Income to IncomeEntry
  - [x] Migration successfully applied and Prisma Client regenerated

**Dependencies:**

- CalendarYear model with FISCAL type entries must exist
- User model with authentication setup

### ✅ Phase 2: Backend Services & Models (COMPLETED)

- [x] **Income Service Layer** - Create comprehensive service implementation
  - [x] `addIncomeCalendarYearDetails(calendarId, userId)` - Create Income records for fiscal years
  - [x] `getIncome(calendarYearId, userId)` - Fetch Income record by fiscal year ID with user scoping
  - [x] `getIncomeEntries(calendarYearId, userId)` - Fetch all entries for calendar year with proper joins (updated signature)
  - [x] `addIncomeEntry(incomeId, input: IncomeEntryInput)` - Create new income entry records
  - [x] `updateIncomeEntry(entryId, input: IncomeEntryInput)` - Update existing entry records
  - [x] `deleteIncomeEntry(entryId)` - Delete entry records with validation
  - [x] `getTotalIncome(calendarYearId, userId)` - Calculate total income dynamically using Prisma aggregate
  - [x] `getMonthlyIncomeSummary(calendarYearId, userId)` - Aggregate entries by month/year with totals
  - [x] `getSourceBreakdown(calendarYearId, month, year, userId)` - Breakdown by source for specific month
  - [x] **Files:** `src/server/services/income.service.ts`
- [x] **Income Models** - TypeScript models definition
  - [x] `IncomeModel` - Main Income record structure with calendar year relation
  - [x] `IncomeEntryModel` - Entry record with dateEarned, amount, source, income relation
  - [x] `IncomeEntryInput` - Service layer input type for create/update operations
  - [x] `MonthlyIncomeSummary` - Type for monthly aggregation results
  - [x] `SourceBreakdown` - Type for source drill-down results
  - [x] **Files:** `src/server/models/income.ts`

**Key Patterns:**

- Use Prisma `aggregate` with `_sum` for total calculations (similar to donations)
- Use Prisma `groupBy` for monthly aggregations
- Convert Decimal to number with `toNumber()` ?? 0 for null safety
- Filter all queries by userId for data isolation

### ✅ Phase 3: Backend Controllers (COMPLETED)

- [x] **Income Controllers** - Backend request handlers implementation
  - [x] `createIncomeYearHandler(calendarYearId, userId)` - Create/retrieve Income year records
  - [x] `incomeHandler(calendarYearId, userId)` - Get Income details for a fiscal year
  - [x] `incomeEntriesHandler(calendarYearId, userId)` - Get all entries for a calendar year
  - [x] `totalIncomeHandler(calendarYearId, userId)` - Get calculated total income
  - [x] `monthlyIncomeSummaryHandler(calendarYearId, userId)` - Get monthly aggregations
  - [x] `sourceBreakdownHandler(calendarYearId, month, year, userId)` - Get source breakdown for month
  - [x] **Files:** `src/server/controllers/income.controller.ts`
- [x] **Error Handling** - Comprehensive error responses
  - [x] User scoping enforced in all handlers
  - [x] Calendar year not found errors handled
  - [x] Income record not found errors handled
  - [x] Database operation errors caught with handleCaughtError
  - [x] Safe defaults returned on error (empty string, 0, undefined)

**Testing:**

- Unit tests for each controller function
- Test user scoping (ensure no cross-user data access)
- Test error handling paths

### ✅ Phase 4: Server Actions & CRUD Operations (COMPLETED)

- [x] **Server Actions Implementation** - Full CRUD operations
  - [x] `addRow(input: CreateIncomeEntryInput)` - Complete implementation with:
    - [x] Session validation (getServerSession)
    - [x] Input validation with CreateIncomeEntrySchema
    - [x] Fiscal year Integration (get/create Income record via createIncomeYearHandler)
    - [x] Amount validation (positive, max 2 decimals via Zod schema)
    - [x] Source validation (valid enum value via Zod schema)
    - [x] Success/error response structure
    - [x] Path revalidation after mutation
  - [x] `editRow(input: UpdateIncomeEntryInput)` - Complete implementation with:
    - [x] Session validation
    - [x] Input validation with UpdateIncomeEntrySchema
    - [x] Service integration (updateIncomeEntry)
    - [x] Success/error response structure
    - [x] Path revalidation after mutation
  - [x] `deleteRow(input: DeleteIncomeEntryInput)` - Complete implementation with:
    - [x] Session validation
    - [x] Input validation with DeleteIncomeEntrySchema
    - [x] Service integration (deleteIncomeEntry)
    - [x] Success/error response structure
    - [x] Path revalidation after mutation
  - [x] **Files:** `src/app/(authorized)/cashflow/income/actions.ts`
- [x] **Zod Validation Schemas** - Type-safe validation
  - [x] `CreateIncomeEntrySchema` - Validation for new entries (date, amount, source)
  - [x] `UpdateIncomeEntrySchema` - Validation for edits
  - [x] `DeleteIncomeEntrySchema` - Validation for deletes
  - [x] Input types inferred from schemas
  - [x] **Files:** `src/app/(authorized)/cashflow/income/_schema.ts`

**Key Validations:**

- dateEarned: Cannot be future, must be within fiscal year range
- amount: Positive decimal with max 2 decimal places
- source: Must be valid IncomeSourceEnumType value

### ✅ Phase 5: Frontend UI & Components - Income CRUD Page (COMPLETED)

- [x] **Main Income Page** - Complete page structure with fiscal year filtering
  - [x] Fiscal year selection dropdown (default to current fiscal year)
  - [x] Total income earned display (non-editable, auto-calculated)
  - [x] Table integration with Suspense loading boundaries
  - [x] Server Component architecture for initial data fetch
  - [x] URL parameter handling for fiscal year selection (?fromYear=2024&toYear=2025)
  - [x] Calendar year type filter (FISCAL only)
  - [x] SEO metadata with Metadata export
  - [x] Session validation and authentication check
  - [x] **Files:** `src/app/(authorized)/cashflow/income/page.tsx`
- [x] **Income Form Component** - Fiscal year selection and total calculation
  - [x] React-select dropdown for fiscal years (filtered by FISCAL type)
  - [x] Non-editable total income display with currency formatting
  - [x] Integration with URL parameters for year selection
  - [x] Proper responsive design and Tailwind styling
  - [x] Accessibility attributes (aria-labels, roles)
  - [x] **Files:** `src/app/(authorized)/cashflow/income/form.tsx`
- [x] **Table Server Component** - Data fetching and session handling
  - [x] Server Component: `IncomeTableServer.tsx` with data fetching
  - [x] Integration with income service for entry fetching
  - [x] Proper error handling and session management (getServerSession)
  - [x] User authentication validation (redirect if unauthenticated)
  - [x] Pass data and server actions to Client Component
  - [x] **Files:** `src/app/(authorized)/cashflow/income/IncomeTableServer.tsx`
- [x] **Table Client Component** - Interactive table with TanStack Table
  - [x] Client Component: `IncomeTableClient.tsx` - Interactive table implementation
  - [x] TanStack Table integration with column definitions
  - [x] Inline editing functionality with temporary row state handling
  - [x] Add/Edit/Delete operations with optimistic updates
  - [x] Date picker integration for dateEarned field
  - [x] Amount input with currency formatting
  - [x] Income source dropdown with enum values
  - [x] Proper error handling and toast notifications
  - [x] State management with StateProvider and reducer
  - [x] Empty state messaging
  - [x] **Files:** `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx`
- [x] **Supporting Files**
  - [x] Column definitions: `_table/columns.tsx`
  - [x] Types: `_types.ts`
  - [x] State management: `StateProvider.tsx`, `reducer.ts`

**Column Definitions:**

1. Date Earned (editable: date picker)
2. Amount Earned (editable: numeric input with currency format)
3. Income Source (editable: dropdown with enum values)
4. Actions (edit/save/delete/cancel icons)

**Icons:**

- Add row: Square plus icon
- Edit: Pen/pencil icon
- Save: Floppy disk icon
- Cancel: X or undo icon
- Delete: Trash/bin icon

### ✅ Phase 6: Frontend UI & Components - Income Summary Page (COMPLETED)

- [x] **Main Income Summary Page** - Analytical page structure
  - [x] Fiscal year selection dropdown (filters CalendarYear by type=FISCAL)
  - [x] Summary statistics panel (total income, average monthly, months recorded)
  - [x] Server Component architecture for data fetching
  - [x] URL parameter handling for calendarYearId selection
  - [x] SEO metadata with Metadata export
  - [x] **Files:** `src/app/(authorized)/reports/income-summary/page.tsx`
- [x] **Summary Client Component** - State management and filtering
  - [x] Fiscal year selection with react-select dropdown
  - [x] URL synchronization for selected year
  - [x] Summary statistics cards (Total, Average, Months Recorded)
  - [x] API integration for monthly summary data
  - [x] **Files:** `src/app/(authorized)/reports/income-summary/IncomeSummaryClient.tsx`
- [x] **Summary Table Component** - Monthly aggregation display
  - [x] Month/Year column with MONTH_NAMES array for display
  - [x] Total Income column with NumericFormat currency formatting
  - [x] Entry count column
  - [x] Expand/Collapse icon column with chevron indicators (FaChevronDown/FaChevronRight)
  - [x] Accordion rows for source breakdown (expandedMonths Set state)
  - [x] Click-to-expand functionality with lazy loading
  - [x] **Files:** `src/app/(authorized)/reports/income-summary/MonthlySummaryTable.tsx`
- [x] **Source Breakdown Row** - Nested source detail view
  - [x] Triggered by clicking month row
  - [x] Nested table with Source, Amount, Percentage, Entries columns
  - [x] Uses INCOME_SOURCE_LABELS for display names
  - [x] NumericFormat for currency and percentage display
  - [x] Visual indentation (px-12 padding) and styling
  - [x] Multiple months can expand simultaneously (Set-based state)
  - [x] **Files:** `src/app/(authorized)/reports/income-summary/SourceBreakdownRow.tsx`
- [x] **API Routes** - Backend endpoints for summary data
  - [x] `/api/income/monthly-summary` - Monthly aggregation data
  - [x] `/api/income/source-breakdown` - Source breakdown for specific month/year
  - [x] Query parameter validation and error handling
  - [x] **Files:** `src/app/api/income/monthly-summary/route.ts`, `src/app/api/income/source-breakdown/route.ts`
- [x] **Navigation Updates** - Reports section integration
  - [x] Created IconChartBar for Reports section
  - [x] Added Reports Disclosure section in SideNav
  - [x] Added "Income Summary" link to Reports section
  - [x] **Files:** `src/layouts/SideNavIcons/IconChartBar.tsx`, `src/layouts/SideNav.tsx`

**Implementation Notes:**

- Skipped Year-over-Year comparison (can be added later as enhancement)
- Used lazy loading pattern for source breakdowns (fetched on expand)
- Summary statistics calculate from client-side data (total, average, count)
- Route builds successfully at 7.68 kB + 218 kB shared chunks
  - [ ] Color coding for increases (green) and decreases (red)
  - [ ] Handle missing data gracefully (N/A display)
  - [ ] **Files:** `src/app/(authorized)/reports/income-summary/YearComparison.tsx`

**Empty States:**

- No income entries: "No income recorded for this period."
- No fiscal years: "No fiscal years configured. Please contact support."
- Network error: Toast notification with retry option

### ✅ Phase 7: State Management & Data Flow (COMPLETED)

- [x] **State Provider** - React Context with useReducer
  - [x] `IncomeEntryStateProvider` - Context provider component for Income CRUD page
  - [x] Initial data loading and state management
  - [x] Actions: INITIAL_DATA, ADD_ENTRY, EDIT_ENTRY, REMOVE_ENTRY
  - [x] State shape: entries array with IncomeEntryType
  - [x] **Files:** `src/app/(authorized)/cashflow/income/StateProvider.tsx`
- [x] **Reducer Implementation** - State management with Immer
  - [x] Immutable state updates with Immer produce
  - [x] Type-safe action handling
  - [x] **Files:** `src/app/(authorized)/cashflow/income/reducer.ts`

**State Management Pattern:**

- ✅ Used Context + useReducer for complex state (entry management)
- ✅ Server Actions update database, then refresh client state via router.refresh()

### ✅ Phase 8: Navigation & Routing (COMPLETED)

- [x] **Update Navigation Menu** - Add Income links
  - [x] "Income" link added to CashFlow section (already in navigation)
  - [x] Proper active state styling for current route (SideNavLink component)
  - [x] Icon integration (IconCashCoin)
  - [x] **Files:** `src/layouts/SideNav.tsx`
- [x] **Route Setup** - Routes properly configured
  - [x] `/cashflow/income` route (Income CRUD page) - fully functional
  - [x] Authentication middleware via getServerSession
  - [x] **Files:** `src/app/(authorized)/cashflow/income/page.tsx`

**Navigation Structure:**

```
CashFlow
├─ Bank Interest
├─ Donations
└─ Income (NEW)

Reports (NEW SECTION)
└─ Income Summary (NEW)
```

### ⬜ Phase 9: Validation & Error Handling (NOT STARTED)

- [ ] **Client-Side Validation** - Immediate user feedback
  - [ ] Date picker restrictions (no future dates, within fiscal year)
  - [ ] Amount input validation (positive, max 2 decimals, numeric only)
  - [ ] Income source dropdown required validation
  - [ ] Visual error indicators (red borders, error text)
  - [ ] Disable save button until all validations pass
- [ ] **Server-Side Validation** - Data integrity enforcement
  - [ ] Zod schema validation in Server Actions
  - [ ] Date range validation against fiscal year period
  - [ ] Amount format validation (positive Decimal)
  - [ ] Income source enum validation
  - [ ] User ownership verification (prevent cross-user modifications)
- [ ] **Error Response Handling** - User-friendly error messages
  - [ ] Network errors: "Failed to save income entry. Please try again."
  - [ ] Validation errors: Specific field-level messages
  - [ ] Authentication errors: "Session expired. Please log in again."
  - [ ] Database errors: "An unexpected error occurred. Please contact support."
  - [ ] Toast notifications for all error scenarios

### ⬜ Phase 10: Testing & Quality Assurance (NOT STARTED)

- [ ] **Unit Tests** - Service and controller layer
  - [ ] Test all service functions with mock Prisma client
  - [ ] Test controller handlers with mock services
  - [ ] Test error handling paths
  - [ ] Test user scoping (ensure no cross-user data leaks)
- [ ] **Integration Tests** - Server Actions and API routes
  - [ ] Test full CRUD workflow with test database
  - [ ] Test authentication and authorization
  - [ ] Test validation error responses
  - [ ] Test edge cases (empty states, invalid inputs)
- [ ] **Component Tests** - React Testing Library
  - [ ] Test IncomeTableClient component interactions
  - [ ] Test form validation behavior
  - [ ] Test accordion expand/collapse
  - [ ] Test year-over-year comparison toggle
- [ ] **E2E Tests** - Playwright or Cypress
  - [ ] Test full user workflows from login to income entry
  - [ ] Test summary page filtering and drill-down
  - [ ] Test responsive design on mobile viewports
  - [ ] Test accessibility with screen readers

### ⬜ Phase 11: Documentation & Deployment (NOT STARTED)

- [ ] **Code Documentation** - Inline comments and JSDoc
  - [ ] Document complex algorithms (monthly aggregation, source breakdown)
  - [ ] JSDoc comments for all service functions
  - [ ] Type documentation for complex types
- [ ] **README Updates** - Feature documentation
  - [ ] Add Income Management section to project README
  - [ ] Document environment variables if any added
  - [ ] Update feature list and roadmap
- [ ] **Migration Guide** - For existing users
  - [ ] Document database migration steps
  - [ ] Explain new navigation structure
  - [ ] Provide example use cases and workflows
- [ ] **Deployment Checklist** - Production readiness
  - [ ] Run `pnpm run build` to ensure no build errors
  - [ ] Fix any TypeScript errors or linting warnings
  - [ ] Test migrations on staging database
  - [ ] Verify environment variables in production
  - [ ] Monitor error logs post-deployment

## Technical Context

### Database Schema Design

Following the two-tier pattern established by Zakat and Donations:

**Income (Parent Record):**

- One record per fiscal year per user
- Links to CalendarYear with FISCAL type
- User scoped with CASCADE delete
- Unique constraint on (calendarId, userId)

**IncomeEntry (Child Record):**

- Multiple entries per Income record
- Contains dateEarned, amount, source
- Cascades delete when Income is deleted
- Indexed on (incomeId, dateEarned) for performance

**Relationships:**

```
User ──1:N──> Income ──1:N──> IncomeEntry
CalendarYear ──1:1──> Income
```

### Service Layer Patterns

**CRUD Services:**

- Follow donations pattern: `add{Entity}`, `get{Entity}`, `update{Entity}`, `delete{Entity}`
- Always include userId parameter for user scoping
- Return typed models (not raw Prisma objects)

**Aggregation Services:**

- Use Prisma `aggregate` for totals: `_sum: { amount: true }`
- Use Prisma `groupBy` for monthly summaries
- Convert Decimal to number: `result._sum.amount?.toNumber() ?? 0`
- Filter by date ranges using `gte` and `lte` operators

### Frontend Architecture

**Page Structure:**

1. Server Component (page.tsx) - Fetch data, handle auth
2. Client Wrapper Component (StateProvider) - Manage state
3. Interactive Components (Table, Form) - User interactions

**Data Flow:**

```
Server Component (fetch data)
    ↓
Client Wrapper (receive props, create actions)
    ↓
Table Component (render, handle user interactions)
    ↓
Server Actions (CRUD operations)
    ↓
Database (persist changes)
    ↓
Revalidate/Refresh (update UI)
```

### Code Patterns Reference

**Similar to Donations:**

- Two-tier structure (Donation → DonationPayment ~= Income → IncomeEntry)
- Server Actions in actions.ts file
- TanStack Table with inline editing
- Fiscal year filtering
- Beneficiary pattern NOT used (Income uses source enum instead)

**Similar to Zakat:**

- Calendar year integration
- Total calculation with aggregate
- Form component with year dropdown
- StateProvider pattern

## Dependencies & Blockers

### Dependencies

1. ✅ CalendarYear model with FISCAL type entries exists
2. ✅ User authentication system (NextAuth) working
3. ✅ Prisma ORM configured and migrated
4. ✅ TanStack Table library installed
5. ✅ React Hook Form and Zod installed

### Potential Blockers

- **Calendar Setup:** If no FISCAL calendar years exist, users cannot add income entries
  - **Mitigation:** Create seed data or admin interface for calendar year setup
- **Performance:** Large datasets (1000+ entries) may slow summary calculations
  - **Mitigation:** Implement pagination, database indexing, consider caching for summaries
- **Mobile UX:** Complex table interactions difficult on small screens
  - **Mitigation:** Implement responsive stacked card layout for mobile

## Testing Plan

### Test Scenarios

**Income CRUD Page:**

1. Add new income entry with valid data → Success
2. Add entry with future date → Validation error
3. Add entry with negative amount → Validation error
4. Edit existing entry → Success
5. Delete entry with confirmation → Success
6. Cancel edit without saving → No changes
7. Switch fiscal years → Table updates
8. View total income → Calculates correctly

**Income Summary Page:** 9. Select different calendar year types → Data refreshes 10. Filter by income source → Shows only selected source 11. Expand month row → Shows source breakdown 12. Collapse month row → Hides breakdown 13. Toggle year-over-year comparison → Shows comparison view 14. View empty state → Appropriate message shown

**Security:** 15. Unauthenticated access → Redirects to login 16. User A cannot see User B's income → Data isolated 17. Tampered Server Action request → Rejected

## Deployment Notes

### Pre-Deployment Checklist

- [ ] Run `pnpm run build` - Fix all build errors
- [ ] Run linter - Fix all linting warnings
- [ ] Test database migration on staging database
- [ ] Verify all environment variables set in production
- [ ] Test authentication flow in production environment
- [ ] Verify calendar year data exists for current fiscal year
- [ ] Monitor error logs for first 24 hours post-deployment

### Rollback Plan

If critical issues arise:

1. Revert to previous deployment
2. Keep database migration (no data loss)
3. Income and IncomeEntry tables remain but unused
4. Can safely retry deployment after fixes

### Post-Deployment Monitoring

- Monitor error rates for Server Actions
- Check page load times (target: <2s)
- Monitor database query performance
- Track user adoption metrics (entries per day)
- Collect user feedback on UX

## Notes

### Implementation Approach

Follow the established pattern from Donations management for consistency:

1. Start with database schema and migrations (Phase 1)
2. Build service layer with comprehensive CRUD (Phase 2)
3. Add controllers and Server Actions (Phases 3-4)
4. Implement Income CRUD page first (Phases 5, 7)
5. Then implement Summary page (Phase 6, 7)
6. Add navigation and routing (Phase 8)
7. Comprehensive testing (Phase 10)
8. Documentation and deployment (Phase 11)

### Key Differences from Donations

**Income has:**

- Source enum instead of beneficiary entities
- Two separate pages (CRUD + Summary) instead of one
- Monthly aggregation and drill-down features
- Year-over-year comparison functionality
- More complex summary calculations

**Income does NOT have:**

- Beneficiary relationships (Individual/Business)
- Tax category field (may add in future)
- Single-page design

### Future Enhancements (Out of Scope for v1)

- Export to CSV/PDF for tax filing
- Recurring income automation (e.g., monthly salary)
- Multi-currency support
- Integration with bank APIs for automatic import
- Charts and visualizations (graphs, pie charts)
- Budget vs actual income comparison
- Income forecasting and projections
- Mobile app for quick income logging
- Email reminders to log income regularly

---

**Last Updated:** [Timestamp will be added by implementer]  
**Updated By:** [Name will be added by implementer]
