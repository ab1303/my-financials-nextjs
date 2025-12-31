# PRD: Income Management

## 1. Product overview

### 1.1 Document title and version

- PRD: Income Management
- Version: 1.0

### 1.2 Product summary

This feature enables authenticated users to comprehensively track and analyze their income across multiple sources and calendar year types. Users can record individual income entries with amount, date, and source category, then view aggregated summaries with drill-down capabilities for detailed analysis. The system supports tracking income across ZAKAT, ANNUAL, and FISCAL calendar year types with flexible filtering and year-over-year comparisons.

The feature consists of two distinct pages:

1. **Income CRUD Page** (`/cashflow/income`): Operational page for adding, editing, and deleting income entries, defaulting to fiscal year view for ease of tax preparation.
2. **Income Summary Page** (`/reports/income-summary`): Analytical page providing monthly aggregations, source breakdowns, and year-over-year comparisons across any calendar year type.

This is a record-keeping and analysis system - users manually enter income they have already received through various channels. The feature follows the same architectural patterns as the existing Donations and Zakat management systems with two-tier data structure (Income → IncomeEntry) and Server Actions-based CRUD operations.

## 2. Goals

### 2.1 Business goals

- Provide comprehensive income tracking for financial planning and tax compliance.
- Enable users to analyze income patterns across multiple calendar year types.
- Support informed financial decision-making through detailed income source analysis.
- Streamline tax preparation by organizing income data by fiscal year.
- Enhance user engagement by offering practical personal finance management tools.

### 2.2 User goals

- Easily track all income sources in one centralized location.
- View income organized by fiscal year for tax filing purposes.
- Analyze income patterns by month, source, and calendar year type.
- Compare income year-over-year to identify trends and growth.
- Maintain accurate records for financial planning and budgeting.
- Generate income summaries for specific time periods and sources.

### 2.3 Non-goals

- Tax calculation or financial advice features (purely record-keeping and reporting).
- Integration with bank accounts or automatic income import.
- Invoice generation or payment processing functionality.
- Support for multiple currencies (USD only in initial version).
- Budget forecasting or predictive analytics.
- Export to external tax software or accounting systems (future enhancement).
- Support for unauthenticated or guest users.
- Tracking of expense or deduction data (separate feature domain).

## 3. User personas

### 3.1 Key user types

- Authenticated individual users who earn income from multiple sources and need organized tracking for financial planning and tax preparation.

### 3.2 Basic persona details

- **Multi-source earner**: An individual with diverse income streams (employment, investments, rental properties, freelance work) who needs consolidated tracking and analysis across different calendar year types for comprehensive financial management.
- **Tax-conscious professional**: A user who requires organized income records by fiscal year for accurate tax filing and wants to identify deductible expenses and tax-advantaged opportunities.
- **Financial planner**: An individual focused on understanding income patterns, growth trends, and source diversification for long-term financial planning and goal setting.

### 3.3 Role-based access

- **Authenticated user**: Can add, edit, delete, and view their own income records and summaries. All data is strictly scoped to the authenticated user - users cannot see or modify income records of other users.

## 4. Functional requirements

### 4.1 Income CRUD operations (Priority: High)

- **Add income entry** (Priority: High)
  - Users can add new income entries for the selected fiscal year.
  - Required fields: date earned, amount earned (USD), income source.
  - Validations:
    - Amount must be positive with up to two decimal places (e.g., 5250.75).
    - Amount cannot be negative or zero.
    - Date must be in ISO 8601 format (YYYY-MM-DD), cannot be in the future.
    - Date must fall within the selected fiscal year period.
    - Income source must be selected from predefined enum values.
  - Creates Income record for fiscal year if not already exists.
  - Creates IncomeEntry record linked to Income record.

- **Edit income entry** (Priority: High)
  - Users can modify any income entry for the selected fiscal year.
  - All validations from add operation apply.
  - Inline editing within table for quick updates.
  - Cancel operation reverts to original values without saving.

- **Delete income entry** (Priority: High)
  - Users can remove income entries with confirmation prompt.
  - Deletion affects only the specific entry, not the entire fiscal year record.
  - Total income automatically recalculates after deletion.

- **Fiscal year filtering** (Priority: Medium)
  - Income CRUD page defaults to fiscal year type for ease of tax preparation.
  - Dropdown selection changes the displayed fiscal year period.
  - CRUD operations affect only the currently selected fiscal year.
  - Automatic calculation of "Total Earned" based on filtered records.

