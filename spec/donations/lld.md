# Donations Management — Low-Level Design

## Implementation Overview

The Donations feature is **fully implemented** and operational. This LLD documents the actual implementation details as source of truth for future maintenance and feature extensions.

## Database Schema

### DonationLedger Model

```prisma
model DonationLedger {
  id         String            @id @default(cuid())
  calendar   CalendarYear      @relation(fields: [calendarId], references: [id])
  calendarId String            @unique
  payments   DonationPayment[]
}
```

- **Purpose**: Container for all donations in a fiscal year
- **Key Constraints**:
  - `calendarId` is UNIQUE (one ledger per calendar year)
  - Cascade delete handled by Prisma relations
- **Related Models**: CalendarYear (type: FISCAL), DonationPayment[]

### DonationPayment Model

```prisma
model DonationPayment {
  id              String              @id @default(cuid())
  datePaid        DateTime
  amount          Decimal             @db.Money
  beneficiaryType BeneficiaryEnumType
  taxCategory     String
  business        Business?           @relation(fields: [businessId], references: [id])
  businessId      String?
  individual      Individual?         @relation(fields: [individualId], references: [id])
  individualId    String?
  donationLedger  DonationLedger      @relation(fields: [donationLedgerId], references: [id])
  donationLedgerId String
  transaction     Transaction?        @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId   String?             @unique
  donationPurpose DonationPurposeEnum @default(VOLUNTARY)
}
```

**Fields**:
| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | String (cuid) | PK | Unique identifier |
| `datePaid` | DateTime | NOT NULL | Date donation was made |
| `amount` | Decimal | @db.Money, NOT NULL | Donation amount (precise currency) |
| `beneficiaryType` | BeneficiaryEnumType | NOT NULL | INDIVIDUAL or BUSINESS |
| `taxCategory` | String | NOT NULL | Tax category for donation |
| `businessId` | String? | FK to Business | Set if beneficiaryType = BUSINESS |
| `individualId` | String? | FK to Individual | Set if beneficiaryType = INDIVIDUAL |
| `donationLedgerId` | String | FK to DonationLedger | Groups donations by fiscal year |
| `transactionId` | String? | FK to Transaction, @unique | Optional link to bank transaction |
| `donationPurpose` | DonationPurposeEnum | @default(VOLUNTARY) | VOLUNTARY or INTEREST_CLEANSING |

**Key Design Notes**:
- Beneficiary is mutually exclusive: either businessId OR individualId (not both, not neither)
- transactionId is UNIQUE (one-to-one link to Transaction)
- transactionId deletion cascades (onDelete: SetNull) to preserve donation record

### Enums

```prisma
enum BeneficiaryEnumType {
  INDIVIDUAL
  BUSINESS
}

enum DonationPurposeEnum {
  VOLUNTARY
  INTEREST_CLEANSING
}
```

## API Contracts

### Server Actions

#### `addRow(input: CreateDonationPaymentInput): Promise<ServerActionType<DonationPaymentType>>`

**Location**: `src/app/(authorized)/cashflow/donations/actions.ts`

**Input Schema** (zod):
```typescript
CreateDonationPaymentSchema = z.object({
  datePaid: z.date().refine((date) => date <= new Date()),
  amount: z.number().positive().refine((val) => Number(val.toFixed(2)) === val),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  taxCategory: z.string().nonempty(),
  beneficiaryId: z.string().nonempty(),
  transactionId: z.string().optional(),
  donationPurpose: z.nativeEnum(DonationPurposeEnum).optional().default('VOLUNTARY'),
  calendarYearId: z.string().nonempty(),
})
```

**Validation Steps**:
1. Zod schema validation (`CreateDonationPaymentSchema.parse()`)
2. Session check: `const session = await auth()`
3. Beneficiary ID not empty string
4. Calendar year ID validation
5. Business logic: ensure calendar year exists

**Process**:
1. Validate session authentication
2. Parse and validate input schema
3. Call `createDonationYearHandler(calendarYearId)` to ensure DonationLedger exists
4. Call `addDonationPaymentDetail(donationLedgerId, payment)` to create record
5. Revalidate path `/cashflow/donations`
6. Return success with created record

