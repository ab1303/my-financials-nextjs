# Income Management — Context

## File Inventory

### Database Schema (Prisma)
- **prisma/schema.prisma**
  - `IncomeLedger` — Aggregate ledger per user/calendar year (one record per fiscal year)
  - `IncomeRecord` — Individual income events (date, amount, source)
  - `IncomeSource` — User-managed lookup table for income categories (replaces enum)

### Routes & Pages
- **src/app/(authorized)/cashflow/income/page.tsx** — CRUD page (list, add, edit, delete income entries)
- **src/app/(authorized)/reports/income-summary/page.tsx** — Analytical summary page

### Components (CRUD Page)
- **src/app/(authorized)/cashflow/income/form.tsx** — Year selector and add button
- **src/app/(authorized)/cashflow/income/IncomeTableServer.tsx** — Server component fetching income records
- **src/app/(authorized)/cashflow/income/IncomeTableClient.tsx** — Client component rendering table with inline editing
- **src/app/(authorized)/cashflow/income/reducer.ts** — State management for inline editing
- **src/app/(authorized)/cashflow/income/StateProvider.tsx** — Context provider for editing state
- **src/app/(authorized)/cashflow/income/_table/columns.tsx** — TanStack Table column definitions
- **src/app/(authorized)/cashflow/income/_components/SourceBadge.tsx** — Income source display component
- **src/app/(authorized)/cashflow/income/_components/MonthAccordionPanel.tsx** — Reusable accordion component
- **src/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget.tsx** — Source breakdown display

### Components (Summary Page)
- **src/app/(authorized)/reports/income-summary/IncomeSummaryClient.tsx** — Client component with year dropdown and data fetching
- **src/app/(authorized)/reports/income-summary/MonthlySummaryTable.tsx** — Monthly aggregation table with expandable rows

### Server Actions & Controllers
- **src/app/(authorized)/cashflow/income/actions.ts** — Server actions: `addRow()`, `editRow()`, `deleteRow()`
- **src/server/controllers/income.controller.ts** — Controllers: `createIncomeYearHandler()`, `totalIncomeHandler()`
- **src/server/services/income.service.ts** — Service layer: `addIncomeEntry()`, `updateIncomeEntry()`, `deleteIncomeEntry()`, `getMonthlyIncomeSummary()`, `getSourceBreakdown()`

### Validation & Types
- **src/app/(authorized)/cashflow/income/_schema.ts** — Zod schemas for CRUD input validation
- **src/app/(authorized)/cashflow/income/_types.ts** — TypeScript types (IncomeType, IncomeEntryType)
- **src/server/models/income.ts** — Domain models (IncomeModel, IncomeEntryModel, MonthlyIncomeSummary, SourceBreakdown)

---

## Database Schema Details

### IncomeLedger
```prisma
model IncomeLedger {
  id         String         @id @default(cuid())
  calendar   CalendarYear   @relation(fields: [calendarId], references: [id])
  calendarId String
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  records    IncomeRecord[]
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
  @@unique([calendarId, userId])
}
```
- One IncomeLedger per (user, calendar year) pair
- `calendarId` links to CalendarYear (FISCAL by default, can be ZAKAT/ANNUAL)
- `records` collection holds all IncomeRecord entries for that ledger

### IncomeRecord
```prisma
model IncomeRecord {
  id              String       @id @default(cuid())
  dateEarned      DateTime
  amount          Decimal      @db.Money
  incomeSource    IncomeSource @relation(fields: [incomeSourceId], references: [id])
  incomeSourceId  String
  incomeLedger    IncomeLedger @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId  String
  transaction     Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId   String?      @unique
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  @@index([incomeLedgerId, dateEarned])
}
```
- Individual income event with date earned, amount, and source category
- Foreign key to IncomeSource (lookup table, not enum)
- Soft link to Transaction (optional, one-to-one)
- Index on (incomeLedgerId, dateEarned) for efficient filtering

### IncomeSource
```prisma
model IncomeSource {
  id            String         @id @default(cuid())
  name          String         @unique
  description   String?        @db.Text
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  incomeRecords IncomeRecord[]
}
```
- User-managed (non-enum) lookup table for income categories
- Examples: EMPLOYMENT, STOCKS, BONDS, RENTAL, BUSINESS, FREELANCE, OTHER
- Soft delete via `isActive` flag
- No direct link to User (shared across application)

---

## Key Implementation Patterns

### Page Flow
1. User navigates to `/cashflow/income`
2. Server Component (page.tsx):
   - Authenticates user via NextAuth
   - Fetches user's fiscal year preference
   - Gets available calendar years (pre-filtered to FISCAL type by default)
   - Calculates default year (current fiscal year)
   - Fetches total income for selected year
3. Client Component (IncomeForm):
   - Renders year dropdown, add button, and table
   - Manages form submission for adding new entries
4. Server Component (IncomeTableServer):
   - Fetches income records for selected year
5. Client Component (IncomeTableClient):
   - Renders TanStack Table with inline editing controls
   - Manages editing state via reducer

### Data Flow for CRUD Operations
- **Add**: `addRow()` → validates → creates IncomeLedger if needed → creates IncomeRecord → revalidatePath
- **Edit**: `editRow()` → validates → updates IncomeRecord → revalidatePath
- **Delete**: `deleteRow()` → deletes IncomeRecord → revalidatePath

### Inline Editing Pattern
- Only one row editable at a time
- Editing state stored in React Context via reducer
- Form fields automatically populate current values
- Cancel reverts without server call; Save calls server action

### Summary Page Flow
1. Server Component queries user, fetches all calendar years
2. Client Component (IncomeSummaryClient):
   - Provides year selector dropdown
   - Fetches monthly summary data via API route on year change
3. API Route (`/api/income/monthly-summary`):
   - Calls `getMonthlyIncomeSummary()` service function
   - Returns array of MonthlyIncomeSummary records
4. Client Component renders MonthlySummaryTable with expandable rows
5. Expandable rows fetch source breakdown via `getSourceBreakdown()`

---

## Current Implementation Status

### ✅ Implemented
- CRUD page with fiscal year filtering
- Inline table editing (add, edit, delete rows)
- Total income calculation
- Income source lookup table (user-managed, not enum)
- Fiscal year pre-selection
- Monthly aggregation on summary page
- Source breakdown drill-down (expandable rows)

### ⚠️ Known Limitations
- **No year-over-year comparison**: Planned but not implemented in summary page
- **No source filtering**: Planned but not implemented in summary page
- **Currency not enforced**: Amount stored as Decimal; no multi-currency support
- **Calendar year type fixed**: CRUD page locked to FISCAL; summary page hardcoded to current calendar years list

### 🔮 Out of Scope (Per PRD)
- Automatic income import from bank accounts
- Tax calculation or financial advice
- Integration with external tax software
- Multiple currencies
- Budget forecasting or predictive analytics
- Export functionality
