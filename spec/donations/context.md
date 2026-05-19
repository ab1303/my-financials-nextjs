# Donations Management — Context & File Inventory

## File Inventory

### Database Schema
- **`prisma/schema.prisma`** (lines 220-243)
  - `model DonationLedger` — Per-calendar-year header (one per fiscal year)
  - `model DonationPayment` — Individual donation records with transaction linking
  - `enum BeneficiaryEnumType` — INDIVIDUAL, BUSINESS
  - `enum DonationPurposeEnum` — VOLUNTARY, INTEREST_CLEANSING

### Service Layer
- **`src/server/services/donation.service.ts`**
  - `addDonationCalendarYearDetails()` — Create DonationLedger for calendar year
  - `getDonation()` — Fetch DonationLedger by calendar ID
  - `getDonationPayments()` — Fetch all payments for a fiscal year
  - `updateDonationPayment()` — Update existing payment record
  - `addDonationPaymentDetail()` — Create new payment record
  - `deleteDonationPayment()` — Remove payment record
  - `getTotalDonations()` — Aggregate sum of all donations for fiscal year

### Controllers
- **`src/server/controllers/donation.controller.ts`**
  - `createDonationYearHandler()` — Ensure DonationLedger exists for calendar
  - `totalDonationsHandler()` — Server-side fetch of donation total

### Server Actions
- **`src/app/(authorized)/cashflow/donations/actions.ts`**
  - `addRow()` — Create new donation payment (with validation)
  - `editRow()` — Update existing donation payment
  - `deleteRow()` — Remove donation payment record

### Frontend Components
- **`src/app/(authorized)/cashflow/donations/page.tsx`** (Server)
  - Main donation tracking page
  - Fetches calendar years, total donations, user's fiscal year type
  - Renders header, form, table, and UnlinkedTransactionsBanner

- **`src/app/(authorized)/cashflow/donations/form.tsx`** (Client)
  - Fiscal year selector dropdown with URL persistence
  - Total donations display (non-editable)
  - Controlled Select component for year filtering

- **`src/app/(authorized)/cashflow/donations/DonationTableServer.tsx`** (Server)
  - Server-side fetching of donation records
  - Passes data to DonationTableClient for rendering

- **`src/app/(authorized)/cashflow/donations/DonationTableClient.tsx`** (Client)
  - Row-based inline editing table
  - State management via React Context + useReducer
  - Renders editable and read-only row states

- **`src/app/(authorized)/cashflow/donations/StateProvider.tsx`** (Client)
  - Context provider for donation table state
  - useReducer for edit mode, form values, loading state

- **`src/app/(authorized)/cashflow/donations/reducer.ts`** (Client)
  - State reducer for table operations
  - Actions: set_edit_row, set_form_values, clear_edit, set_loading

- **`src/app/(authorized)/cashflow/donations/_components/`**
  - `UnlinkedTransactionsBanner.tsx` — Displays unlinked transaction warnings
  - `LinkTransactionsDrawer.tsx` — UI for linking transactions to donations
  - `LinkTransactionsDrawerTrigger.tsx` — Button to open linking drawer
  - `CreateBeneficiaryModal.tsx` — Modal for creating new beneficiary entities

### Validation & Types
- **`src/app/(authorized)/cashflow/donations/_schema.ts`**
  - `FormDataSchema` — Fiscal year selection
  - `CreateDonationPaymentSchema` — Payment creation with zod validation
  - `UpdateDonationPaymentSchema` — Payment update validation
  - `DeleteDonationPaymentSchema` — Payment deletion validation

- **`src/app/(authorized)/cashflow/donations/_types.ts`**
  - `DonationType` — Full donation ledger with payment history
  - `DonationPaymentType` — Individual payment record
  - Type definitions for all schema forms

## Current Database Schema

### DonationLedger Model
```prisma
model DonationLedger {
  id         String            @id @default(cuid())
  calendar   CalendarYear      @relation(fields: [calendarId], references: [id])
  calendarId String            @unique
  payments   DonationPayment[]
}
```