**Error Handling**:
- Returns `{ success: false, error: 'string' }` on failure
- Catches ZodError and returns validation error message
- Catches service layer errors and returns meaningful messages

**Output**: 
```typescript
{
  success: boolean,
  error: unknown,
  data?: DonationPaymentType
}
```

#### `editRow(input: UpdateDonationPaymentInput): Promise<ServerActionType<DonationPaymentType>>`

**Location**: `src/app/(authorized)/cashflow/donations/actions.ts`

**Input Schema** (zod):
```typescript
UpdateDonationPaymentSchema = z.object({
  id: z.string().nonempty(),
  datePaid: z.date().refine((date) => date <= new Date()),
  amount: z.number().positive().refine((val) => Number(val.toFixed(2)) === val),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  taxCategory: z.string().nonempty(),
  beneficiaryId: z.string().nonempty(),
})
```

**Process**:
1. Validate session authentication
2. Parse and validate input schema
3. Call `updateDonationPayment(input, paymentId)` to update record
4. Revalidate path `/cashflow/donations`
5. Return success

**Output**: Same as addRow

#### `deleteRow(input: DeleteDonationPaymentInput): Promise<ServerActionType>`

**Location**: `src/app/(authorized)/cashflow/donations/actions.ts`

**Input Schema** (zod):
```typescript
DeleteDonationPaymentSchema = z.object({
  id: z.string().nonempty(),
})
```

**Process**:
1. Validate session authentication
2. Parse and validate input schema
3. Call `deleteDonationPayment(paymentId)`
4. Revalidate path `/cashflow/donations`
5. Return success

**Output**: 
```typescript
{
  success: boolean,
  error: unknown
}
```

### Service Layer

**Location**: `src/server/services/donation.service.ts`

#### `getDonationPayments(calendarYearId: string): Promise<DonationPaymentModel[]>`

Fetches all donation payments for a fiscal year.

```typescript
const donationPayments = await prisma.donationPayment.findMany({
  where: {
    donationLedger: {
      calendarId: calendarYearId,
    },
  },
  include: {
    business: true,
    individual: true,
    donationLedger: true,
  },
})
```

**Output**: Array of DonationPaymentModel (includes beneficiary details)

#### `getTotalDonations(calendarYearId: string): Promise<number>`

Aggregates sum of all donations for a fiscal year.

```typescript
const result = await prisma.donationPayment.aggregate({
  where: {
    donationLedger: {
      calendarId: calendarYearId,
    },
  },
  _sum: {
    amount: true,
  },
})
return result._sum.amount?.toNumber() ?? 0
```

#### `addDonationPaymentDetail(donationLedgerId: string, payment: Omit<DonationPaymentInput, 'id' | 'donationLedgerId'>): Promise<DonationPayment>`

Creates new donation payment record.

```typescript
await prisma.donationPayment.create({
  data: {
    donationLedgerId,
    datePaid: payment.datePaid,
    amount: payment.amount,
    beneficiaryType: payment.beneficiaryType,
    taxCategory: payment.taxCategory,
    businessId: payment.beneficiaryType === 'BUSINESS' ? payment.beneficiaryId : null,
    individualId: payment.beneficiaryType === 'INDIVIDUAL' ? payment.beneficiaryId : null,
    transactionId: payment.transactionId ?? null,
    donationPurpose: payment.donationPurpose ?? 'VOLUNTARY',
  },
})
```

#### `updateDonationPayment(model: DonationPaymentInput, donationPaymentId: string): Promise<void>`

Updates existing donation payment record.

```typescript
await prisma.donationPayment.update({
  where: { id: donationPaymentId },
  data: {
    datePaid: model.datePaid,
    amount: model.amount,
    beneficiaryType: model.beneficiaryType,
    taxCategory: model.taxCategory,
    businessId: model.beneficiaryType === 'BUSINESS' ? model.beneficiaryId : null,
    individualId: model.beneficiaryType === 'INDIVIDUAL' ? model.beneficiaryId : null,
  },
})
```

