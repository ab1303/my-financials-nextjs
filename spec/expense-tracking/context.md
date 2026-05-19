# Context: Monthly Expense Tracking

## File Inventory

### Database & Models
- `prisma/schema.prisma` — Prisma schema with `ExpenseCategory`, `ExpenseLedger`, `MonthlyExpenseSummary`, `Transaction` models
  - ⚠️ **Note**: `BankTransaction` model was planned but NOT implemented; uses `Transaction` instead (see "Implementation Gap" below)
  - `ExpenseCategory` — Global seeded expense categories (Housing, Utilities, Food, etc.)
  - `ExpenseLedger` — Container: one row per user per fiscal year
  - `MonthlyExpenseSummary` — Aggregated: one row per category per month
  - `Transaction` — Audit trail: one row per CSV debit line (not `BankTransaction` as originally planned)
  - `MerchantCategoryMap` — Write-through cache: merchant description → category lookup

### API Layer

#### Server Actions (Manual Entry)
- `src/app/(authorized)/cashflow/expense/actions.ts`
  - `addRow()` — Create `MonthlyExpenseSummary` entry
  - `editRow()` — Update `MonthlyExpenseSummary` entry
  - `deleteRow()` — Delete `MonthlyExpenseSummary` entry
  - `getExpenseCategories()` — Fetch active categories
  - `getMonthEntries()` — Fetch entries for specific month (used by modal)

#### CSV Import Routes (Route Handlers)
- `src/app/api/csv-import/` — Handles CSV upload, parsing, classification, confirmation
  - Currently uses `Transaction` model for audit trail, not `BankTransaction`

### Services

#### Main Services
- `src/server/services/expense.service.ts` — Business logic for expense operations
  - `addExpenseCalendarYearDetails()` — Create `ExpenseLedger`
  - `getExpense()` — Fetch `ExpenseLedger` by calendar year + user
  - `getExpenseEntries()` — Fetch all entries for fiscal year
  - `getExpenseEntriesForMonth()` — Fetch entries for specific month
  - `getMonthlyExpenseSummaries()` — Aggregate totals by month (used by main table)
  - `getTotalExpenses()` — Calculate annual total
  - `addExpenseEntry()` — Create new entry
  - `updateExpenseEntry()` — Update existing entry
  - `deleteExpenseEntry()` — Delete entry
  - `getExpenseCategories()` — Fetch active categories
  - `getCategoryBreakdownForMonth()` — Get category-level aggregates for modal

#### CSV/Transaction Services
- `src/server/services/transactions/csv-confirm.service.ts` — CSV import confirmation logic
  - `confirmDebitTransactions()` — Main entry point for CSV confirm flow
  - `upsertMonthlyExpenseSummary()` — Aggregate transactions by (month, categoryId)
  - `createTransactionRecord()` — Create `Transaction` audit record (NOT `BankTransaction`)
  - Current implementation uses `Transaction` model with `importSessionId` reference
  
- `src/server/services/ai-import/csv-classifier.service.ts` — LLM classification + merchant caching

### UI Components

#### Page & Layouts
- `src/app/(authorized)/cashflow/expense/page.tsx` — Server Component
  - Fiscal year fetching and selection logic
  - Renders form + table + modal

- `src/app/(authorized)/cashflow/expense/form.tsx` — Client Component
  - Fiscal year dropdown selector

- `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` — Server Component
  - Fetches monthly aggregates from `MonthlyExpenseSummary`

- `src/app/(authorized)/cashflow/expense/ExpenseTableClient.tsx` — Client Component
  - TanStack Table rendering (12 months, totals, category breakdown icon)

- `src/app/(authorized)/cashflow/expense/StateProvider.tsx` — Context + useReducer wrapper
- `src/app/(authorized)/cashflow/expense/reducer.ts` — Immer-based state reducer

#### Modals & Forms
- `src/app/(authorized)/cashflow/expense/_components/CategoryBreakdownModal.tsx`
  - Entry list display, add/edit/delete form
  - Category dropdown (react-select), amount input
  - Modal footer with monthly total

#### Schemas & Types
- `src/app/(authorized)/cashflow/expense/_schema.ts` — Zod validation schemas
  - `CreateExpenseEntrySchema` — month (1-12), amount (positive, 2 decimals), categoryId, calendarYearId
  - `UpdateExpenseEntrySchema` — all fields optional
  - `DeleteExpenseEntrySchema` — id + calendarYearId

- `src/app/(authorized)/cashflow/expense/_types.ts` — TypeScript type definitions

### Controllers
- `src/server/controllers/expense.controller.ts` — Coordination layer
  - `totalExpensesHandler()` — Get annual total
  - `createExpenseYearHandler()` — Get or create `ExpenseLedger`

## Current Three-Layer Model

### Manual Entry Flow
1. User enters category + amount for a specific month
2. Server Action creates `MonthlyExpenseSummary` record
3. Main table aggregates by month and displays totals

### CSV Import Flow
1. User uploads bank CSV → `ImportSession` created (status: PENDING)
2. CSV parser validates columns, extracts date/description/amount
3. LLM classifier categorizes each row using `MerchantCategoryMap` (exact match first, then LLM)
4. Wizard shows individual transactions for review (classified categories)
5. On confirm:
   - Creates `Transaction` record per row (audit trail)
   - Aggregates by (month, categoryId) → upserts `MonthlyExpenseSummary`
   - Upserts `MerchantCategoryMap` for merchant learning
   - Updates `ImportSession.status = COMPLETED`

