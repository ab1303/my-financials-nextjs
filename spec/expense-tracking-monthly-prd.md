# PRD: Monthly Expense Tracking

## 1. Product overview

### 1.1 Document title and version

- PRD: Monthly Expense Tracking
- Version: 2.0
- Changelog: v2.0 (2026-05-13) — Updated to reflect schema rename migration (`Expense`→`ExpenseLedger`, `ExpenseEntry`→`MonthlyExpenseSummary`); added `BankTransaction` table for CSV import audit trail; added CSV import data flow and three-layer model; corrected wizard behaviour (individual transactions for review, aggregated totals on confirm); added `MerchantCategoryMap` write-through cache pattern; updated non-goals and implementation phases.

### 1.2 Product summary

This feature enables authenticated users to track and analyze their monthly expenses organized by categories for comprehensive financial planning and budgeting. Users can view expense data organized by fiscal year with a monthly summary table showing aggregate totals for each month. Clicking on a month opens a category breakdown modal where users can add, edit, or delete expense entries categorized by globally-defined expense types (Housing, Utilities, Food, etc.). The system follows the Bank Interest page pattern with a monthly table and detail modal for granular expense management.

The system supports **two data entry modes**:

1. **Manual entry** — Users directly enter aggregated expense amounts by category for each month (summary-level record-keeping).
2. **CSV import** — Users upload a bank statement CSV file. Each debit line is classified by an LLM into an `ExpenseCategory`, stored as a raw `BankTransaction` record, then aggregated into `MonthlyExpenseSummary` rows (one per category per month). The CSV import wizard shows individual transactions for review before confirming; on confirm the app writes both the raw `BankTransaction` records and the aggregated `MonthlyExpenseSummary` totals.

The three-layer data model is:
- **`BankTransaction`** (raw) — one row per CSV debit line; provides audit trail and totals reconciliation
- **`MonthlyExpenseSummary`** (aggregate) — one row per category per month; the source of truth for the expense table
- **`ExpenseLedger`** (container) — one row per user per fiscal year; the parent record

The feature follows architectural patterns from the Bank Interest and Income management systems with fiscal year filtering, Server Actions-based CRUD operations, and optimistic UI updates.

The feature consists of:

1. **Monthly Expense Table**: 12-row table (January-December) displaying total expenses per month with fiscal year filtering
2. **Category Breakdown Modal**: Popup showing `MonthlyExpenseSummary` entries by category for the selected month with inline add/edit/delete capabilities
3. **CSV Import Wizard**: Multi-step flow to upload, classify, review individual transactions, and confirm aggregated totals
4. **Global Category System**: Seeded expense categories shared across all users (no per-user custom categories in MVP)

## 2. Goals

### 2.1 Business goals

- Provide simplified expense tracking complementing income and donation features for comprehensive personal finance management
- Enable users to understand spending patterns across fiscal year periods for tax planning and budgeting
- Support informed financial decision-making through category-based expense analysis
- Enhance user engagement by offering practical budgeting and expense monitoring tools
- Maintain consistent UX patterns across all financial tracking features (Bank Interest, Income, Donations)

### 2.2 User goals

- Track monthly expenses organized by common spending categories
- View fiscal year expense totals for tax preparation and financial planning
- Analyze spending patterns by month and category without complex transaction tracking
- Maintain summary-level expense records sufficient for budgeting without date-level granularity
- Quickly add/edit expense amounts by category for each month
- Compare monthly spending across fiscal year periods

### 2.3 Non-goals

- Individual transaction tracking for manual entry mode (manual mode is summary-level only)
- Receipt capture or attachment storage
- Budget alerts or spending limit notifications
- Direct bank API or open-banking integration for automatic expense import (CSV export from bank portal is supported; live bank API feeds are not)
- Support for multiple currencies (AUD/USD only in initial version)
- Expense forecasting or predictive analytics
- Export to external budgeting or accounting software (future enhancement)
- Support for unauthenticated or guest users
- Per-user custom categories (global seeded categories only in MVP)
- Tracking of income, donations, or other financial data (separate feature domains)
- Subcategories or hierarchical category structures
- Tax deduction tracking or categorization by tax rules
- Drill-down from `MonthlyExpenseSummary` into underlying `BankTransaction` rows (future Phase 3 enhancement)