#### `deleteDonationPayment(donationPaymentId: string): Promise<void>`

Removes donation payment record.

```typescript
await prisma.donationPayment.delete({
  where: { id: donationPaymentId },
})
```

### Controllers

**Location**: `src/server/controllers/donation.controller.ts`

#### `totalDonationsHandler(calendarYearId: string): Promise<number>`

Wrapper around service layer for route handlers/pages.

#### `createDonationYearHandler(calendarYearId: string): Promise<{ donationCalendarId: string }>`

Ensures DonationLedger exists for calendar year (creates if needed).

## Frontend Component Structure

### Pages & Layouts

**`src/app/(authorized)/cashflow/donations/page.tsx`** (Server Component)

```typescript
async function DonationPage({ searchParams }) {
  // Fetch calendar years, total donations, user's fiscal year type
  // Render header, DonationForm, DonationTableServer, UnlinkedTransactionsBanner
}
```

**Key Actions**:
- Fetches available fiscal years (type: FISCAL)
- Fetches total donations for selected year
- Passes initial data to client components
- URL params determine default year selection

### Client Components

**`src/app/(authorized)/cashflow/donations/form.tsx`** (Client)

Fiscal year selector with total display.

**Props**:
```typescript
type Props = {
  initialData: {
    donationYearData: CalendarYearType[],
    totalDonations: number,
    defaultCalendarYearId?: string,
  },
  yearIdParam: string,
  children: React.ReactNode,
}
```

**Key Features**:
- Dropdown select for fiscal year
- Non-editable total display
- URL sync via useRouter/useSearchParams
- Real-time total updates via context

**`src/app/(authorized)/cashflow/donations/DonationTableServer.tsx`** (Server)

Fetches and renders donation records.

**Server-Side Fetching**:
```typescript
const donationPayments = await getDonationPayments(calendarYearId)
```

**`src/app/(authorized)/cashflow/donations/DonationTableClient.tsx`** (Client)

Renders rows, manages inline editing UI.

**Props**:
```typescript
type Props = {
  donations: DonationPaymentType[],
  isLoading: boolean,
}
```

**Key Features**:
- Row-based inline editing
- Reads edit state from Context
- Dispatch actions to reducer on row interactions
- Calls Server Actions on save/delete

**`src/app/(authorized)/cashflow/donations/StateProvider.tsx`** (Client)

Context + Provider for table state.

**State Shape**:
```typescript
{
  editingRowId: string | null,
  formValues: DonationPaymentInput | null,
  isLoading: boolean,
}
```

**`src/app/(authorized)/cashflow/donations/reducer.ts`**

Reducer actions:
- `set_edit_row` — Enter edit mode for row
- `set_form_values` — Update form field values
- `clear_edit` — Exit edit mode
- `set_loading` — Loading state during save/delete

### Sub-Components

**`_components/UnlinkedTransactionsBanner.tsx`**

Displays warnings for bank transactions without linked donations.

**`_components/LinkTransactionsDrawer.tsx`**

Drawer UI for linking transactions to donations.

**`_components/LinkTransactionsDrawerTrigger.tsx`**

Button to open transaction linking drawer.

**`_components/CreateBeneficiaryModal.tsx`**

Modal for creating new Individual/Business beneficiary entities inline.

## Type Definitions

**`src/app/(authorized)/cashflow/donations/_types.ts`**

```typescript
type DonationType = {
  id: string,
  calendarId: string,
  totalDonations: number,
  paymentHistory: DonationPaymentType[],
}

type DonationPaymentType = {
  id: string,
  datePaid: Date,
  amount: number,
  beneficiaryType: BeneficiaryEnumType,
  taxCategory: string,
  donationPurpose?: DonationPurposeEnum,
  businessId?: string,
  individualId?: string,
  beneficiaryId: string,  // Computed: businessId or individualId
  transactionId?: string,
}

type ServerActionType<T = unknown> = {
  success: boolean,
  error: unknown,
  data?: T,
}
```

## UI Specifications

### Table Structure