- **Authentication** (Priority: High)
  - Only authenticated users can access and modify their own income records.
  - User session validated on every server action.
  - Data strictly scoped to authenticated user's ID.

### 4.2 Income summary and analysis (Priority: High)

- **Calendar year type selection** (Priority: High)
  - Dropdown allows selection of ZAKAT, ANNUAL, or FISCAL calendar year types.
  - Displays list of available calendar years of selected type.
  - Refreshes summary data when year selection changes.

- **Monthly aggregation view** (Priority: High)
  - Displays each month/year combination for selected calendar year.
  - Shows total income earned per month.
  - Sortable and filterable by month/year.

- **Income source drill-down** (Priority: High)
  - Clicking a month row expands inline accordion.
  - Shows breakdown by income source within that month.
  - Displays amount earned per source category.
  - Collapsible to return to monthly summary view.

- **Income source filtering** (Priority: Medium)
  - Dropdown filter for income source categories.
  - Filters entire summary view to show only selected source.
  - "All Sources" option to show complete data.

- **Year-over-year comparison** (Priority: Medium)
  - Side-by-side comparison of current year vs previous year(s).
  - Percentage change indicators for growth/decline.
  - Visual indicators for significant changes.

- **Dynamic calculation** (Priority: High)
  - All summaries calculated on-the-fly from IncomeEntry records.
  - No stored aggregates - ensures data consistency.
  - Real-time updates when data changes on CRUD page.

### 4.3 Income source categories (Priority: High)

Predefined enum values for income source selection:

- **EMPLOYMENT**: Salary, wages, bonuses from employment
- **STOCKS**: Dividends, capital gains, stock sales
- **BONDS**: Interest income from bonds and fixed-income securities
- **RENTAL**: Property rental income, lease payments
- **BUSINESS**: Business profits, partnership income, self-employment
- **FREELANCE**: Contract work, gig economy, consulting fees
- **OTHER**: Miscellaneous income not fitting other categories

## 5. User experience

### 5.1 Entry points & first-time user flow

#### 5.1.1 Income CRUD page entry

- User logs in and clicks "Income" from the CashFlow section in the left navigation menu.
- User lands on the Income page at `/cashflow/income`.
- Page automatically loads with current fiscal year pre-selected (e.g., "Fiscal Year (2024-2025)").
- System displays existing income entries (if any) for the selected fiscal year.
- Empty state shows table headers: Date Earned, Amount Earned, Income Source, Actions.
- "Total Earned" field displays $0.00 for new fiscal years.

#### 5.1.2 Income summary page entry

- User clicks "Income Summary" from Reports section in left navigation menu (new section).
- User lands on Income Summary page at `/reports/income-summary`.
- Page displays calendar year type dropdown (defaulting to FISCAL) and year selection dropdown.
- Initially shows monthly aggregation table for selected year.
- Empty state shows message: "No income recorded for this period."

### 5.2 Core experience - Income CRUD page

#### 5.2.1 Page structure and fiscal year selection

- **Page Header**: "Income" title with breadcrumb navigation (CashFlow > Income).
- **Fiscal Year Selection**: Dropdown with available fiscal years from calendar system.
  - Format: "Fiscal Year (2024-2025)", "Fiscal Year (2023-2024)", etc.
  - Defaults to current fiscal year based on today's date.
  - Changing selection reloads table with entries for new fiscal year.
- **Total Earned Display**: Non-editable field showing sum of all income for selected fiscal year.
  - Format: "Total Earned: $12,450.75"
  - Updates automatically when entries are added, edited, or deleted.
- **Income Entries Section**: TanStack Table displaying individual income entries with inline editing.

#### 5.2.2 Add income entry workflow

- **Add Income Trigger**: User clicks `+` icon button (square shape with plus) above the income table.
- **New Row Creation**: System immediately adds editable row at bottom of table with:
  - **Date Earned**: Interactive date picker (calendar widget) defaulting to current date.
    - Validation: Cannot select future dates or dates outside fiscal year range.
    - Visual feedback for invalid date selections.
  - **Amount Earned**: Numeric input field (initially empty, user must enter amount).
    - Placeholder: "$0.00"
    - Validation: Must be positive, max 2 decimal places, no upper limit.
    - Format: Automatically formats with comma separators (e.g., "12,450.75").
  - **Income Source**: Dropdown with predefined source categories.
    - Options: Employment, Stocks, Bonds, Rental, Business, Freelance, Other
    - No default selection - user must choose.
    - Searchable dropdown for quick selection.
  - **Actions**: Shows floppy disk save icon for persisting the record.
    - Cancel/undo icon to discard new entry without saving.