## Implementation Gap: BankTransaction vs Transaction

### What the PRD Says
- Three-layer model: `BankTransaction` (raw) → `MonthlyExpenseSummary` (aggregate) → `ExpenseLedger` (container)
- Each CSV debit line → one `BankTransaction` row for audit trail
- Schema rename migration mentioned: `BankTransaction` model to be added in Phase 9

### What's Actually Implemented
- Uses generic `Transaction` model (shared with income/donation imports)
- `Transaction.source` field: `LLM_CLASSIFIED` | `USER_OVERRIDE`
- `Transaction.status` field: `CONFIRMED` | `EXCLUDED`
- `Transaction.importSessionId` references the CSV import session
- CSV import flow creates `Transaction` records with type=DEBIT, source=LLM_CLASSIFIED|USER_OVERRIDE

### Why Transaction Instead of BankTransaction
- **Code reuse**: Single `Transaction` model serves income, donations, and expense imports
- **Flexibility**: `TransactionTypeEnum` (DEBIT, CREDIT, TRANSFER) and `TransactionSourceEnum` allow categorizing all transaction types
- **Audit trail**: `Transaction.confirmedAt`, `.source`, `.status` provide sufficient provenance
- **DB design**: Reduces schema duplication; one transaction table scales better than separate tables per import type

### Implications
- ✅ Audit trail preserved: Can trace which CSV import produced which expense
- ✅ Deduplication works: Uses `Transaction` records to detect duplicate uploads
- ❌ No BankTransaction-specific fields (future extensions would need schema changes)
- ❌ Modal drill-down from `MonthlyExpenseSummary` → underlying transactions requires filter by import type

## Database Constraints & Indexing

### Unique Constraints
- `ExpenseLedger` — `@@unique([calendarId, userId])` — One ledger per fiscal year per user
- `MerchantCategoryMap` — `@@unique([userId, description])` — One merchant mapping per user

### Indexes (Current & Recommended)
- `Transaction` — `@@index([userId, date])`, `@@index([importSessionId])`, `@@index([userId, categoryId])`, `@@index([expenseSummaryId])`
- `MonthlyExpenseSummary` — Implicit FK indexes on expenseLedgerId, categoryId (Prisma auto-creates)
- Recommended: Add index on `MonthlyExpenseSummary(expenseLedgerId, month)` for fast month lookups

## API Patterns

### Server Actions (Manual CRUD)
- Session validation required in all actions
- `revalidatePath('/cashflow/expense')` after mutations
- Error handling with user-friendly messages
- Return format: `{ success: boolean, error?: string, data?: T }`

### CSV Import Route Handlers (Route Pattern)
- `POST /api/csv-import/upload` — Receives multipart form data
- `POST /api/csv-import/parse` — Parses CSV rows
- `POST /api/csv-import/classify` — Classifies with LLM + merchant cache
- `POST /api/csv-import/confirm` — Writes Transaction + MonthlyExpenseSummary + MerchantCategoryMap

## State Management

### Client-Side State (Modal)
- Context + useReducer pattern (Immer-based)
- Manages entry list and editing state
- Actions: `ADD_ENTRY`, `EDIT_ENTRY`, `REMOVE_ENTRY`
- Optimistic updates with server confirmation + rollback on error

### Server-Side State
- `ExpenseLedger` — Parent container (created implicitly on first entry)
- `MonthlyExpenseSummary` — Immutable aggregated totals (created/updated by Server Actions)
- `Transaction` — Immutable audit records (created during CSV import confirmation)

## Fiscal Year Handling

- **Fiscal year filtering**: Only `FISCAL` type calendar years displayed
- **Month ordering**: Follows `CalendarYear.fromMonth` (e.g., FISCAL 7→June 30 shows Jul, Aug, ..., Dec, Jan, ..., Jun)
- **Month labeling**: "Month Name YYYY" format (e.g., "July 2024", "August 2024")
- **Default selection**: Current fiscal year on initial page load

## Known Limitations & TODOs

1. **BankTransaction model not implemented** — Uses `Transaction` instead
   - Original plan: dedicated `BankTransaction` table for CSV-imported transactions
   - Current: Shares `Transaction` table with income/donation imports
   - Impact: Modal drill-down not yet available; would need separate landing page

2. **No MerchantCategoryMap user edits** — Write-through only
   - Users cannot manually correct merchant mappings via UI
   - Future enhancement: Add management dashboard

3. **No CSV import UX in main expense UI** — CSV button links to /transactions page
   - Separate CSV import wizard lives under `/cashflow/transactions`
   - Could be consolidated with dedicated `/cashflow/expense/import` page

4. **No archive/retention policy** — All `Transaction` records retained indefinitely
   - Risk: DB bloat after years of imports
   - Future: Add configurable pruning policy

5. **Tests incomplete** — Manual testing done; integration tests pending
   - No automated tests for CSV import flow
   - No integration tests for Server Actions

## Environment Variables

- `NEXT_PUBLIC_EXPENSE_FEATURE_ENABLED` — Feature flag (if applicable)
- No additional secrets required; uses existing DB connection and LLM credentials