- **One-to-one** relationship with CalendarYear (fiscal year)
- **One-to-many** relationship with DonationPayment
- Acts as container for all donations in a fiscal year

### DonationPayment Model
```prisma
model DonationPayment {
  id              String              @id @default(cuid())
  datePaid        DateTime
  amount          Decimal             @db.Money
  beneficiaryType BeneficiaryEnumType  (INDIVIDUAL | BUSINESS)
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

- **Many-to-one** with DonationLedger (grouped by fiscal year)
- **One-to-many** beneficiary relationship (either Business OR Individual, not both)
- **One-to-one** optional link to Transaction (for transaction linking feature)
- Fields:
  - `datePaid` — Date donation was made
  - `amount` — Donation amount (Decimal for precise currency)
  - `beneficiaryType` — INDIVIDUAL or BUSINESS
  - `taxCategory` — User-defined or system tax category string
  - `donationPurpose` — VOLUNTARY (default) or INTEREST_CLEANSING
  - `transactionId` — Optional link to bank/transaction record

### Enums
- **BeneficiaryEnumType**: INDIVIDUAL, BUSINESS
- **DonationPurposeEnum**: VOLUNTARY, INTEREST_CLEANSING

## Data Flow Patterns

### Add Donation
1. Client clicks `+` button → new editable row rendered inline
2. User fills form fields (date, amount, beneficiary, tax category)
3. Client validates via `CreateDonationPaymentSchema`
4. Server Action `addRow()` validates, calls service layer
5. Service creates `DonationPayment` record
6. Table re-fetches, row converts to read-only state
7. Total recalculates automatically

### Edit Donation
1. Client clicks pen icon → row converts to edit mode
2. Form fields populate with current values
3. Client validates via `UpdateDonationPaymentSchema`
4. Server Action `editRow()` updates record
5. Table refreshes, row returns to read-only
6. Total recalculates

### Delete Donation
1. Client clicks trash icon → confirmation dialog
2. User confirms deletion
3. Server Action `deleteRow()` removes record
4. Table refreshes, row removed
5. Total recalculates

### Fiscal Year Filtering
1. User selects year from dropdown in form
2. URL params updated (`?fromYear=2024&toYear=2025`)
3. DonationTableServer refetches donations for selected year
4. Table re-renders with filtered records
5. Total recalculated for selected year

### Transaction Linking (Implemented but Undocumented in PRD)
1. UnlinkedTransactionsBanner shows unlinked bank transactions
2. User clicks "Link Transactions" button
3. LinkTransactionsDrawer opens with list of unlinked transactions
4. User selects transaction to link with donation
5. Updates `DonationPayment.transactionId`
6. Transaction record linked one-to-one (transactionId is @unique)

## Key Patterns & Conventions

- **Row-based inline editing**: Donations table uses inline editing, not modals
- **Server-first data fetching**: DonationTableServer fetches data server-side
- **Client Context for UI state**: StateProvider manages edit mode, form values, loading
- **Server Actions for mutations**: addRow, editRow, deleteRow are Server Actions
- **URL-based fiscal year selection**: Selected year persists via URL params
- **Automatic total aggregation**: getTotalDonations() sums all payments server-side
- **Beneficiary type switching**: Beneficiary dropdown filters based on type selection
- **Transaction linking**: Optional one-to-one link to bank transactions (undocumented feature)
- **Purpose categorization**: donationPurpose enables tax-specific categorization (VOLUNTARY vs INTEREST_CLEANSING)

## Known Deviations from Original PRD

1. **Model naming**: Implementation uses `DonationLedger`/`DonationPayment`, not `Donation`/`DonationEntry`
2. **Schema fields**: Added `donationPurpose` and `transactionId` fields
3. **Transaction linking**: Feature exists but not documented in PRD
4. **Beneficiary handling**: Uses existing Business/Individual entities, not new donation-specific beneficiary tables
5. **UI implementation**: Uses existing table patterns rather than custom form components
