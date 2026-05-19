# Income Management — Low-Level Design

## Implementation Phases

### Phase 1: Data Model & API Layer ✅ COMPLETED
- Prisma schema: IncomeLedger, IncomeRecord, IncomeSource
- Service layer: addIncomeEntry, updateIncomeEntry, deleteIncomeEntry, getTotalIncome
- Controllers: createIncomeYearHandler, totalIncomeHandler

### Phase 2: CRUD Page (Income Tracking) ✅ COMPLETED
- Server page component with year selection and authentication
- Inline table editing with form state management
- Server actions for add, edit, delete operations

### Phase 3: Summary Page (Income Analysis) ✅ COMPLETED
- Server page component with year dropdown
- Client component with monthly aggregation table
- Expandable rows for source drill-down

---

## Database Schema

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

model IncomeSource {
  id            String         @id @default(cuid())
  name          String         @unique
  description   String?        @db.Text
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  incomeRecords IncomeRecord[]
}
```

---

## Service Layer API

### income.service.ts

#### addIncomeCalendarYearDetails()
```typescript
export const addIncomeCalendarYearDetails = async ({
  calendarId,
  userId,
}: Omit<IncomeModel, 'id'>): Promise<IncomeLedger>
```
- Creates a new IncomeLedger for a user/calendar year combination
- Throws if (calendarId, userId) already exists (via unique constraint)
- Used by server action when creating first income entry for a year

#### getIncome()
```typescript
export const getIncome = async (
  calendarYearId: string,
  userId: string,
): Promise<IncomeModel>
```
- Retrieves IncomeLedger for a user/calendar year
- Returns empty object if not found (no throw)
- Used internally by service layer

#### getIncomeEntries()
```typescript
export const getIncomeEntries = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
): Promise<Array<IncomeEntryModel>>
```
- Returns all IncomeRecords for a calendar year, sorted by dateEarned DESC
- Includes incomeSource details (id, name)
- Used by IncomeTableServer to populate table

#### addIncomeEntry()
```typescript
export const addIncomeEntry = async (
  incomeId: string,
  entry: Omit<IncomeEntryInput, 'id' | 'incomeLedgerId'>,
  prismaClient = prisma,
): Promise<IncomeRecord & { incomeSourceName: string }>
```
- Creates a new IncomeRecord linked to an IncomeLedger
- Validates (implicitly via schema in server action)
- Returns created record with source name
- Used by server action addRow()

#### updateIncomeEntry()
```typescript
export const updateIncomeEntry = async (
  entryId: string,
  entry: Omit<IncomeEntryInput, 'id' | 'incomeLedgerId'>,
  prismaClient = prisma,
): Promise<void>
```
- Updates dateEarned, amount, incomeSourceId for a record
- No return value; errors thrown to caller
- Used by server action editRow()

#### deleteIncomeEntry()
```typescript
export const deleteIncomeEntry = async (
  entryId: string,
  prismaClient = prisma,
): Promise<void>
```
- Deletes an IncomeRecord by ID
- Used by server action deleteRow()

#### getTotalIncome()
```typescript
export const getTotalIncome = async (
  calendarYearId: string,
  userId: string,
  prismaClient = prisma,
): Promise<number>
```
- Calculates sum of all IncomeRecord amounts for a calendar year
- Returns 0 if no records
- Used by server page and income controllers

#### getMonthlyIncomeSummary()
```typescript
export const getMonthlyIncomeSummary = async (
  calendarYearId: string,
  userId: string,
): Promise<Array<MonthlyIncomeSummary>>
```
- Returns array of {month, year, totalAmount, entryCount}
- Sorted by year DESC, month DESC
- Groups and sums all IncomeRecords in memory
- Used by API route /api/income/monthly-summary

#### getSourceBreakdown()
```typescript
export const getSourceBreakdown = async (
  calendarYearId: string,
  month: number,
  year: number,
  userId: string,
): Promise<Array<SourceBreakdown>>
```
- Returns {source, amount, percentage, entryCount} for each source in a specific month
- Sorted by amount DESC
- Used by MonthlySummaryTable when expanding month rows

---

## Server Actions

### src/app/(authorized)/cashflow/income/actions.ts

#### addRow()
**Input**: CreateIncomeEntryInput (Zod schema)
```typescript
{
  dateEarned: Date,
  amount: number,
  incomeSourceId: string,
  calendarYearId: string,
}
```

**Process**:
1. Validate session (throw if not authenticated)
2. Validate input via Zod schema
3. Fetch CalendarYear to get date range
4. Validate dateEarned falls within range
5. Call createIncomeYearHandler() to get/create IncomeLedger
6. Call addIncomeEntry() to create IncomeRecord
7. revalidatePath('/cashflow/income')

**Output**: ServerActionType
```typescript
{
  success: true,
  error: null,
  data: {
    id, dateEarned, amount, incomeSourceId, incomeSourceName, incomeLedgerId
  }
}
// OR on error:
{
  success: false,
  error: "User-friendly error message"
}
```

#### editRow()
**Input**: UpdateIncomeEntryInput (Zod schema)
```typescript
{
  id: string,
  dateEarned: Date,
  amount: number,
  incomeSourceId: string,
}
```

**Process**:
1. Validate session
2. Validate input via Zod schema
3. Call updateIncomeEntry()
4. revalidatePath('/cashflow/income')

**Output**: ServerActionType
```typescript
{ success: true, error: null }
// OR on error:
{ success: false, error: "Error message" }
```

#### deleteRow()
**Input**: DeleteIncomeEntryInput (Zod schema)
```typescript
{ id: string }
```

**Process**:
1. Validate session
2. Validate input via Zod schema
3. Call deleteIncomeEntry()
4. revalidatePath('/cashflow/income')

**Output**: ServerActionType
```typescript
{ success: true, error: null }
// OR on error:
{ success: false, error: "Error message" }
```

---

## Validation Schemas (Zod)

### CreateIncomeEntrySchema
```typescript
{
  dateEarned: Date (not future),
  amount: number (positive, 2 decimals max),
  incomeSourceId: string (non-empty),
  calendarYearId: string (non-empty),
}
```

### UpdateIncomeEntrySchema
```typescript
{
  id: string (non-empty),
  dateEarned: Date (not future),
  amount: number (positive, 2 decimals max),
  incomeSourceId: string (non-empty),
}
```

### DeleteIncomeEntrySchema
```typescript
{
  id: string (non-empty),
}
```

---

## Component Structure

### Page Layout

#### CRUD Page: src/app/(authorized)/cashflow/income/page.tsx
- **Type**: Async Server Component
- **Props**: searchParams (Promise<{fromYear?, toYear?}>)
- **Renders**:
  - Header "Income Tracking" with description
  - Card container with:
    - IncomeForm (year selector, add button)
    - Suspense boundary
    - IncomeTableServer (fetches and displays table)
  - IncomeTableClient (client component inside IncomeTableServer)
- **Data fetching**:
  - getUserFiscalYearType() → user's preferred calendar type
  - getCalendarYearsHandler([fiscalYearType]) → available years
  - totalIncomeHandler() → total for selected year

#### Summary Page: src/app/(authorized)/reports/income-summary/page.tsx
- **Type**: Async Server Component
- **Props**: searchParams (Promise<{calendarYearId?}>)
- **Renders**:
  - Header "Income Summary" with description
  - Card container with:
    - Suspense boundary
    - IncomeSummaryClient (year selector, fetches summary)
    - MonthlySummaryTable (displays table with expandable rows)
- **Data fetching**:
  - getUserFiscalYearType()
  - getCalendarYearsHandler()

### CRUD Page Components

#### IncomeForm (form.tsx)
- **Type**: Client Component
- **Props**: {initialData, yearIdParam, children}
- **State**: {selectedYearId}
- **Renders**:
  - Year selector dropdown (AppSelect)
  - Add button (AppButton with plus icon)
  - Children (IncomeTableServer + IncomeTableClient)
- **Handlers**:
  - onYearChange() → navigate with new year params

#### IncomeTableServer (IncomeTableServer.tsx)
- **Type**: Async Server Component
- **Props**: {calendarYearId}
- **Data fetching**: getIncomeEntries(calendarYearId, userId)
- **Renders**: IncomeTableClient with fetched data

#### IncomeTableClient (IncomeTableClient.tsx)
- **Type**: Client Component
- **Props**: {entries: IncomeEntryType[], totalIncome}
- **State**: {editingId, formData} via useReducer
- **Renders**:
  - Total Earned display (formatted currency)
  - TanStack Table with:
    - Columns: Date Earned | Amount Earned | Income Source | Actions
    - Rows: Read-only or form-editable based on state
    - Actions column: Edit/Delete icons (or Save/Cancel in edit mode)
  - Empty state if no entries
- **Handlers**:
  - onAddClick() → dispatch EDIT_START with new row
  - onEditClick(id) → dispatch EDIT_START with existing row data
  - onCancelClick() → dispatch EDIT_CANCEL
  - onSaveClick() → call addRow() or editRow() server action
  - onDeleteClick(id) → show confirmation, call deleteRow()

#### Reducer (reducer.ts)
```typescript
type EditingState = {
  editingId: string | null,
  formData: Partial<IncomeEntryType> | null,
}