- **Field Validation**:
  - Date picker restricts to fiscal year date range.
  - Amount field shows error message for invalid inputs (negative, zero, >2 decimals).
  - Income Source required - save disabled until selected.
  - All fields required before save operation can complete.
  - Visual indicators (red border, error text) for validation failures.
- **Save Action**: User clicks floppy disk save icon to create income entry.
  - Server action creates Income record (if first entry for fiscal year).
  - Server action creates IncomeEntry record linked to Income.
  - Success toast notification: "Income entry added successfully."
  - Total Earned updates immediately without page refresh.
- **Post-Save State**: Row transforms from editable form fields to read-only labels with pen (edit) and trash (delete) icons.
  - Date displayed in localized format: "Jan 15, 2025"
  - Amount displayed with currency: "$5,250.75"
  - Source displayed as readable label: "Employment"

#### 5.2.3 Edit income entry workflow

- **Edit Trigger**: User clicks pen (edit) icon on any existing income row.
- **Edit Mode**: Selected row transforms to interactive form fields:
  - **Date Earned**: Date picker with current value pre-selected.
  - **Amount Earned**: Numeric input with current amount pre-filled.
  - **Income Source**: Dropdown with current source pre-selected.
  - **Actions**: Shows floppy disk save icon and cancel/undo icon.
- **Inline Editing**: Only one row editable at a time for clarity.
  - Other rows remain read-only during editing.
  - Clicking edit on another row auto-cancels current edit.
- **Save Changes**: User clicks floppy disk save icon to update record.
  - Server action validates and updates IncomeEntry record.
  - Success toast notification: "Income entry updated successfully."
  - Total Earned recalculates if amount changed.
- **Cancel Changes**: User clicks cancel/undo icon to revert to original values.
  - No server call, immediate local state reset.
  - Row returns to read-only format.
- **Post-Save State**: Row returns to read-only format with pen and trash icons.

#### 5.2.4 Delete income entry workflow

- **Delete Trigger**: User clicks trash (delete) icon on any existing income row.
- **Confirmation Dialog**: System displays confirmation prompt to prevent accidental deletion.
  - Message: "Are you sure you want to delete this income entry? This action cannot be undone."
  - Buttons: "Cancel" (default focus) and "Delete" (destructive style).
- **Delete Action**: Upon confirmation, server action removes IncomeEntry record.
  - Row immediately removed from table with fade-out animation.
  - Success toast notification: "Income entry deleted successfully."
- **Total Update**: "Total Earned" field automatically recalculates without page refresh.
- **Empty State**: If last entry deleted, table shows empty state message.

### 5.3 Core experience - Income summary page

#### 5.3.1 Page structure and calendar year selection

- **Page Header**: "Income Summary" title with breadcrumb navigation (Reports > Income Summary).
- **Calendar Year Type Selection**: Dropdown with calendar year types.
  - Options: Zakat Year, Annual Year, Fiscal Year
  - Default: Fiscal Year (most common for tax reporting).
  - Changing type refreshes year list dropdown.
- **Calendar Year Selection**: Dropdown with available years of selected type.
  - Format: "Fiscal Year (2024-2025)", "Zakat Year (2024-2025)", etc.
  - Shows all years with at least one income entry.
  - Defaults to current year of selected type.
- **Income Source Filter**: Dropdown to filter by income source (optional).
  - Options: All Sources (default), Employment, Stocks, Bonds, Rental, Business, Freelance, Other
  - Filters entire summary view when selected.
- **Summary Statistics Panel**: Key metrics display above table.
  - Total income for selected year
  - Average monthly income
  - Highest earning month
  - Most lucrative income source

#### 5.3.2 Monthly aggregation table

- **Table Structure**:
  - Columns: Month/Year, Total Income, Trend Icon, Expand/Collapse Icon
  - Rows: One row per month in calendar year (12 rows typically).
  - Expandable rows for source breakdown (accordion style).
