# Donations Management — High-Level Design

## Feature Overview

The Donations Management feature enables authenticated users to track and record their charitable donations for tax reporting purposes. Users record donations they have already made (not a payment processor), categorize them by beneficiary type (Individual or Business) and tax purpose, and maintain detailed records organized by fiscal year. The system provides centralized donation tracking with accurate totals and comprehensive CRUD operations.

## Goals

### User Goals
- Track all charitable donations for tax deduction purposes
- Organize donations by fiscal year for streamlined tax filing
- Maintain detailed records of donation beneficiaries and amounts
- Generate accurate donation totals for specific tax periods

### Business Goals
- Provide comprehensive donation tracking for tax compliance
- Enhance user engagement through practical financial management tools
- Support users in maintaining accurate charitable giving records
- Streamline tax preparation by organizing donation data by fiscal year

## Non-Goals
- Tax calculation or advice features (purely record-keeping)
- Payment processing or financial transactions (tracking only)
- Integration with external tax software or government systems
- Management of donations for years other than the selected fiscal year
- Support for unauthenticated or guest users
- Automatic donation import from bank statements

## Architecture & Data Model

### Core Entities

**DonationLedger** (Per-Fiscal-Year Container)
- One record per calendar year, created automatically on first donation
- Acts as grouping container for all donations in that fiscal year
- Foreign key link to CalendarYear (type: FISCAL)
- One-to-many relationship with DonationPayment records

**DonationPayment** (Individual Donation Record)
- Represents a single charitable donation event (dated, amount, beneficiary)
- Many-to-one relationship with DonationLedger (scoped to fiscal year)
- One-to-many beneficiary relationship (either Business OR Individual, determined by `beneficiaryType` field)
- Optional one-to-one link to Transaction (for transaction linking feature)

### Key Design Decisions

1. **Ledger Container Pattern**: DonationLedger groups donations by fiscal year, mirroring ZakatObligation/ZakatPayment architecture for consistency

2. **Server-First Data Fetching**: Page component fetches donation data on server, minimizes client-side state

3. **Row-Based Inline Editing**: All CRUD operations occur within table rows, no separate forms or modals

4. **Context + Reducer State Management**: Table uses React Context + useReducer for edit mode, form values, loading state (Client Component)

5. **Server Actions for Mutations**: addRow, editRow, deleteRow implement type-safe, validated mutations with session checks

6. **Fiscal Year Scoping**: URL parameters persist selected fiscal year, all operations filter by selected year

7. **Transaction Linking**: Optional integration with bank transactions (undocumented feature added in implementation)

8. **Purpose Categorization**: donationPurpose field enables tax-specific tracking (VOLUNTARY vs INTEREST_CLEANSING)

## Feature Flows

### Add Donation Workflow
1. User navigates to /cashflow/donations with fiscal year selected
2. Clicks `+` icon button above table
3. New editable row rendered inline at bottom of table
4. Row contains:
   - Date Paid: Calendar picker (defaults to today, constrained to fiscal year)
   - Amount Paid: Numeric input (positive, max 2 decimal places)
   - Beneficiary Type: Dropdown (INDIVIDUAL | BUSINESS)
   - Beneficiary: Filtered dropdown based on type (user's existing entities)
   - Tax Category: Text input or dropdown with categories
   - Actions: Save (disk) icon
5. User fills all required fields
6. Client validates via `CreateDonationPaymentSchema` (zod)
7. On save, Server Action `addRow()` validates, creates DonationPayment
8. Service layer calls `addDonationPaymentDetail()` and `createDonationYearHandler()`
9. Table refreshes automatically (via revalidatePath)
10. Row converts to read-only state with pen (edit) and trash (delete) icons
11. Total donations recalculated server-side

### Edit Donation Workflow
1. User clicks pen (edit) icon on existing row
2. Row converts to edit mode with same fields as add workflow
3. Form fields pre-populated with current values
4. User modifies fields with same validations as add
5. On save, Server Action `editRow()` updates record
6. Service layer calls `updateDonationPayment()`
7. Table refreshes, row returns to read-only state
8. Total donations recalculated

### Delete Donation Workflow
1. User clicks trash (delete) icon on row
2. Confirmation dialog displayed with donation details
3. On confirmation, Server Action `deleteRow()` removes record
4. Service layer calls `deleteDonationPayment()`
5. Table refreshes, row removed
6. Total donations recalculated automatically

### Fiscal Year Filtering Workflow
1. Page loads, defaults to current/most recent fiscal year
2. User selects different fiscal year from dropdown in DonationForm
3. URL updated with `?fromYear={year}&toYear={year}` parameters
4. DonationTableServer re-fetches donations for new year
5. Table re-renders with filtered records
6. Total donations recalculated for selected year
7. Year selection persists during user session via URL

### Transaction Linking Workflow (Undocumented Feature)
1. UnlinkedTransactionsBanner detects bank transactions without linked donations
2. User clicks "Link Transactions" button
3. LinkTransactionsDrawer opens showing unlinked transactions
4. User selects transaction to link with a donation
5. Creates one-to-one link: DonationPayment.transactionId → Transaction.id
6. Donation record now linked to source transaction
7. Banner refreshes, linked transaction no longer shown as unlinked

## Technical Stack

- **Frontend Framework**: Next.js 16 (App Router, Server Components)
- **Data Fetching**: Server Components, fetch with revalidatePath
- **State Management**: React Context + useReducer (Client Component for edit UI)
- **Form Handling**: react-hook-form (implied), zod validation
- **ORM**: Prisma with PostgreSQL database
- **Authentication**: NextAuth v5 (beta) via session checks in Server Actions
- **UI Components**: Flowbite components, custom Table component
- **Styling**: Tailwind CSS

## Authentication & Authorization

- Only authenticated users can access /cashflow/donations
- Server Actions validate `session?.user?.id` before operations
- Beneficiary dropdowns filtered to user's own Business/Individual entities
- Database queries implicitly scoped via beneficiary ownership (not explicit userId field on DonationPayment)
- Unauthenticated requests rejected with "User not authenticated" error

## Performance & Scalability

- Server-side aggregation: `getTotalDonations()` uses Prisma aggregate for efficient summation
- Fiscal year filtering reduces query result set
- Row-based rendering avoids re-rendering entire table on single row changes
- Server Components minimize client-side JavaScript
- Revalidation strategy ensures consistent data without manual polling

## Out of Scope

- Integration with external tax software (TurboTax, etc.)
- Tax deduction calculations or advice
- Import/export of donation records (CSV, PDF export)
- Recurring donation templates
- Donation reminder/notification features
- Mobile app or native platform support
- Advanced reporting or analytics dashboards
