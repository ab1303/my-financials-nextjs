# Low-Level Design: Monthly Expense Tracking

## 1. Database Schema

### Prisma Models (Actual Implementation)

```prisma
// Global expense categories (seeded data, shared across all users)
model ExpenseCategory {
  id                        String                   @id @default(cuid())
  name                      String                   @unique
  isActive                  Boolean                  @default(true)
  createdAt                 DateTime                 @default(now())
  summaries                 MonthlyExpenseSummary[]
  transactions              Transaction[]
  merchantCategoryMaps      MerchantCategoryMap[]
}

// Fiscal-year container — one row per user per fiscal year
model ExpenseLedger {
  id                        String                   @id @default(cuid())
  calendarId                String
  calendar                  CalendarYear             @relation(fields: [calendarId], references: [id])
  userId                    String
  user                      User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  summaries                 MonthlyExpenseSummary[]
  createdAt                 DateTime                 @default(now())
  updatedAt                 DateTime                 @updatedAt
  
  @@unique([calendarId, userId])
  @@index([userId])
  @@index([calendarId])
}

// Aggregated monthly total per category
model MonthlyExpenseSummary {
  id                        String                   @id @default(cuid())
  month                     Int                      // 1–12
  amount                    Decimal                  @db.Money
  categoryId                String
  category                  ExpenseCategory          @relation(fields: [categoryId], references: [id])
  expenseLedgerId           String
  expenseLedger             ExpenseLedger            @relation(fields: [expenseLedgerId], references: [id], onDelete: Cascade)
  transactions              Transaction[]           // back-reference for drill-down
  createdAt                 DateTime                 @default(now())
  updatedAt                 DateTime                 @updatedAt
  
  @@index([expenseLedgerId, month])
  @@index([categoryId])
}

// Raw transactions (shared audit trail for all import types: income, donations, expenses)
// Used for CSV expense import audit trail
model Transaction {
  id                        String                   @id @default(cuid())
  date                      DateTime
  description               String
  amount                    Decimal                  @db.Money
  type                      TransactionTypeEnum      // DEBIT for expenses, CREDIT for income
  category                  String                   // Category name (e.g., "Housing", "Utilities", or "Other")
  source                    TransactionSourceEnum    // LLM_CLASSIFIED, USER_OVERRIDE, DIRECT_ENTRY
  status                    TransactionStatusEnum    // CONFIRMED, EXCLUDED
  confirmedAt               DateTime?
  
  userId                    String
  user                      User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  bankAccountId             String?                  // Optional: for multi-account scenarios
  bankAccount               BankAccount?             @relation(fields: [bankAccountId], references: [id], onDelete: SetNull)
  
  importSessionId           String
  importSession             ImportSession            @relation(fields: [importSessionId], references: [id], onDelete: Cascade)
  
  expenseSummaryId          String?
  expenseSummary            MonthlyExpenseSummary?   @relation(fields: [expenseSummaryId], references: [id])
  
  createdAt                 DateTime                 @default(now())
  updatedAt                 DateTime                 @updatedAt
  
  @@index([userId, date])
  @@index([importSessionId])
  @@index([userId, type, source])
  @@index([expenseSummaryId])
}

// Merchant → category dictionary (write-through cache)
model MerchantCategoryMap {
  id                        String                   @id @default(cuid())
  userId                    String
  user                      User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  description               String                   // raw merchant description
  categoryId                String
  category                  ExpenseCategory          @relation(fields: [categoryId], references: [id])
  createdAt                 DateTime                 @default(now())
  updatedAt                 DateTime                 @updatedAt
  
  @@unique([userId, description])
  @@index([userId])
}

// Enums
enum TransactionTypeEnum {
  DEBIT
  CREDIT
  TRANSFER
}

enum TransactionSourceEnum {
  LLM_CLASSIFIED
  USER_OVERRIDE
  DIRECT_ENTRY
}

enum TransactionStatusEnum {
  CONFIRMED
  EXCLUDED
  PENDING
}
```

### Key Constraints & Indexes
- **ExpenseLedger**: Unique on `(calendarId, userId)` — one per fiscal year per user
- **MerchantCategoryMap**: Unique on `(userId, description)` — one merchant mapping per user
- **MonthlyExpenseSummary**: No unique constraint — allows multiple entries per (month, category) pair; app sums
- **Transaction**: Indexes on (userId, date), (importSessionId), (userId, type, source) for query efficiency

### ⚠️  Implementation Note
- Uses `Transaction` model (shared with income/donation imports), NOT dedicated `BankTransaction` model
- `Transaction.source` distinguishes import type: `LLM_CLASSIFIED` for CSV, `DIRECT_ENTRY` for manual
- `Transaction.status = EXCLUDED` marks transfers (not aggregated into `MonthlyExpenseSummary`)