## 3. User personas

### 3.1 Key user types

- Authenticated individual users who want to track monthly expenses for budgeting and financial planning without detailed transaction-level record-keeping

### 3.2 Basic persona details

- **Budget-conscious individual**: A user who wants to understand their monthly spending patterns across major categories (housing, food, utilities) for better financial planning and savings goal achievement
- **Fiscal year planner**: A user who needs organized expense summaries by fiscal year to complement income tracking for tax preparation and annual financial review
- **Simplicity seeker**: A user who prefers summary-level expense tracking (total spent on "Food" in January) over detailed transaction logging (every grocery receipt with date/vendor)

### 3.3 Role-based access

- **Authenticated user**: Can add, edit, delete, and view their own expense records organized by fiscal year and month. All data is strictly scoped to the authenticated user - users cannot see or modify expense records of other users.

## 4. Functional requirements

### 4.1 Monthly expense summary table (Priority: High)

- **Display monthly expense table** (Priority: High)
  - Table displays 12 rows ordered by the calendar year's start month (e.g., July–June for FISCAL, January–December for ANNUAL)
  - Month labels include the calendar year to eliminate ambiguity (e.g., "JULY 2024", "AUGUST 2024", … "JUNE 2025")
  - Row ordering follows the selected calendar year's `fromMonth`: rows start at `fromMonth` and wrap around (e.g., FISCAL fromMonth=7 → July, August, …, December, January, …, June)
  - Columns: Month, Total Expense, Category Breakdown (icon button)
  - Footer row displays annual total (sum of all 12 months)
  - Total Expense column shows auto-calculated sum of all category entries for that month
  - Table follows Bank Interest page pattern with editable cells and action column
  - Empty months display $0 until category entries are added
- **Fiscal year filtering** (Priority: High)
  - Dropdown at top of page displays available fiscal years (CalendarYear type = 'FISCAL')
  - Defaults to current fiscal year on initial page load
  - Changing fiscal year reloads table data for the selected period
  - Fiscal year format: "Fiscal Year (2024-2025)" showing fromYear-toYear
  - Only fiscal years are selectable (not ANNUAL or ZAKAT types)

- **Category breakdown navigation** (Priority: High)
  - Each month row has a clickable icon (list icon from react-icons) in "Category Breakdown" column
  - Clicking icon opens Category Breakdown Modal for that specific month
  - Icon is always clickable regardless of whether month has entries (allows adding first entry)

### 4.2 Category breakdown modal (Priority: High)

- **Display category entries** (Priority: High)
  - Modal opens showing all `MonthlyExpenseSummary` entries for the selected month
  - Modal header displays: "Expenses for [Month] [Year]" (e.g., "Expenses for January 2025")
  - Entry list displays: Category (from dropdown), Amount (AUD), Action buttons (Edit/Delete)
  - Entries are grouped/sorted by category name alphabetically
  - Empty state message: "No expenses recorded for this month. Click + to add your first expense."
  - Modal footer shows: "Total: $[sum]" calculated from all entries in the modal
  - Entries may have been created via manual add **or** via CSV import (both surface identically in this modal)

- **Add expense entry** (Priority: High)
  - Users can add new expense entries for the selected month within the modal
  - Required fields: category (dropdown), amount (AUD)
  - Category dropdown populated from global `ExpenseCategory` table (seeded data)
  - Standard react-select dropdown (NOT CreatableSelect - no user-defined categories in MVP)
  - Amount input field with currency formatting (NumberFormat component)
  - Validations:
    - Amount must be positive with up to two decimal places (e.g., 1250.50)
    - Amount cannot be negative or zero
    - Category must be selected from dropdown
  - Save button triggers Server Action to create `MonthlyExpenseSummary` record
  - Success: Entry appears in modal list, total recalculates, toast notification, main table updates
  - Error: Display validation error message inline or via toast
  - Creates `ExpenseLedger` parent record for fiscal year + user if not already exists (`@@unique` constraint)
  - Creates `MonthlyExpenseSummary` record linked to `ExpenseLedger` parent with month association