**Columns**:
1. Date Paid (DateTime)
2. Amount Paid (Currency)
3. Beneficiary Type (INDIVIDUAL | BUSINESS)
4. Beneficiary (Entity name)
5. Tax Category (String)
6. Actions (Edit, Delete icons)

### Row States

**Read-Only State**:
- All fields display as labels (no input)
- Pen (edit) icon clickable
- Trash (delete) icon clickable

**Edit State**:
- Date Paid: Date picker (calendar widget)
- Amount Paid: Numeric input (positive, 2 decimals)
- Beneficiary Type: Dropdown (INDIVIDUAL | BUSINESS)
- Beneficiary: Filtered dropdown (changes based on type)
- Tax Category: Text input
- Disk (save) icon saves changes
- Undo (cancel) icon reverts changes

**New Row State** (After clicking `+`):
- Immediately rendered as edit mode
- All fields interactive
- Disk (save) icon to create record

### Validations (Client-Side & Server-Side)

**Date Paid**:
- Cannot be future date
- Must fall within selected fiscal year

**Amount Paid**:
- Must be positive
- Max 2 decimal places

**Beneficiary Type**:
- Required field (INDIVIDUAL | BUSINESS)

**Beneficiary**:
- Required field
- Dropdown filtered by type
- Only show user's entities
- Create new via modal

**Tax Category**:
- Required field

### Visual Feedback

- **Loading**: Spinner during save/delete operations
- **Success**: Toast notification "Donation added/updated/deleted successfully"
- **Error**: Inline error messages, toast notifications
- **Empty State**: "No donations recorded for this fiscal year"

## Data Validation Workflow

1. **Client-Side** (react-hook-form + zod if applicable):
   - Real-time validation feedback
   - Prevents invalid submissions

2. **Server-Side** (zod schema + service layer):
   - Re-validates all inputs
   - Business logic checks (fiscal year constraints, beneficiary ownership)
   - Returns detailed error messages

3. **Database Constraints**:
   - Foreign key constraints enforce referential integrity
   - Amount stored as Decimal for precision
   - Unique constraints on calendarId (DonationLedger) and transactionId (DonationPayment)

## Fiscal Year Scoping

- **URL Parameters**: `?fromYear={year}&toYear={year}` determine active fiscal year
- **Server-Side Filtering**: All queries filtered by selected calendar year
- **Date Validation**: Donation date must fall within fiscal year period
- **Total Aggregation**: Sum calculated only for selected year

## Transaction Linking Feature (Undocumented)

- **Integration Point**: UnlinkedTransactionsBanner detects bank transactions without linked donations
- **Linking UI**: LinkTransactionsDrawer provides interface to select unlinked transactions
- **One-to-One Relationship**: transactionId field @unique ensures single transaction per donation
- **Cascade Delete**: SetNull on Transaction deletion preserves donation record

## Error Handling Strategy

### Server Actions
- Try/catch wraps all async operations
- Returns standardized ServerActionType response
- Distinguishes validation errors from service errors
- Includes detailed error messages for debugging

### Service Layer
- Prisma error handling (unique violations, foreign key constraints)
- NotFound errors for missing records
- Type-safe queries prevent SQL injection

### UI Feedback
- Toast notifications for success/failure
- Inline error messages on form fields
- Disabled states during loading
- Graceful error recovery (undo changes on failure)

## Performance Considerations

- **Server-Side Aggregation**: `getTotalDonations()` uses Prisma aggregate (single query)
- **Indexed Queries**: DonationLedger calendarId is unique, DonationPayment queries filtered by donationLedgerId
- **Lazy Loading**: Beneficiary entities loaded only when needed
- **Client-Side State**: Minimal state in React Context (edit mode, form values)
- **Revalidation Strategy**: revalidatePath after mutations ensures fresh data

## Security Considerations

- **Authentication**: All Server Actions validate session
- **Authorization**: Beneficiary access scoped to user's own entities
- **Input Validation**: Zod schemas prevent invalid data
- **SQL Injection**: Prisma client prevents parameterized query attacks
- **XSS Prevention**: React escapes all rendered content
- **CSRF Protection**: Server Actions run in authenticated session context