- **Month/Year Column**:
  - Format: "January 2025", "February 2025", etc.
  - Chronological ordering by calendar year sequence.
- **Total Income Column**:
  - Format: "$12,450.75"
  - Sum of all income entries for that month/year.
  - Shows "$0.00" for months with no income.
- **Trend Icon Column**:
  - Up arrow (green) if income increased from previous month.
  - Down arrow (red) if income decreased from previous month.
  - Dash (gray) if unchanged or first month.
- **Expand/Collapse Icon**:
  - Chevron down when collapsed, chevron up when expanded.
  - Clickable to toggle source breakdown accordion.

#### 5.3.3 Income source drill-down (accordion)

- **Expand Trigger**: User clicks anywhere on month row or chevron icon.
- **Accordion Animation**: Smooth expansion revealing nested source breakdown table.
- **Source Breakdown Table**:
  - Nested table directly below parent month row.
  - Columns: Income Source, Amount, Percentage of Month Total
  - Rows: One row per income source with entries in that month.
  - Example:
    ```
    Employment       $8,500.00    70%
    Stocks          $2,450.75    20%
    Freelance       $1,500.00    10%
    ```
- **Visual Styling**: Indented with subtle background color to indicate nesting.
- **Collapse Trigger**: Clicking month row again or chevron up icon collapses accordion.
- **Multiple Expansion**: Multiple months can be expanded simultaneously for comparison.

#### 5.3.4 Year-over-year comparison view

- **Toggle Control**: Button/toggle to switch between single year and comparison mode.
  - Label: "Compare Years" (toggle on) / "Single Year" (toggle off).
- **Comparison Mode Structure**:
  - Table expands to show current year and previous year(s) side-by-side.
  - Columns: Month/Year, Current Year Total, Previous Year Total, Change (%), Trend
  - Color coding: Green for increases, red for decreases, gray for unchanged.
- **Comparison Calculations**:
  - Change (%): ((Current - Previous) / Previous) × 100
  - Trend: Visual arrow indicators for quick scanning.
- **Empty Data Handling**: Shows "N/A" for months in previous years without data.

### 5.4 Advanced features & edge cases

#### 5.4.1 Validation and data integrity

- **Date Validation**: Prevent income entries with dates outside selected fiscal year period.
  - Client-side: Date picker disables out-of-range dates.
  - Server-side: Validation rejects invalid dates with error message.
- **Amount Validation**: Reject negative, zero, or invalid monetary amounts.
  - Positive decimals only with max 2 decimal places.
  - No upper limit on amount (users may have high-value income events).
- **Income Source Validation**: Ensure source selection from predefined enum only.
  - Server-side validation prevents invalid source values.
- **Unique Income per Fiscal Year**: System automatically creates Income record if not exists for fiscal year.
  - Prevents duplicate Income records for same fiscal year per user.

#### 5.4.2 Empty states and error handling

- **No Income Entries**: Empty state message with call-to-action to add first entry.
  - Message: "No income recorded for this fiscal year. Click + to add your first income entry."
- **No Fiscal Years Available**: Guide user to admin/calendar setup if no fiscal years exist.
  - Message: "No fiscal years configured. Please contact support or configure calendar years."
- **Network/Server Errors**: Toast notifications with retry options.
  - Error message: "Failed to save income entry. Please try again."
  - Retry button in toast for user convenience.
- **Validation Errors**: Inline error messages below invalid fields.
  - Clear, actionable guidance: "Amount must be greater than $0.00"

#### 5.4.3 Performance and loading states

- **Table Loading**: Skeleton loaders during data fetch.
  - Shimmer effect on table rows to indicate loading.
- **Optimistic Updates**: Immediate UI feedback before server confirmation.
  - Add/Edit/Delete actions update UI instantly, rollback on error.
- **Suspense Boundaries**: Graceful loading states for async server components.
- **Pagination**: If needed for large datasets (100+ entries), implement cursor-based pagination.

#### 5.4.4 Accessibility and usability

- **Keyboard Navigation**: Full keyboard support for table operations.
  - Tab navigation through interactive elements.
  - Enter key to activate edit/save, Escape to cancel.
- **Screen Reader Support**: Proper ARIA labels and roles.
  - Announce state changes (editing, saving, deleted).
  - Descriptive button labels for icon-only buttons.
- **Focus Management**: Focus returns to appropriate element after actions.
  - After save, focus moves to next logical element.
  - After delete, focus moves to previous row.