- **Edit expense entry** (Priority: High)
  - Users can modify any expense entry within the modal
  - Clicking edit icon/button switches entry to edit mode (inline editing)
  - Displays same form fields as add (category dropdown, amount input)
  - Pre-populates with existing values
  - All validations from add operation apply
  - Save button updates `MonthlyExpenseSummary` record via Server Action
  - Cancel button reverts to display mode without saving
  - Success: Entry updates in modal, total recalculates, main table updates

- **Delete expense entry** (Priority: High)
  - Users can remove expense entries via delete icon/button
  - No confirmation prompt (matches Bank Interest PaymentHistoryModal pattern)
  - Delete triggers Server Action to remove `MonthlyExpenseSummary` record
  - Success: Entry removed from modal list, total recalculates, toast notification, main table updates
  - Deletion affects only the specific entry, not entire month or parent `ExpenseLedger` record

- **Category selection** (Priority: High)
  - Dropdown displays all active categories from ExpenseCategory table
  - Categories are globally shared (all users see same categories)
  - Initial seeded categories:
    - Housing (rent/mortgage)
    - Utilities (electricity, water, internet)
    - Transportation (gas, car payment, transit)
    - Food (groceries, dining out)
    - Healthcare (insurance, medical expenses)
    - Insurance (auto, home, life)
    - Entertainment (streaming, hobbies, events)
    - Education (tuition, books, courses)
    - Personal (clothing, grooming, gifts)
    - Other (miscellaneous expenses)
  - Dropdown uses standard react-select component
  - No ability to create new categories on-the-fly (MVP limitation)

### 4.3 Authentication and data scoping (Priority: High)

- **User authentication** (Priority: High)
  - Feature requires authenticated user session (NextAuth)
  - All expense data is scoped to the logged-in user
  - Expense parent records have userId foreign key constraint
  - Server Actions and queries automatically filter by session user ID
  - Unauthenticated users cannot access the expense tracking page (redirect to login)

- **Data isolation** (Priority: High)
  - Users can only view, create, edit, or delete their own expense records
  - Expense records for different users are completely isolated
  - Category table is globally shared but entry data is per-user
  - No ability to share or view other users' expense data

### 4.4 Calculations and aggregations (Priority: Medium)

- **Monthly totals** (Priority: Medium)
  - Monthly total is auto-calculated as sum of all `MonthlyExpenseSummary` amounts for that month
  - Calculation performed server-side in controller/service layer
  - Main table displays calculated totals (not editable field in MVP)
  - Totals update immediately after add/edit/delete operations via optimistic updates

- **Annual totals** (Priority: Medium)
  - Footer row displays sum of all 12 monthly totals
  - Calculated server-side and sent with initial data fetch
  - Updates when any monthly entry changes

- **Category totals in modal** (Priority: Low)
  - Modal footer displays sum of all entries visible in that month's breakdown
  - Calculated client-side on modal data
  - Updates dynamically as entries are added/edited/deleted

### 4.5 State management and UI updates (Priority: Medium)

- **Optimistic updates** (Priority: Medium)
  - Uses Context + useReducer + Immer pattern (matching Income/Donations features)
  - StateProvider wraps modal component with entry data
  - Reducer handles ADD_ENTRY, EDIT_ENTRY, REMOVE_ENTRY actions
  - UI updates immediately on user action before server confirmation
  - Server Action success confirms update; failure reverts optimistic change with error toast

- **Data refetching** (Priority: Medium)
  - Main table data refetches after successful CRUD operations in modal (revalidatePath)
  - Modal data updates via reducer pattern without full page reload
  - Fiscal year dropdown change triggers new data fetch for entire page

- **Loading states** (Priority: Low)
  - Loading spinner/skeleton on initial page load
  - Button loading state during Server Action execution
  - Modal shows loading indicator while fetching entry data

### 4.6 Validation and error handling (Priority: High)

- **Client-side validation** (Priority: High)
  - Amount field: positive number, max 2 decimals, required
  - Category field: required, must be valid category ID
  - Real-time validation feedback on form fields