## 2. API Specifications

### Server Actions (Manual Entry CRUD)

#### addRow(input: CreateExpenseEntryInput) → { success: boolean, error?: string, data?: CreateExpenseEntryOutput }

**Input Schema:**
```typescript
{
  month: number          // 1–12
  amount: number         // Positive, up to 2 decimals (e.g., 1250.50)
  categoryId: string     // Expense category ID
  calendarYearId: string // Fiscal year ID
}
```

**Validation:**
- Month: required, 1 ≤ month ≤ 12
- Amount: required, > 0, `Number(val.toFixed(2)) === val`
- CategoryId: required, non-empty string
- CalendarYearId: required, non-empty string

**Process:**
1. Validate session; reject if unauthenticated
2. Parse & validate input with `CreateExpenseEntrySchema`
3. Call `createExpenseYearHandler(calendarYearId, userId)` → get or create `ExpenseLedger`
4. Call `addExpenseEntry({ month, amount, categoryId, expenseLedgerId })`
5. Create `MonthlyExpenseSummary` record
6. Revalidate path `/cashflow/expense`

**Output:**
```typescript
{
  id: string
  month: number
  amount: number
  categoryId: string
  expenseLedgerId: string
}
```

**Error Handling:**
- Return `{ success: false, error: "User not authenticated" }` if no session
- Return validation error for schema failures
- Return `{ success: false, error: "Failed to create expense year record." }` if ledger creation fails
- Catch unexpected errors; return user-friendly message

---

#### editRow(input: UpdateExpenseEntryInput) → { success: boolean, error?: string, data?: ExpenseEntryOutput }

**Input Schema:**
```typescript
{
  id: string             // Expense entry ID (required)
  month?: number         // 1–12 (optional)
  amount?: number        // Positive, up to 2 decimals (optional)
  categoryId?: string    // Category ID (optional)
}
```

**Validation:**
- Id: required, non-empty
- All other fields: optional; validated only if provided

**Process:**
1. Validate session
2. Parse & validate input
3. Call `updateExpenseEntry(id, updates)` with provided fields
4. Revalidate path

**Error Handling:**
- Not found errors: return clear message
- Validation errors: return schema error

---

#### deleteRow(input: DeleteExpenseEntryInput) → { success: boolean, error?: string }

**Input Schema:**
```typescript
{
  id: string             // Expense entry ID
  calendarYearId: string // For consistency/audit (not currently used)
}
```

**Process:**
1. Validate session
2. Parse & validate input
3. Call `deleteExpenseEntry(id)`
4. Revalidate path

---

#### getExpenseCategories() → { success: boolean, error?: string, data: ExpenseCategory[] }

Returns all active categories from seed list, sorted by name.

---

#### getMonthEntries(calendarYearId: string, month: number) → { success: boolean, error?: string, data: ExpenseEntryWithCategory[] }

Fetches entries for specific month; used by Category Breakdown Modal.

**ExpenseEntryWithCategory:**
```typescript
{
  id: string
  month: number
  amount: number
  categoryId: string
  expenseLedgerId: string
  categoryName: string
  importImageId?: string
  importImage?: ImportImage
}
```

---

### Service Layer Functions

#### ExpenseService

**addExpenseCalendarYearDetails(calendarId: string, userId: string) → ExpenseLedger**
- Creates new `ExpenseLedger` record

**getExpense(calendarYearId: string, userId: string) → ExpenseModel**
- Fetches existing `ExpenseLedger` or returns empty object

**getExpenseEntries(calendarYearId: string, userId: string) → ExpenseEntryWithCategory[]**
- Fetches all entries for fiscal year with category names

**getExpenseEntriesForMonth(calendarYearId: string, userId: string, month: number) → ExpenseEntryWithCategory[]**
- Fetches entries for specific month (used by modal)

**getMonthlyExpenseSummaries(calendarYearId: string, userId: string) → MonthlyExpenseSummary[]**
- Returns 12-element array: `{ month, totalAmount, entryCount }` for each month
- Aggregates by month using Prisma `.groupBy()`

**getTotalExpenses(calendarYearId: string, userId: string) → number**
- Sum of all `MonthlyExpenseSummary` amounts for fiscal year

**addExpenseEntry(expenseEntryInput: ExpenseEntryInput) → ExpenseEntryModel**
- Creates `MonthlyExpenseSummary` record

**updateExpenseEntry(id: string, updates: Partial<ExpenseEntryInput>) → ExpenseEntryModel**
- Updates existing entry

**deleteExpenseEntry(id: string) → ExpenseEntryModel**
- Deletes entry