- **Responsive Design**: Mobile-optimized table layouts.
  - Stacked card layout on small screens.
  - Touch-friendly target sizes (min 44x44px).

## 6. Success metrics

### 6.1 User engagement metrics

- Number of income entries created per user per month.
- Frequency of Income Summary page visits.
- Average number of income sources tracked per user.
- Retention rate: Users who continue using feature after 30/90 days.

### 6.2 User satisfaction metrics

- Time spent on Income CRUD vs Summary pages (engagement balance).
- Number of year-over-year comparisons performed.
- Feature satisfaction ratings from user surveys.
- Support tickets related to income tracking (lower is better).

### 6.3 Technical performance metrics

- Page load time (target: <2 seconds for Income CRUD page).
- Server action response time (target: <500ms for CRUD operations).
- Summary calculation performance (target: <1 second for yearly aggregations).
- Error rate for income entry operations (target: <1%).

## 7. Technical considerations

### 7.1 Architecture and patterns

- **Server Components**: Use for data fetching and initial rendering on both pages.
- **Server Actions**: CRUD operations for Income and IncomeEntry records.
- **Client Wrapper Pattern**: Interactive table wrapped in Client Component, data passed from Server Component parent.
- **TanStack Table**: Table library for inline editing and sorting/filtering.
- **State Management**: React Context with useReducer for table state.
- **Form Validation**: Zod schemas for type-safe validation on client and server.

### 7.2 Database schema

```prisma
enum IncomeSourceEnumType {
  EMPLOYMENT
  STOCKS
  BONDS
  RENTAL
  BUSINESS
  FREELANCE
  OTHER
}

// Income record per fiscal year (parent)
model Income {
  id         String        @id @default(cuid())
  calendar   CalendarYear  @relation(fields: [calendarId], references: [id], onDelete: Restrict)
  calendarId String        @unique
  entries    IncomeEntry[]
  userId     String
  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@unique([calendarId, userId])
}

// Individual income entry (child)
model IncomeEntry {
  id         String               @id @default(cuid())
  dateEarned DateTime
  amount     Decimal              @db.Money
  source     IncomeSourceEnumType
  income     Income               @relation(fields: [incomeId], references: [id], onDelete: Cascade)
  incomeId   String
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt

  @@index([incomeId, dateEarned])
}
```

### 7.3 Service layer functions

- `addIncomeCalendarYearDetails(calendarId, userId)`: Create Income record for fiscal year.
- `getIncome(calendarYearId, userId)`: Fetch Income record with entries.
- `getIncomeEntries(incomeId)`: Fetch all entries for an Income record.
- `addIncomeEntry(incomeId, input)`: Create new IncomeEntry.
- `updateIncomeEntry(entryId, input)`: Update existing IncomeEntry.
- `deleteIncomeEntry(entryId)`: Delete IncomeEntry.
- `getTotalIncome(calendarYearId, userId)`: Calculate total income for fiscal year.
- `getMonthlyIncomeSummary(calendarYearId, userId)`: Aggregate by month/year.
- `getSourceBreakdown(calendarYearId, month, year, userId)`: Breakdown by source for specific month.

### 7.4 Security and data isolation

- All queries filtered by authenticated user's ID.
- Server Actions validate session before operations.
- Prisma queries use userId in where clauses.
- No cross-user data exposure.

### 7.5 Performance optimizations

- Indexed dateEarned field for fast month/year filtering.
- Prisma aggregations for summary calculations.
- Server-side pagination for large datasets.
- Suspense boundaries for non-blocking loading.

## 8. Dependencies & constraints

### 8.1 Dependencies

- CalendarYear model with FISCAL type entries must exist.
- User authentication via NextAuth.
- Prisma ORM for database operations.
- TanStack Table for interactive tables.
- React Hook Form with Zod for form validation.

### 8.2 Constraints

- USD currency only (no multi-currency support in v1).
- Fiscal year filtering only on Income CRUD page (not ZAKAT or ANNUAL).
- Summary page supports all calendar year types (ZAKAT, ANNUAL, FISCAL).
- No export functionality in v1 (future enhancement).
- No recurring income automation (manual entry only).

### 8.3 Browser support

- Modern browsers with ES6+ support (Chrome, Firefox, Safari, Edge latest versions).
- Mobile responsive design for iOS Safari and Chrome Android.