- **Server-side validation** (Priority: High)
  - Zod schemas in \_schema.ts validate all inputs
  - Amount validation: z.number().positive().refine(val => Number(val.toFixed(2)) === val)
  - Category validation: z.string().uuid() (ensures valid category ID)
  - Month validation: z.number().int().min(1).max(12)
  - Fiscal year validation: ensure CalendarYear exists and type = 'FISCAL'

- **Error handling** (Priority: High)
  - Display user-friendly error messages for validation failures
  - Toast notifications for server errors (network, database)
  - Graceful handling of missing fiscal year data (empty state with create prompt)
  - Handle concurrent edit conflicts (last write wins, no locking in MVP)

## 5. Non-functional requirements

### 5.1 Performance (Priority: Medium)

- **Page load time** (Priority: Medium)
  - Initial page load (with fiscal year data and 12-month summary) completes within 2 seconds
  - Modal open with category entries loads within 1 second
  - Server Actions for CRUD operations return within 1 second

- **Database efficiency** (Priority: Medium)
  - Use aggregation queries to calculate monthly totals (not client-side summation of all entries)
  - Fetch only necessary data for current fiscal year (not all historical data)
  - Index on `ExpenseLedger.calendarId` and `MonthlyExpenseSummary.expenseLedgerId` for fast lookups

### 5.2 Scalability (Priority: Low)

- **Data volume** (Priority: Low)
  - System should handle up to 10 categories per month (120 per fiscal year) per user efficiently
  - Support for 10+ fiscal years of historical data per user

### 5.3 Security (Priority: High)

- **Authorization** (Priority: High)
  - All Server Actions verify user session before database operations
  - Server-side validation of all inputs (never trust client data)
  - CSRF protection via NextAuth session tokens

- **Data access** (Priority: High)
  - Expense records are strictly scoped to authenticated user (userId FK constraint)
  - No API endpoints expose data across users
  - SQL injection protection via Prisma ORM

### 5.4 Maintainability (Priority: High)

- **Code consistency** (Priority: High)
  - Follow existing patterns from Bank Interest, Income, and Donations features
  - Use TypeScript for all code (strict mode)
  - Consistent file structure: page.tsx, form.tsx, Table components, \_schema.ts, \_types.ts, actions.ts
  - Follow T3 Stack conventions and Copilot instructions

- **Testing** (Priority: Medium)
  - Unit tests for validation schemas (Zod)
  - Unit tests for reducer logic
  - Integration tests for Server Actions (CRUD operations)
  - Manual testing checklist for UI flows

## 6. Technical architecture

### 6.1 Database schema

> **Note:** Model names reflect the completed schema rename migration (2026-05-13). Old names: `Expense`→`ExpenseLedger`, `ExpenseEntry`→`MonthlyExpenseSummary`, `AIImportSession`→`ImportSession`, `TransactionCategoryOverride`→`MerchantCategoryMap`.

