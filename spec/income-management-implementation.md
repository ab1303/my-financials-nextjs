# Income Management - Implementation Tracking

## Overview

Implementation tracking for [Income Management PRD](./income-management-prd.md)

**Feature:** Income Management (CRUD + Summary Pages)  
**Started:** [To be filled by implementer]  
**Status:** NOT STARTED  
**Target Completion:** [To be estimated by implementer]

## Implementation Progress

### ⬜ Phase 1: Database Schema & Models (NOT STARTED)

- [ ] **Database Schema** - Create Income and IncomeEntry models in schema.prisma
  - [ ] IncomeSourceEnumType enum: EMPLOYMENT, STOCKS, BONDS, RENTAL, BUSINESS, FREELANCE, OTHER
  - [ ] Income model: id, calendarId (unique), userId, entries[], createdAt, updatedAt
  - [ ] IncomeEntry model: id, dateEarned, amount (Decimal @db.Money), source, incomeId, createdAt, updatedAt
  - [ ] Calendar year integration with CalendarEnumType.FISCAL
  - [ ] User scoping through foreign key relationships (userId in Income, onDelete: Cascade)
  - [ ] Unique constraint on [calendarId, userId] for Income model
  - [ ] Index on [incomeId, dateEarned] for IncomeEntry model for performance
- [ ] **Database Migrations** - Create and apply new migration for income tables
  - [ ] Migration: `YYYYMMDDHHMMSS_add_income_models` (timestamp generated at runtime)
  - [ ] Foreign key constraints to CalendarYear and User
  - [ ] Cascade delete from Income to IncomeEntry
  - [ ] Test migration rollback safety

**Dependencies:**

- CalendarYear model with FISCAL type entries must exist
- User model with authentication setup

### ⬜ Phase 2: Backend Services & Models (NOT STARTED)

- [ ] **Income Service Layer** - Create comprehensive service implementation
  - [ ] `addIncomeCalendarYearDetails(calendarId, userId)` - Create Income records for fiscal years
  - [ ] `getIncome(calendarYearId, userId)` - Fetch Income record by fiscal year ID with user scoping
  - [ ] `getIncomeEntries(incomeId)` - Fetch all entries for an Income record with proper joins
  - [ ] `addIncomeEntry(incomeId, input: IncomeEntryInput)` - Create new income entry records
  - [ ] `updateIncomeEntry(entryId, input: IncomeEntryInput)` - Update existing entry records
  - [ ] `deleteIncomeEntry(entryId)` - Delete entry records with validation
  - [ ] `getTotalIncome(calendarYearId, userId)` - Calculate total income dynamically using Prisma aggregate
  - [ ] `getMonthlyIncomeSummary(calendarYearId, userId)` - Aggregate entries by month/year with totals
  - [ ] `getSourceBreakdown(calendarYearId, month, year, userId)` - Breakdown by source for specific month
  - [ ] **Files:** `src/server/services/income.service.ts`
- [ ] **Income Models** - TypeScript models definition
  - [ ] `IncomeModel` - Main Income record structure with calendar year relation
  - [ ] `IncomeEntryModel` - Entry record with dateEarned, amount, source, income relation
  - [ ] `IncomeEntryInput` - Service layer input type for create/update operations
  - [ ] `MonthlyIncomeSummary` - Type for monthly aggregation results
  - [ ] `SourceBreakdown` - Type for source drill-down results
  - [ ] **Files:** `src/server/models/income.ts`

**Key Patterns:**

- Use Prisma `aggregate` with `_sum` for total calculations (similar to donations)
- Use Prisma `groupBy` for monthly aggregations
- Convert Decimal to number with `toNumber()` ?? 0 for null safety
- Filter all queries by userId for data isolation

### ⬜ Phase 3: Backend Controllers (NOT STARTED)

- [ ] **Income Controllers** - Backend request handlers implementation
  - [ ] `createIncomeYearHandler(calendarYearId, userId)` - Create/retrieve Income year records
  - [ ] `incomeHandler(calendarYearId, userId)` - Get Income details for a fiscal year
  - [ ] `incomeEntriesHandler(incomeId)` - Get all entries for an Income record
  - [ ] `totalIncomeHandler(calendarYearId, userId)` - Get calculated total income
  - [ ] `monthlyIncomeSummaryHandler(calendarYearId, userId)` - Get monthly aggregations
  - [ ] `sourceBreakdownHandler(calendarYearId, month, year, userId)` - Get source breakdown for month
  - [ ] **Files:** `src/server/controllers/income.controller.ts`