## 9. Risks & mitigation

### 9.1 Data accuracy risks

- **Risk**: Users enter incorrect income amounts or dates.
- **Mitigation**: Clear validation messages, date pickers to prevent manual entry errors, inline editing for quick corrections.

### 9.2 Performance risks

- **Risk**: Summary calculations slow for users with thousands of income entries.
- **Mitigation**: Database indexing on dateEarned, efficient Prisma aggregations, pagination if needed.

### 9.3 User adoption risks

- **Risk**: Users find two-page structure confusing.
- **Mitigation**: Clear navigation labels, onboarding tooltips, consistent patterns with existing features.

### 9.4 Calendar year complexity

- **Risk**: Users confused by multiple calendar year types.
- **Mitigation**: Default to FISCAL for most users, clear descriptions in dropdowns, help text explaining differences.

## 10. User stories

### 10.1 As a freelancer with multiple income sources

- **Story**: As a freelancer, I want to track income from multiple clients and projects so that I can accurately report my earnings for tax purposes.
- **Acceptance Criteria**:
  - I can add income entries with different sources (FREELANCE, EMPLOYMENT, OTHER).
  - I can view total income for the fiscal year.
  - I can edit entries if I entered incorrect amounts.
  - I can delete duplicate or incorrect entries.

### 10.2 As an investor tracking portfolio income

- **Story**: As an investor, I want to see my investment income broken down by source (stocks, bonds) so that I can analyze my portfolio's income generation.
- **Acceptance Criteria**:
  - I can categorize income as STOCKS or BONDS.
  - I can view summary page filtered by STOCKS source only.
  - I can see monthly breakdown of investment income.
  - I can compare year-over-year investment income growth.

### 10.3 As a property owner tracking rental income

- **Story**: As a property owner, I want to track rental income by month so that I can monitor occupancy and rental performance over time.
- **Acceptance Criteria**:
  - I can add rental income entries with RENTAL source.
  - I can view monthly aggregation showing rental income per month.
  - I can compare rental income across multiple years.
  - I can quickly identify months with missing or low rental income.

### 10.4 As a tax-filer preparing annual returns

- **Story**: As a taxpayer, I want to view all my income for the fiscal year in one place so that I can accurately complete my tax return.
- **Acceptance Criteria**:
  - Income CRUD page defaults to current fiscal year.
  - I can see total income for the fiscal year.
  - I can export or copy income data for tax form entry (future enhancement).
  - I can verify all income sources are accounted for.

### 10.5 As a financial planner analyzing income trends

- **Story**: As someone planning my financial future, I want to compare my income year-over-year so that I can see if my earning power is growing.
- **Acceptance Criteria**:
  - I can toggle year-over-year comparison view on summary page.
  - I can see percentage change between years.
  - I can identify which income sources are growing or declining.
  - I can view trend indicators for quick visual analysis.

---

## Appendix A: Income source definitions

| Source     | Description                                            | Examples                                           |
| ---------- | ------------------------------------------------------ | -------------------------------------------------- |
| EMPLOYMENT | Salary, wages, bonuses from W-2 employment             | Monthly salary, annual bonus, overtime pay         |
| STOCKS     | Dividends and capital gains from stock investments     | Quarterly dividends, stock sale proceeds           |
| BONDS      | Interest income from bonds and fixed-income securities | Bond coupon payments, treasury interest            |
| RENTAL     | Property rental income and lease payments              | Monthly rent, lease deposits, rental fees          |
| BUSINESS   | Business profits, partnership income, self-employment  | Business net income, partnership distributions     |
| FREELANCE  | Contract work, gig economy, consulting fees            | Freelance projects, consulting contracts, gig work |
| OTHER      | Miscellaneous income not fitting other categories      | Gifts, prizes, one-time windfalls                  |

---

## Appendix B: Calendar year type descriptions

| Type   | Description                      | Typical Period                     | Use Case                             |
| ------ | -------------------------------- | ---------------------------------- | ------------------------------------ |
| FISCAL | Financial year for tax reporting | July 1 - June 30 or Jan 1 - Dec 31 | Tax preparation, financial reporting |
| ANNUAL | Calendar year                    | January 1 - December 31            | General annual tracking              |
| ZAKAT  | Islamic calendar year            | Varies based on Islamic calendar   | Religious obligation tracking        |