```prisma
// Global expense categories (seeded data, shared across all users)
model ExpenseCategory {
  id           String                   @id @default(cuid())
  name         String                   @unique
  isActive     Boolean                  @default(true)
  createdAt    DateTime                 @default(now())
  summaries    MonthlyExpenseSummary[]
  transactions BankTransaction[]
}

// Fiscal-year container — one row per user per fiscal year (no financial data stored here)
model ExpenseLedger {
  id         String                   @id @default(cuid())
  calendar   CalendarYear             @relation(fields: [calendarId], references: [id])
  calendarId String
  user       User                     @relation(fields: [userId], references: [id])
  userId     String
  summaries  MonthlyExpenseSummary[]
  createdAt  DateTime                 @default(now())
  updatedAt  DateTime                 @updatedAt

  @@unique([calendarId, userId])
}

// Aggregated monthly total per category — one row per (expenseLedger, month, category)
// Source: manual entry OR rolled-up from BankTransaction rows on CSV import confirm
model MonthlyExpenseSummary {
  id               String          @id @default(cuid())
  month            Int             // 1–12 (January = 1, December = 12)
  amount           Decimal         @db.Money
  category         ExpenseCategory @relation(fields: [categoryId], references: [id])
  categoryId       String
  expenseLedger    ExpenseLedger   @relation(fields: [expenseLedgerId], references: [id], onDelete: Cascade)
  expenseLedgerId  String
  transactions     BankTransaction[] // back-ref: which raw transactions rolled up here
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
}

// Raw individual bank transaction imported from CSV — one row per CSV debit line
// Provides audit trail; aggregated into MonthlyExpenseSummary on import confirm
model BankTransaction {
  id               String                 @id @default(cuid())

  // Transaction detail
  date             DateTime               // parsed from CSV "Date" column (DD/MM/YYYY)
  description      String                 // raw merchant description from CSV (untransformed)
  amount           Decimal                @db.Money

  // Categorisation result
  categoryId       String
  category         ExpenseCategory        @relation(fields: [categoryId], references: [id])
  matchMethod      String?                // "exact" | "llm" | "user_override"
  confidence       Float?                 // embedding similarity score (0–1) if applicable

  // Aggregation link — which MonthlyExpenseSummary this transaction rolled up into
  expenseSummaryId String?
  expenseSummary   MonthlyExpenseSummary? @relation(fields: [expenseSummaryId], references: [id])

  // Import provenance
  importSessionId  String
  importSession    ImportSession          @relation(fields: [importSessionId], references: [id], onDelete: Cascade)

  userId           String
  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  @@index([userId, date])
  @@index([importSessionId])
  @@index([userId, categoryId])
  @@index([expenseSummaryId])
}

// Merchant → category dictionary (write-through cache, seeded from BankTransaction history)
// One row per (userId, description) — @@unique enforced
model MerchantCategoryMap {
  id          String          @id @default(cuid())
  userId      String
  description String          // raw merchant description (matches BankTransaction.description)
  categoryId  String
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  user        User            @relation(fields: [userId], references: [id])
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@unique([userId, description])
}
```

#### Three-layer model

```
CSV Bank Statement
       │
       ▼
ImportSession             ← upload tracking (status, originalFilename, importType=CSV_EXPENSE)
       │
       ├──► BankTransaction[]   ← one row per debit line (raw, dated, with merchant description)
       │         │
       │         │  aggregated by (month, categoryId) on import confirm
       │         ▼
       └──► MonthlyExpenseSummary[]  ← one row per category per month
                    │
                    └── parent: ExpenseLedger   ← fiscal-year container

MerchantCategoryMap        ← write-through cache: upserted when BankTransaction is confirmed
```

### 6.2 Component structure

```
src/app/(authorized)/cashflow/expense/
├── page.tsx                    # Server Component (fiscal year data fetch)
├── form.tsx                    # Client Component (fiscal year dropdown)
├── ExpenseTableServer.tsx      # Server Component (fetch monthly aggregates from MonthlyExpenseSummary)
├── ExpenseTableClient.tsx      # Client Component (TanStack Table)
├── StateProvider.tsx           # Context + useReducer wrapper for modal
├── reducer.ts                  # Immer-based reducer for entry state
├── actions.ts                  # Server Actions (CRUD operations on MonthlyExpenseSummary)
├── _schema.ts                  # Zod validation schemas
├── _types.ts                   # TypeScript type definitions
├── _components/
│   └── CategoryBreakdownModal.tsx  # Modal with entry list + CRUD form
└── _table/
    └── columns.tsx             # TanStack Table column definitions

src/app/api/csv-import/
├── upload/route.ts             # POST: receive CSV file, create ImportSession
├── parse/route.ts              # POST: parse CSV rows, return raw transaction list
├── classify/route.ts           # POST: LLM classification per transaction → ExpenseCategory
└── confirm/route.ts            # POST: write BankTransaction rows, aggregate into MonthlyExpenseSummary,
                                #        upsert MerchantCategoryMap, update ImportSession status
```

### 6.3 API layer

- **Server Actions** (primary API pattern for manual entry)
  - `addExpenseEntry(calendarId, month, categoryId, amount)` → creates `MonthlyExpenseSummary`
  - `editExpenseEntry(entryId, categoryId, amount)` → updates `MonthlyExpenseSummary`
  - `deleteExpenseEntry(entryId)` → deletes `MonthlyExpenseSummary`
  - All actions validate session, inputs, and call service layer