**getExpenseCategories() → ExpenseCategory[]**
- Fetches all active categories

**getCategoryBreakdownForMonth(calendarYearId: string, userId: string, month: number) → CategoryBreakdown[]**
- Returns aggregates by category with percentages

---

### CSV Import Routes (Route Handlers)

#### POST /api/csv-import/confirm

**Input:**
```typescript
{
  classifiedRows: ClassifiedTransactionV2[]  // Array of transactions with confirmed category
  importSessionId: string
  calendarYearId: string
  userId: string
}
```

**Process:**
1. Validate session and inputs
2. For each row in `classifiedRows`:
   - Create `Transaction` record with:
     - `type: DEBIT`
     - `source: USER_OVERRIDE` or `LLM_CLASSIFIED`
     - `status: CONFIRMED` (normal expenses) or `EXCLUDED` (transfers)
     - `importSessionId`
   - If not excluded, aggregate: `upsertMonthlyExpenseSummary({ ledgerId, categoryId, monthNum, amount })`
3. For each unique `(userId, description, categoryId)` triple:
   - Upsert `MerchantCategoryMap` for learning
4. Update `ImportSession.status = COMPLETED`
5. Return summary: `{ savedMonths, totalEntries, duplicatesSkipped, errors }`

**Error Handling:**
- Duplicate detection: Skip if (date, description, amount, type) already exists
- Missing calendar year: Record error and continue
- Missing category: Skip transaction, continue
- DB errors: Return error summary

---

## 3. Component Architecture

### Page & Server Components

**page.tsx** (Server Component)
- Fetch session
- Get fiscal year data: `getCalendarYearsHandler()`
- Calculate default calendar year
- Get total expenses: `totalExpensesHandler()`
- Render form, table, modal

**form.tsx** (Client Component)
- Fiscal year dropdown (Select component)
- On change: Update URL params via `useRouter().push()`

**ExpenseTableServer.tsx** (Server Component)
- Fetch monthly summaries: `getMonthlyExpenseSummaries()`
- Pass to client component

**ExpenseTableClient.tsx** (Client Component)
- TanStack Table with 12 rows
- Columns: Month, Total Expense ($), Category Breakdown (icon button)
- Footer: Annual total
- On category button click: Set selected month, open modal

---

### Modal & Forms

**CategoryBreakdownModal.tsx** (Client Component + StateProvider wrapper)
- Entry list display
- Add/edit/delete form
- Category dropdown (react-select with dark mode support)
- Amount input (NumberFormat component)
- Modal footer with monthly total
- Optimistic updates with rollback on error

**StateProvider.tsx** (Context provider)
- Context + useReducer setup
- Wrap modal content

**reducer.ts** (Immer-based)
- Actions: ADD_ENTRY, EDIT_ENTRY, REMOVE_ENTRY
- Immutable updates via Immer

---

### Forms & Validation

**_schema.ts** (Zod schemas)

```typescript
export const CreateExpenseEntrySchema = z.object({
  month: z.number().int().min(1).max(12),
  amount: z.number().positive().refine(
    (val) => Number(val.toFixed(2)) === val,
    'Amount can have at most 2 decimal places'
  ),
  categoryId: z.string().nonempty('Category is required'),
  calendarYearId: z.string().nonempty('Calendar year is required'),
});

// Similar for Update and Delete schemas
```

---

## 4. UI Specifications

### Main Table Layout
- **Header**: "Monthly Expense Tracking" title with description
- **Fiscal Year Dropdown**: Select from available FISCAL years
- **Total Expense Display**: "Total Expenses for [FY]: $[total]"
- **12-Month Table**:
  - Rows ordered by `CalendarYear.fromMonth` (e.g., Jul–Jun for FISCAL)
  - Columns: Month (e.g., "July 2024"), Total Expense ($), Category Breakdown icon
  - Each row clickable on breakdown icon
  - Footer row: "Total" label + annual sum
- **Empty states**:
  - If no fiscal year found: "No fiscal year found. Please create..."
  - If no expenses: "No expenses recorded. Select a fiscal year..."

### Category Breakdown Modal
- **Header**: "Expenses for [Month Name] [Year]" (e.g., "Expenses for July 2024")
- **Entry list**:
  - Each entry: Category name, Amount ($), Edit button, Delete button
  - Sorted alphabetically by category
  - Empty state: "No expenses recorded for this month. Click + to add your first expense."
- **Add form** (inline or expanded):
  - Category dropdown (react-select, searchable, no custom categories)
  - Amount input (NumberFormat with currency prefix $)
  - Submit button (Add / Update)
- **Footer**: "Total: $[sum]"

