# Income Management — High-Level Design

## Feature Overview

Income Management provides authenticated users with a comprehensive income tracking and analysis system. Users can record individual income entries (amount, date, source) across multiple calendar year types and view aggregated summaries with drill-down capabilities.

### Goals
- **Record-keeping**: Enable users to track all income sources in a centralized system
- **Tax preparation**: Organize income by fiscal year for easy tax filing
- **Financial analysis**: Provide monthly aggregations and source breakdowns for pattern analysis
- **Flexibility**: Support multiple calendar year types (FISCAL, ZAKAT, ANNUAL)

### Non-Goals
- Automatic bank account import
- Tax calculation or financial advice
- Multiple currency support
- Year-over-year comparison (planned for future)
- Source filtering (planned for future)

---

## Architecture Overview

### Two-Tier Data Model
The income system uses a **hierarchical aggregate pattern**:
1. **IncomeLedger** — One record per (user, calendar year) pair; serves as the aggregate root
2. **IncomeRecord** — Individual income events tied to an IncomeLedger

This mirrors the Donations and Zakat management systems in the codebase.

### Key Design Decisions

#### Data Model: Lookup Table vs. Enum
- **Decision**: IncomeSource is a **lookup table** (not an enum)
- **Rationale**: Allows future flexibility (add custom sources, mark inactive, etc.) without schema migrations
- **Sources**: EMPLOYMENT, STOCKS, BONDS, RENTAL, BUSINESS, FREELANCE, OTHER (shared across users)

#### Calendar Year Type
- **CRUD page**: Defaults to FISCAL year type for tax preparation
- **Summary page**: Renders all available calendar years of user's selected type
- **Rationale**: Users may earn income across different calendar systems; fiscal year is most common for tax

#### Date Boundary Enforcement
- **Server action validates**: `dateEarned` must fall within the selected fiscal year period
- **Rationale**: Prevents orphaned entries; ensures data integrity
- **Client-side**: Date picker restricts selection to valid range

#### Inline Editing Pattern
- **One row editable at a time**: Prevents confusion with multiple editors
- **Managed via React reducer**: Centralizes editing state logic
- **Cancel is free** (no server call); **Save validates and commits**
- **Rationale**: Simplified UX; clear state transitions

#### Total Income Calculation
- **Real-time**: No stored aggregates; calculated on-the-fly from IncomeRecords
- **Rationale**: Ensures consistency; no sync issues between records and aggregates

---

## Data Model

### Three-Table Schema

#### IncomeLedger (Aggregate Root)
- **Purpose**: Container for all income records in a calendar year
- **Key fields**:
  - `id`: CUID primary key
  - `calendarId`: Foreign key to CalendarYear
  - `userId`: Foreign key to User
  - `records`: 1-to-many relation to IncomeRecord
- **Constraints**: Unique on (calendarId, userId) — one ledger per year/user
- **Lifecycle**: Created on first income entry; persists until all records deleted

#### IncomeRecord (Entity)
- **Purpose**: Individual income event
- **Key fields**:
  - `id`: CUID primary key
  - `dateEarned`: Date of income
  - `amount`: Decimal (Money type)
  - `incomeSourceId`: Foreign key to IncomeSource
  - `incomeLedgerId`: Foreign key to IncomeLedger
  - `transactionId`: Optional foreign key to Transaction (for future integration)
- **Index**: (incomeLedgerId, dateEarned) for efficient range queries
- **Lifecycle**: Created by addRow; updated by editRow; deleted by deleteRow

#### IncomeSource (Lookup)
- **Purpose**: Reference table for income categories
- **Key fields**:
  - `id`: CUID primary key
  - `name`: Unique identifier (EMPLOYMENT, STOCKS, etc.)
  - `description`: Human-readable description
  - `isActive`: Soft-delete flag
- **Shared**: Not scoped to user; reused across application

---

## Key Flows

### Flow 1: Add Income Entry
```
User clicks "+" button
  ↓
System adds editable row to table (form mode)
  ↓
User fills: dateEarned, amount, incomeSourceId
  ↓
User clicks save
  ↓
Server action validates:
  - dateEarned not in future
  - dateEarned within fiscal year range
  - amount > 0, max 2 decimals
  - incomeSourceId is valid
  ↓
Server action creates IncomeLedger if needed
  ↓
Server action creates IncomeRecord
  ↓
revalidatePath('/cashflow/income')
  ↓
Table re-renders; row shows read-only view with edit/delete icons
  ↓
Total Earned updates automatically
```