- **CSV Import API Routes** (Route Handlers under `app/api/csv-import/`)
  - `POST /api/csv-import/upload` — receive multipart CSV, create `ImportSession` with `importType=CSV_EXPENSE`
  - `POST /api/csv-import/parse` — parse CSV rows, validate columns, return raw transaction array
  - `POST /api/csv-import/classify` — for each transaction: check `MerchantCategoryMap` first (exact match), then LLM; return classified list
  - `POST /api/csv-import/confirm` — write `BankTransaction[]`, aggregate by `(month, categoryId)` → upsert `MonthlyExpenseSummary[]`, upsert `MerchantCategoryMap`, mark `ImportSession.status = COMPLETED`

- **Services** (business logic)
  - `ExpenseService.getOrCreateExpenseLedger(calendarId, userId)` — ensure `ExpenseLedger` parent exists
  - `ExpenseService.getMonthlyAggregates(expenseLedgerId)` — calculate totals per month from `MonthlyExpenseSummary`
  - `ExpenseService.getSummariesForMonth(expenseLedgerId, month)` — fetch category breakdown for modal
  - `ExpenseService.createSummaryEntry(expenseLedgerId, month, categoryId, amount)`
  - `ExpenseService.updateSummaryEntry(entryId, updates)`
  - `ExpenseService.deleteSummaryEntry(entryId)`
  - `CsvImportService.classifyTransactions(rows, userId)` — LLM + `MerchantCategoryMap` lookup
  - `CsvImportService.confirmImport(sessionId, classifiedRows, expenseLedgerId)` — write `BankTransaction[]`, aggregate, upsert `MerchantCategoryMap`

- **Controllers** (coordination layer)
  - `ExpenseController.getExpenseData(calendarId, userId)` — main page data
  - `ExpenseController.getMonthBreakdown(calendarId, userId, month)` — modal data

### 6.4 Data flow

**Manual entry flow:**
1. **Page load**: Server Component fetches fiscal years and defaults to current, passes to `form.tsx`
2. **Fiscal year selection**: `form.tsx` updates URL params, triggers page reload with new `calendarId`
3. **Table data fetch**: `ExpenseTableServer` calls controller to get monthly aggregates from `MonthlyExpenseSummary` for selected year
4. **Modal open**: `ExpenseTableClient` passes month to `CategoryBreakdownModal`, fetches `MonthlyExpenseSummary` entries for that month
5. **CRUD operations**: Modal form calls Server Actions → Service → Prisma (`MonthlyExpenseSummary`) → Reducer dispatch → UI update
6. **Optimistic updates**: Reducer updates state immediately; Server Action confirms/reverts on response

**CSV import flow:**
1. **Upload**: User uploads bank CSV → `POST /api/csv-import/upload` → creates `ImportSession` (status: `PENDING`)
2. **Parse**: `POST /api/csv-import/parse` → validates columns, returns raw transaction array (date, description, amount)
3. **Classify**: `POST /api/csv-import/classify` → for each row: lookup `MerchantCategoryMap` first (instant if known merchant), then LLM classifier; returns classified list with `confirmedCategory` for each row
4. **Wizard review**: UI shows each individual transaction with its classified category; user can override any category before confirming
5. **Confirm**: `POST /api/csv-import/confirm`:
   - Writes one `BankTransaction` row per CSV debit line
   - Aggregates by `(month, categoryId)` → upserts `MonthlyExpenseSummary` rows (adds to existing totals if month already has data)
   - Upserts `MerchantCategoryMap` for each unique `(userId, description)` pair (write-through cache)
   - Marks `ImportSession.status = COMPLETED`
6. **Table refresh**: Page revalidates, `ExpenseTableServer` re-fetches updated `MonthlyExpenseSummary` totals

## 7. Implementation phases

### Phase 1: Database and seed data (Priority: High)