- [ ] **Error Handling** - Comprehensive error responses
  - [ ] User not found errors
  - [ ] Calendar year not found errors
  - [ ] Income record not found errors
  - [ ] Validation errors with detailed messages
  - [ ] Database operation errors

**Testing:**

- Unit tests for each controller function
- Test user scoping (ensure no cross-user data access)
- Test error handling paths

### ⬜ Phase 4: Server Actions & CRUD Operations (NOT STARTED)

- [ ] **Server Actions Implementation** - Full CRUD operations
  - [ ] `addRow(input: CreateIncomeEntryInput)` - Complete implementation with:
    - [ ] Session validation (getServerSession)
    - [ ] Input validation with Zod schema
    - [ ] Fiscal year Integration (get/create Income record)
    - [ ] Date range validation (within fiscal year)
    - [ ] Amount validation (positive, max 2 decimals)
    - [ ] Source validation (valid enum value)
    - [ ] Success/error response structure
  - [ ] `editRow(entryId, input: UpdateIncomeEntryInput)` - Complete implementation with:
    - [ ] Entry existence validation
    - [ ] User ownership verification
    - [ ] Input validation with Zod schema
    - [ ] Service integration
    - [ ] Success/error response structure
  - [ ] `deleteRow(entryId)` - Complete implementation with:
    - [ ] Entry existence validation
    - [ ] User ownership verification
    - [ ] Proper confirmation handling
    - [ ] Cascade considerations (no children to worry about)
    - [ ] Success/error response structure
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/actions.ts`
- [ ] **Zod Validation Schemas** - Type-safe validation
  - [ ] `CreateIncomeEntrySchema` - Validation for new entries
  - [ ] `UpdateIncomeEntrySchema` - Validation for edits
  - [ ] Input types inferred from schemas
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/_schema.ts`

**Key Validations:**

- dateEarned: Cannot be future, must be within fiscal year range
- amount: Positive decimal with max 2 decimal places
- source: Must be valid IncomeSourceEnumType value

### ⬜ Phase 5: Frontend UI & Components - Income CRUD Page (NOT STARTED)

- [ ] **Main Income Page** - Complete page structure with fiscal year filtering
  - [ ] Fiscal year selection dropdown (default to current fiscal year)
  - [ ] Total income earned display (non-editable, auto-calculated)
  - [ ] Table integration with Suspense loading boundaries
  - [ ] Server Component architecture for initial data fetch
  - [ ] URL parameter handling for fiscal year selection (?fromYear=2024&toYear=2025)
  - [ ] Calendar year type filter (FISCAL only)
  - [ ] SEO metadata with generateMetadata
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/page.tsx`
- [ ] **Income Form Component** - Fiscal year selection and total calculation
  - [ ] React-select dropdown for fiscal years (filtered by FISCAL type)
  - [ ] Non-editable total income display with currency formatting
  - [ ] Integration with URL parameters for year selection
  - [ ] Proper responsive design and Tailwind styling
  - [ ] Accessibility attributes (aria-labels, roles)
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/form.tsx`
- [ ] **Table Server Component** - Data fetching and session handling
  - [ ] Server Component: `IncomeTableServer.tsx` with data fetching
  - [ ] Integration with income service for entry fetching
  - [ ] Proper error handling and session management (getServerSession)
  - [ ] User authentication validation (redirect if unauthenticated)
  - [ ] Pass data and server actions to Client Component
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/IncomeTableServer.tsx`
- [ ] **Table Client Component** - Interactive table with TanStack Table
  - [ ] Client Component: `IncomeTableClient.tsx` - Interactive table implementation
  - [ ] TanStack Table integration with column definitions
  - [ ] Inline editing functionality with temporary row state handling
  - [ ] Add/Edit/Delete operations with optimistic updates
  - [ ] Date picker integration for dateEarned field
  - [ ] Amount input with currency formatting
  - [ ] Income source dropdown with searchable options
  - [ ] Proper error handling and toast notifications
  - [ ] Accessibility: keyboard navigation, focus management, screen reader support
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx`

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