### Flow 2: Edit Income Entry
```
User clicks edit (pen) icon
  ↓
Row transforms to editable form with current values pre-filled
  ↓
User modifies fields
  ↓
User clicks save
  ↓
Server action validates (same checks as add)
  ↓
Server action updates IncomeRecord
  ↓
revalidatePath('/cashflow/income')
  ↓
Row transforms back to read-only view
  ↓
Total Earned updates if amount changed
```

### Flow 3: Delete Income Entry
```
User clicks delete (trash) icon
  ↓
Confirmation dialog shown
  ↓
User confirms deletion
  ↓
Server action deletes IncomeRecord
  ↓
revalidatePath('/cashflow/income')
  ↓
Row removed from table with animation
  ↓
Total Earned recalculates
  ↓
If last entry deleted, empty state shown
```

### Flow 4: View Monthly Summary
```
User clicks "Income Summary" in nav
  ↓
Server Component loads fiscal years, defaults to current year
  ↓
Client Component renders year dropdown
  ↓
User selects year (or defaults to current)
  ↓
useEffect triggers fetch to /api/income/monthly-summary
  ↓
API calls getMonthlyIncomeSummary() service
  ↓
Service queries all IncomeRecords for year, groups by month, returns array
  ↓
Client renders MonthlySummaryTable with Month/Year, Total Income, Trend columns
```

### Flow 5: Expand Month Row (Drill-Down)
```
User clicks "expand" chevron on month row
  ↓
Accordion expands smoothly
  ↓
useEffect fetches source breakdown for that month via getSourceBreakdown()
  ↓
Nested table renders: Source | Amount | Percentage
  ↓
User can expand multiple months simultaneously
```

---

## User Roles & Access Control

### Authenticated User
- **Access**: Full CRUD on own income records only
- **Scope**: `userId` validated on every server action
- **Visibility**: Cannot see other users' income records

### Authentication
- **Method**: NextAuth v5 beta (`auth()` in Server Components, `useSession()` in Client)
- **Enforcement**: Server actions check `session.user.id` before any database operation
- **Session expiry**: Returns error; client prompts re-login

---

## Known Limitations & Future Work

### Current Gaps (Not Yet Implemented)
1. **Year-over-year comparison**: Planned for summary page; requires side-by-side month rows
2. **Source filtering**: Planned for summary page; requires client-side dropdown + filtered data fetch
3. **Calendar year type selector**: Summary page only shows FISCAL years; future work to support ZAKAT/ANNUAL
4. **Export functionality**: Out of scope for MVP

### Technical Debt
- Summary page API route (`/api/income/monthly-summary`) should be moved to tRPC endpoint for type safety
- Source breakdown fetch could be batched in single API call instead of per-month
- No caching strategy for monthly summaries; every fetch recalculates

---

## Performance & Optimization

### Database Queries
- **getIncomeEntries()**: Indexed on (incomeLedgerId, dateEarned); typical query < 50ms
- **getTotalIncome()**: Aggregate query; scales linearly with record count
- **getMonthlyIncomeSummary()**: Fetches all records, groups in-memory; acceptable for typical user (< 1000 entries)

### Client-Side
- **Inline editing**: Managed state in React Context; no unnecessary re-renders
- **Year dropdown**: Memoized option list; only recalculates on fiscalYears prop change
- **Table**: TanStack Table with virtual scrolling for large datasets (>100 rows)

### Caching
- **revalidatePath()**: Invalidates `/cashflow/income` after CRUD operations
- **Server-side render**: Income table fetches fresh data on each revalidation

---

## Testing Strategy

### Unit Tests
- Validation schemas (Zod)
- Service layer functions (income.service.ts)
- Date boundary calculations

### Integration Tests
- Server actions: add, edit, delete flows
- API routes: monthly summary, source breakdown
- Database constraints: unique (calendarId, userId) on IncomeLedger

### E2E Tests
- Complete CRUD workflow on income page
- Year selection and total recalculation
- Summary page drill-down interactions