- [x] Create Prisma migration for `ExpenseCategory`, `ExpenseLedger`, `MonthlyExpenseSummary` models
- [x] Create seed script for initial 10 expense categories
- [x] Run migration and seed on development database
- [x] Verify schema with Prisma Studio
- [x] Schema rename migration (2026-05-13): `Expense`→`ExpenseLedger`, `ExpenseEntry`→`MonthlyExpenseSummary`
- [ ] Add `BankTransaction` model to schema and run migration
- [ ] Add `CSV_EXPENSE` value to `ImportTypeEnum` enum

### Phase 2: Backend services and validation (Priority: High)

- [x] Create Zod schemas in `_schema.ts` (validation rules)
- [x] Create TypeScript types in `_types.ts`
- [x] Implement `ExpenseService` with Prisma operations (updated to new model names)
- [x] Implement `ExpenseController` with business logic
- [ ] Update all TypeScript source files to use renamed Prisma client names (`prisma.expenseLedger`, `prisma.monthlyExpenseSummary`)
- [ ] Write unit tests for service methods
- [ ] Write unit tests for validation schemas

### Phase 3: Server Actions and CRUD (Priority: High)

- [x] Implement Server Actions in `actions.ts` (addRow, editRow, deleteRow)
- [x] Add session validation to all actions
- [x] Implement `revalidatePath` after mutations
- [x] Add error handling with user-friendly messages
- [ ] Write integration tests for Server Actions

### Phase 4: Main page and table (Priority: High)

- [x] Create `page.tsx` (Server Component with fiscal year fetch)
- [x] Create `form.tsx` (fiscal year dropdown with URL params)
- [x] Create `ExpenseTableServer` (fetch monthly aggregates from `MonthlyExpenseSummary`)
- [x] Create `ExpenseTableClient` (TanStack Table with 12 rows)
- [x] Implement `columns.tsx` (Month, Total Expense, Category Breakdown icon)
- [x] Add footer row with annual total
- [x] Test fiscal year switching and total calculations

### Phase 5: Category breakdown modal (Priority: High)

- [x] Create `CategoryBreakdownModal` component
- [x] Implement entry list display with category and amount
- [x] Create inline add/edit form with react-select dropdown
- [x] Implement delete functionality with icon button
- [x] Add modal footer with category total
- [x] Test CRUD operations in modal

### Phase 6: State management and optimistic updates (Priority: Medium)

- [x] Create `StateProvider` with Context + useReducer
- [x] Implement `reducer.ts` with Immer (ADD_ENTRY, EDIT_ENTRY, REMOVE_ENTRY)
- [x] Wire reducer dispatch to modal CRUD operations
- [x] Implement optimistic UI updates with rollback on error
- [x] Test state consistency across add/edit/delete flows

### Phase 7: Polish and testing (Priority: Medium)

- [x] Add loading states (spinners, skeleton screens)
- [x] Implement toast notifications for success/error
- [x] Add empty states with helpful messages
- [x] Perform accessibility audit (keyboard navigation, ARIA labels)
- [x] Manual testing of all user flows
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsive testing

### Phase 8: Production readiness (Priority: High)

- [x] Run `pnpm run build` to verify production build succeeds
- [x] Fix any build warnings or errors
- [x] Review and update `.env-example` if new env vars added
- [ ] Update README.md with expense tracking feature documentation
- [ ] Create migration rollback plan
- [ ] Production deployment and smoke testing

### Phase 9: CSV Import + BankTransaction integration (Priority: High)

> This phase resolves the totals mismatch issue (individual transactions shown instead of consolidated in wizard) and adds the audit trail needed for reconciliation.

- [ ] Add `BankTransaction` model to `prisma/schema.prisma` and run migration
- [ ] Add `CSV_EXPENSE` to `ImportTypeEnum`
- [ ] Fix `POST /api/csv-import/confirm/route.ts`:
  - Write `BankTransaction[]` rows before aggregating
  - Aggregate by `(month, categoryId)` → upsert `MonthlyExpenseSummary`
  - Remove per-transaction `matchCategoryWithEmbedding()` call (CSV LLM returns exact category names — no embedding needed)
  - Upsert `MerchantCategoryMap` for each confirmed `(userId, description, categoryId)` triple