type Action =
  | { type: 'EDIT_START', payload: IncomeEntryType }
  | { type: 'EDIT_CANCEL' }
  | { type: 'FORM_UPDATE', field: string, value: any }
  | { type: 'SAVE_SUCCESS' }
```

#### StateProvider (StateProvider.tsx)
- Wraps IncomeTableClient with Context provider
- Exports useEditingState() hook for use in table components

### Summary Page Components

#### IncomeSummaryClient (IncomeSummaryClient.tsx)
- **Type**: Client Component
- **Props**: {fiscalYears, userId, initialCalendarYearId?}
- **State**: {selectedYearId, monthlySummary, loading}
- **Renders**:
  - Year dropdown (AppSelect)
  - MonthlySummaryTable
  - Loading spinner during fetch
- **Handlers**:
  - useEffect: On year change, fetch /api/income/monthly-summary
  - onYearChange() → setSelectedYearId

#### MonthlySummaryTable (MonthlySummaryTable.tsx)
- **Type**: Client Component
- **Props**: {monthlySummary: MonthlyIncomeSummary[], userId, calendarYearId}
- **State**: {expandedMonths: Set<string>}
- **Renders**:
  - Table with rows: Month/Year | Total Income | Trend | Expand Icon
  - Expandable nested rows (via MonthAccordionPanel)
  - Empty state if no data
- **Handlers**:
  - onRowClick(month, year) → toggle expandedMonths
  - On expand: fetch getSourceBreakdown() and show SourceBreakdownWidget

#### MonthAccordionPanel (_components/MonthAccordionPanel.tsx)
- **Type**: Client Component
- **Props**: {month, year, isExpanded, onToggle}
- **Renders**: Smooth accordion container

#### SourceBreakdownWidget (_components/SourceBreakdownWidget.tsx)
- **Type**: Client Component
- **Props**: {breakdowns: SourceBreakdown[]}
- **Renders**:
  - Nested table: Source | Amount | Percentage
  - SourceBadge components for visual source labels

#### SourceBadge (_components/SourceBadge.tsx)
- **Type**: Client Component
- **Props**: {source: string, size?: 'sm' | 'md'}
- **Renders**: Badge-styled component with source name and optional color

### Table Column Definitions

#### _table/columns.tsx
TanStack Table column definitions:
- **Date Earned**: Date display or form input (conditional)
- **Amount Earned**: Currency display or numeric input (conditional)
- **Income Source**: Badge display or select dropdown (conditional)
- **Actions**: Edit/Delete icons or Save/Cancel buttons (conditional)

Each column checks `isEditing(row.id)` to determine render mode.

---

## API Routes

### GET /api/income/monthly-summary?calendarYearId=X&userId=Y
**Handler**: Route handler in app/api/income/monthly-summary/route.ts

**Query params**:
- `calendarYearId`: Calendar year ID
- `userId`: User ID

**Process**:
1. Validate session or API credentials
2. Call getMonthlyIncomeSummary(calendarYearId, userId)
3. Return JSON array of MonthlyIncomeSummary

**Response** (200):
```typescript
[
  { month: 1, year: 2025, totalAmount: 5000.50, entryCount: 3 },
  { month: 2, year: 2025, totalAmount: 6200.00, entryCount: 4 },
  // ...
]
```

**Error** (400/401/500):
```typescript
{ error: "Error message" }
```

---

## Type Definitions

### IncomeModel
```typescript
{
  id: string,
  calendarId: string,
  userId: string,
}
```

### IncomeEntryModel
```typescript
{
  id: string,
  dateEarned: Date,
  amount: number,
  incomeSourceId: string,
  incomeSourceName: string,
  incomeLedgerId: string,
}
```

### MonthlyIncomeSummary
```typescript
{
  month: number (1-12),
  year: number,
  totalAmount: number,
  entryCount: number,
}
```

### SourceBreakdown
```typescript
{
  source: string,
  amount: number,
  percentage: number,
  entryCount: number,
}
```

### ServerActionType<T>
```typescript
{
  success: boolean,
  error: string | null,
  data?: T,
}
```

---

## UI Specifications

### Income CRUD Page (/cashflow/income)

#### Layout
- Header: "Income Tracking" + subtitle
- Card with padding/border/shadow
- Inside card:
  - Fiscal Year selector dropdown (AppSelect)
  - Add button (AppButton, plus icon) next to dropdown
  - "Total Earned" display field (read-only, formatted currency)
  - Table (TanStack Table)
  - Empty state message if no entries

#### Table Columns
- Date Earned (left-aligned, format: "Jan 15, 2025")
- Amount Earned (right-aligned, format: "$5,250.75")
- Income Source (center, display as badge with color)
- Actions (right, icons: pen edit / trash delete / floppy save / X cancel)

#### Inline Edit Mode
- Active fields show form inputs
- Date: DatePicker component (calendar widget)
- Amount: NumberInput with placeholder "$0.00"
- Source: AppSelect dropdown
- Save/Cancel icons in Actions column

#### Validation Feedback
- Red border on invalid fields
- Error message below field
- Save button disabled if validation fails

### Income Summary Page (/reports/income-summary)

#### Layout
- Header: "Income Summary" + subtitle
- Card with padding/border/shadow
- Inside card:
  - Calendar Year Type selector dropdown (default: FISCAL)
  - Calendar Year selector dropdown
  - Table with monthly aggregations

#### Monthly Aggregation Table
- Columns: Month/Year | Total Income | Trend | Expand Icon
- Format: "January 2025" | "$12,450.75" | ↑ (green) | ⌄
- Sortable by month/year (chronological)
- Empty state: "No income recorded for this period"

#### Source Drill-Down (Expandable)
- Click row → accordion expands below
- Nested table: Source | Amount | Percentage
- Example:
  ```
  Employment       $8,500.00    70%
  Stocks          $2,450.75    20%
  Freelance       $1,500.00    10%
  ```
- Smooth animation on expand/collapse
- Multiple rows can be expanded simultaneously

---

## Error Handling

### Client-Side
- Toast notifications for server action errors
- Inline field validation feedback
- Confirmation dialogs before destructive actions (delete)
- Retry buttons in error toasts

### Server-Side
- Zod validation errors → user-friendly messages
- Authentication errors → "User not authenticated" / "Session expired"
- Database errors → generic "Failed to {action}. Please try again."
- Console.error() for debugging

### Recovery Strategies
- Failed add/edit/delete → no state change; user can retry
- Network error → retry button in toast
- Session expired → redirect to login

---

## Accessibility

### ARIA Labels
- Table: `role="table"`
- Expand buttons: `aria-label="Expand month details"`, `aria-expanded={isExpanded}`
- Close buttons: `aria-label="Close edit"`
- Action icons: `aria-label="Edit income entry"` / `aria-label="Delete income entry"`

### Keyboard Navigation
- Tab: Navigate through form fields and action buttons
- Enter: Submit form or expand accordion
- Escape: Cancel edit or close accordion
- Delete key: Available for delete confirmation

### Visual Accessibility
- Sufficient color contrast (WCAG AA)
- Status messages announced to screen readers (toast notifications)
- Focus indicators on all interactive elements