### ⬜ Phase 6: Frontend UI & Components - Income Summary Page (NOT STARTED)

- [ ] **Main Income Summary Page** - Analytical page structure
  - [ ] Calendar year type selection dropdown (ZAKAT, ANNUAL, FISCAL)
  - [ ] Calendar year selection dropdown (filtered by type)
  - [ ] Income source filter dropdown (All Sources + enum values)
  - [ ] Summary statistics panel (total, average, highest month, top source)
  - [ ] Server Component architecture for data fetching
  - [ ] URL parameter handling for year type and year selection
  - [ ] SEO metadata with generateMetadata
  - [ ] **Files:** `src/app/(authorized)/reports/income-summary/page.tsx`
- [ ] **Summary Table Component** - Monthly aggregation display
  - [ ] Month/Year column with chronological ordering
  - [ ] Total Income column with currency formatting
  - [ ] Trend icon column (up/down/neutral arrows with colors)
  - [ ] Expand/Collapse icon column (chevron indicators)
  - [ ] Accordion rows for source breakdown
  - [ ] TanStack Table integration for sorting/filtering
  - [ ] **Files:** `src/app/(authorized)/reports/income-summary/SummaryTable.tsx`
- [ ] **Source Breakdown Accordion** - Nested source detail view
  - [ ] Triggered by clicking month row
  - [ ] Nested table with Source, Amount, Percentage columns
  - [ ] Smooth expand/collapse animation
  - [ ] Visual indentation and styling for nesting
  - [ ] Multiple months can expand simultaneously
  - [ ] **Files:** `src/app/(authorized)/reports/income-summary/SourceBreakdown.tsx`
- [ ] **Year-over-Year Comparison Component** - Comparative analysis view
  - [ ] Toggle control to switch modes (single vs comparison)
  - [ ] Side-by-side year columns
  - [ ] Change percentage calculation and display
  - [ ] Color coding for increases (green) and decreases (red)
  - [ ] Handle missing data gracefully (N/A display)
  - [ ] **Files:** `src/app/(authorized)/reports/income-summary/YearComparison.tsx`

**Empty States:**

- No income entries: "No income recorded for this period."
- No fiscal years: "No fiscal years configured. Please contact support."
- Network error: Toast notification with retry option

### ⬜ Phase 7: State Management & Data Flow (NOT STARTED)

- [ ] **State Provider** - React Context with useReducer
  - [ ] `IncomeEntryStateProvider` - Context provider component for Income CRUD page
  - [ ] Initial data loading and state management
  - [ ] Actions: ADD_ROW, EDIT_ROW, SAVE_ROW, DELETE_ROW, CANCEL_EDIT
  - [ ] State shape: entries array, editingId, tempRow
  - [ ] **Files:** `src/app/(authorized)/cashflow/income/StateProvider.tsx`
- [ ] **Summary State Management** - For Income Summary page
  - [ ] Calendar year type and year selection state
  - [ ] Income source filter state
  - [ ] Expanded months tracking (Set<string> for accordion state)
  - [ ] Comparison mode toggle state
  - [ ] **Files:** `src/app/(authorized)/reports/income-summary/SummaryStateProvider.tsx`

**State Management Pattern:**

- Use Context + useReducer for complex state (multiple related state values)
- Use useState for simple toggles and filters
- Server Actions update database, then refresh client state

### ⬜ Phase 8: Navigation & Routing (NOT STARTED)

- [ ] **Update Navigation Menu** - Add Income links
  - [ ] Add "Income" link to CashFlow section (existing section)
  - [ ] Create new "Reports" section in navigation
  - [ ] Add "Income Summary" link to Reports section
  - [ ] Proper active state styling for current route
  - [ ] **Files:** `src/components/Navbar.tsx` or similar navigation component
- [ ] **Route Setup** - Ensure routes are properly configured
  - [ ] `/cashflow/income` route (Income CRUD page)
  - [ ] `/reports/income-summary` route (Summary page)
  - [ ] Proper authentication middleware (redirect to login if unauthenticated)
  - [ ] **Files:** App router structure under `src/app/`

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