### Styling
- Use Tailwind CSS with Flowbite components
- Dark mode: `dark:` variants on all colors
- Tables: Use shared `Table` component
- Dropdowns: `react-select` with `unstyled` + `classNames` const (NOT function)
- Icons: `lucide-react` (List icon for category breakdown, pencil for edit, trash for delete)

---

## 5. Data Flow Diagrams

### Manual Entry Flow
```
User selects fiscal year
      ↓
Page reloads with new URL params
      ↓
ExpenseTableServer fetches monthly summaries
      ↓
User clicks category breakdown icon
      ↓
Modal opens, fetches entries for month via getMonthEntries()
      ↓
User adds/edits/deletes entry
      ↓
Server Action called (addRow / editRow / deleteRow)
      ↓
ExpenseLedger created (if needed)
      ↓
MonthlyExpenseSummary created/updated/deleted
      ↓
revalidatePath('/cashflow/expense')
      ↓
Page refreshes, user sees updated table
```

### CSV Import Flow
```
User uploads CSV to /api/csv-import/upload
      ↓
ImportSession created (status: PENDING)
      ↓
/api/csv-import/parse validates columns, returns raw rows
      ↓
/api/csv-import/classify checks MerchantCategoryMap, then LLM
      ↓
Wizard shows transactions for user review
      ↓
User confirms import
      ↓
POST /api/csv-import/confirm:
  - Create Transaction records (one per row)
  - Aggregate by (month, categoryId)
  - Upsert MonthlyExpenseSummary
  - Upsert MerchantCategoryMap
  - Set ImportSession.status = COMPLETED
      ↓
revalidatePath('/cashflow/expense')
      ↓
Table refreshes, shows aggregated totals
```

---

## 6. Error Scenarios & Handling

| Scenario | Handling |
|----------|----------|
| User not authenticated | Return 401; redirect to login |
| Invalid amount (negative, >2 decimals) | Show validation error inline; block submission |
| Category not found | Return user-friendly error; pre-select first category |
| Fiscal year not found | Show empty state with prompt to create fiscal year |
| Concurrent edits (user in multiple tabs) | Last write wins; no locking in MVP |
| Network error during CSV import | Show error toast; ImportSession remains PENDING; user can retry |
| CSV column mismatch | Return validation error in parse step |
| LLM classification timeout | Fall back to "Other" category |
| Duplicate CSV upload detection | Skip duplicate rows; user sees skipped count in summary |

---

## 7. Testing Strategy

### Manual Testing Checklist
- [ ] Create expense entry for current month
- [ ] Edit existing entry (category and amount)
- [ ] Delete entry
- [ ] Verify monthly total updates
- [ ] Verify annual total updates
- [ ] Switch fiscal years; verify totals change
- [ ] Upload CSV with multiple transactions
- [ ] Verify LLM classification
- [ ] Override category in wizard
- [ ] Confirm CSV import; verify Transaction and MonthlyExpenseSummary records created
- [ ] Verify MerchantCategoryMap caching works (second import of same merchant is instant)
- [ ] Test duplicate detection (upload same CSV twice; verify second is rejected)

### Automation (Not Yet Implemented)
- Unit tests: Zod validation schemas
- Unit tests: Reducer logic (Immer updates)
- Integration tests: Server Actions (CRUD operations)
- Integration tests: CSV import flow end-to-end

---

## 8. Known Limitations & Future TODOs

1. **BankTransaction model**: Uses `Transaction` instead of dedicated `BankTransaction` table
   - TODO: Add dedicated `BankTransaction` table if expense-specific audit fields needed
   
2. **No modal drill-down**: Cannot view raw transactions that make up a `MonthlyExpenseSummary`
   - TODO: Phase 3 — Add transaction drill-down page accessible from modal
   
3. **No MerchantCategoryMap UI**: Users cannot edit merchant mappings
   - TODO: Add management dashboard for MerchantCategoryMap
   
4. **CSV button navigates away**: Import button links to `/cashflow/transactions`
   - TODO: Consider adding dedicated `/cashflow/expense/import` page
   
5. **No retention policy**: All `Transaction` records retained indefinitely
   - TODO: Add configurable archival/pruning after N months

---

## 9. Environment Variables

- **DATABASE_URL** — Postgres connection (existing)
- **NEXTAUTH_SECRET** — Session token (existing)
- **OPENAI_API_KEY** — LLM classification (existing, used by ai-import service)
- No new env vars required

---

## 10. Deployment Checklist

- [ ] Run `pnpm run build` and verify no errors
- [ ] Run linter: `next lint`
- [ ] Run tests (manual or automated)
- [ ] Update `.env-example` if needed
- [ ] Review Prisma migrations
- [ ] Test on staging environment
- [ ] Smoke test on production
- [ ] Monitor error logs for first 24 hours