- [ ] Fix CSV import wizard to show individual transactions (from classify step) for review — not aggregated (this is the correct UX: review → confirm aggregation)
- [ ] Implement `CsvImportService.confirmImport()` with transaction + aggregation logic
- [ ] Integration test: upload real bank CSV → verify `BankTransaction` count matches CSV row count, verify `MonthlyExpenseSummary` totals match sum of transactions per category/month
- [ ] Verify totals reconciliation: imported total = bank statement "total debits"

## 8. Success metrics

- **Adoption**: 80% of active users create at least one expense entry within 30 days of feature launch
- **Engagement**: Average user adds expense entries for 8+ months per fiscal year
- **Usability**: Less than 5% error rate on expense entry creation (validation failures)
- **Performance**: 95% of page loads complete within 2 seconds, 95% of CRUD operations within 1 second
- **Data quality**: Average of 5+ categories used per user (indicating comprehensive tracking)

## 9. Open questions and risks

### 9.1 Open questions

- Should monthly totals in main table be editable (allow manual override before entering category breakdown)? **Decision**: No, auto-calculated only for MVP to ensure accuracy
- Should system prevent duplicate category entries for same month (enforce unique constraint on `expenseLedgerId` + `month` + `categoryId`)? **Decision**: Allow duplicates, sum them; users may want multiple "Food" entries for different contexts
- Should category dropdown support search/filter for faster selection? **Decision**: Yes, react-select includes built-in search by default
- Should modal support bulk add (multiple categories at once)? **Decision**: No, inline single-entry add/edit for MVP
- Should categories have descriptions or help text (e.g., "Food: groceries, dining out, takeout")? **Decision**: No, category names are self-explanatory for MVP
- **[Open]** How long should `BankTransaction` rows be retained? Options: indefinitely (full audit trail), or pruned after N months to manage DB size.
- **[Open]** Should the Category Breakdown Modal show a "Transactions" drill-down link per entry when the `MonthlyExpenseSummary` has linked `BankTransaction` rows? (Phase 3 consideration.)
- **[Open]** Should `MerchantCategoryMap` entries be editable by the user (let them correct a merchant's default category for future imports)?

### 9.2 Risks

- **Risk**: Users may want custom categories beyond seeded list
  - **Mitigation**: Start with comprehensive 10-category seed list; add "Other" catch-all; document custom category feature as Phase 2 enhancement
- **Risk**: CSV totals do not match bank statement "total debits" figure
  - **Mitigation**: Resolved by `BankTransaction` table — can now sum `BankTransaction.amount` per `importSessionId` and compare to bank statement total; mismatch surfaced in wizard before confirm
- **Risk**: Fiscal year-only filtering may confuse users expecting calendar year view
  - **Mitigation**: Follow existing pattern from Income/Donations pages; fiscal year is standard for financial tracking
- **Risk**: Concurrent edits by user in multiple tabs may cause data conflicts
  - **Mitigation**: Last write wins (no locking); optimistic updates with server confirmation
- **Risk**: LLM misclassifies a merchant → wrong `MonthlyExpenseSummary` category
  - **Mitigation**: Wizard review step lets user override before confirm; `MerchantCategoryMap` learns from overrides so next import is correct automatically

## 10. Future enhancements (out of scope for MVP)

- User-defined custom categories with management UI
- Optional description/notes field for manual expense entries
- Expense reports and visualizations (charts, trends over time)
- Year-over-year comparison view (similar to Income Summary page)
- Export to CSV or PDF for external budgeting tools
- Category budgets and spending limit alerts
- Mobile app for on-the-go expense entry
- Receipt attachment/photo upload
- Direct bank/credit card API integration for automatic expense import (live feeds; CSV upload is already supported)
- Multi-currency support for international expenses
- Subcategories or tags for more granular categorization
- Recurring expense templates (monthly rent, utilities)
- **`BankTransaction` drill-down** in Category Breakdown Modal — "What transactions make up this $450 Groceries/July figure?"
- **User-editable `MerchantCategoryMap`** — let users correct merchant-to-category mappings that persist to future imports
- **`BankTransaction` retention policy** — configurable pruning of raw transaction rows after summary is confirmed
