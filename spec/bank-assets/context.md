# Bank Assets Cash Tracking - File Inventory & Context

## Feature Overview

The Bank Assets feature enables authenticated users to track cash holdings across multiple bank accounts by taking point-in-time snapshots. Each snapshot captures the financial position on a specific date, organized by bank and account. The feature includes calendar year filtering (Fiscal, Annual, Zakat), accordion-based display, and complete CRUD operations for snapshots and accounts.

## Route & Navigation

- **Route**: `/assets/bank`
- **Navigation Path**: Assets → Bank (sidebar navigation)
- **Route Handler**: `src/app/(authorized)/assets/bank/`

## Database Schema

### Core Models

**BankAccount**
- `id` (String, PK)
- `name` (String) - Account name (e.g., "Savings", "Cheque")
- `bankId` (String, FK) - References Business (type: BANK)
- `bank` (Business) - Relation to bank entity
- `userId` (String, FK) - Scoped to authenticated user
- `user` (User) - Relation to user
- `balanceRecords` (BankBalanceRecord[]) - All historical records for this account
- `transactions` (Transaction[]) - Related transactions
- `debitTransferRules` / `creditTransferRules` - Transfer matching rules
- `createdAt`, `updatedAt` (Timestamps)
- **Unique Constraint**: `[name, bankId, userId]` - Account names unique per bank per user
- **Index**: `[userId, bankId]`

**BankBalanceSnapshot**
- `id` (String, PK)
- `snapshotDate` (DateTime) - Date of this snapshot
- `userId` (String, FK) - Scoped to authenticated user
- `user` (User) - Relation to user
- `balanceRecords` (BankBalanceRecord[]) - All account balances in this snapshot
- `createdAt`, `updatedAt` (Timestamps)
- **Index**: `[userId, snapshotDate]`

**BankBalanceRecord** (formerly BankAssetEntry in old naming)
- `id` (String, PK)
- `balance` (Decimal @db.Money) - Account balance amount
- `accountId` (String, FK) - References BankAccount
- `account` (BankAccount) - Relation to account
- `snapshotId` (String, FK) - References BankBalanceSnapshot (cascade delete)
- `snapshot` (BankBalanceSnapshot) - Relation to snapshot
- `importImage` (ImportImage?) - Optional image import reference
- `importImageId` (String?) - FK for import image
- `createdAt`, `updatedAt` (Timestamps)
- **Unique Constraint**: `[accountId, snapshotId]` - One record per account per snapshot
- **Index**: `[snapshotId]`

## Type Definitions

**Location**: `src/types/bank-asset.types.ts`

### Extended Types (with relations)
- `BankAccountWithBank` - BankAccount + bank details
- `BankAssetEntryWithAccount` - BankBalanceRecord with full account/bank info
- `BankAssetSnapshotWithEntries` - BankBalanceSnapshot with all entries

### Aggregation Types
- `BankTotalSummary` - Aggregated total per bank
- `AccountBalance` - Individual account balance
- `SnapshotTotals` - Grand total across all banks

### Form Types
- `SnapshotEntryForm` - Single entry in snapshot form
- `SnapshotFormData` - Complete snapshot form data
- `BankAccountOption`, `BankOption` - react-select options

### Calendar Types
- `CalendarType` - 'FISCAL' | 'ANNUAL' | 'ZAKAT'
- `CalendarYearFilter` - Calendar year selection and range

### API Response Types
- `CreateAccountResponse`, `CreateSnapshotResponse`, `UpdateEntryResponse`, `DeleteResponse`

## Services & Controllers

### Bank Asset Service
**Location**: `src/server/services/bank-asset.service.ts`

**Bank Account Operations**
- `createBankAccount()` - Create new account
- `getBankAccounts()` - List accounts with optional bank filter
- `getBankAccountById()` - Retrieve single account
- `updateBankAccount()` - Rename account with uniqueness validation

**Snapshot Operations**
- `createBankAssetSnapshot()` - Create snapshot with entries in transaction
- `getBankAssetSnapshots()` - List snapshots with optional date range filter
- `getMostRecentSnapshot()` - Get latest snapshot
- `getSnapshotById()` - Retrieve single snapshot with entries
- `updateBankAssetEntry()` - Update account balance in snapshot
- `deleteBankAssetEntry()` - Remove account from snapshot
- `deleteSnapshot()` - Delete entire snapshot
- `getSnapshotTotals()` - Compute aggregated totals per bank

## API Routes & Endpoints

### tRPC Router
**Location**: `src/server/trpc/router/bank-asset.ts`

**Protected Procedures** (require authentication via `protectedProcedure`)

**Bank Account Procedures**
- `bankAssetRouter.createBankAccount` - POST create account
- `bankAssetRouter.getBankAccounts` - GET list accounts

**Snapshot Procedures**
- `bankAssetRouter.createSnapshot` - POST create snapshot
- `bankAssetRouter.getSnapshots` - GET list snapshots with filters
- `bankAssetRouter.getMostRecentSnapshot` - GET latest snapshot
- `bankAssetRouter.getSnapshotById` - GET snapshot by ID
- `bankAssetRouter.getSnapshotTotals` - GET computed totals

**Entry Procedures**
- `bankAssetRouter.updateEntry` - PATCH update balance
- `bankAssetRouter.deleteEntry` - DELETE remove entry
- `bankAssetRouter.deleteSnapshot` - DELETE entire snapshot

### Input Schemas
**Location**: `src/server/schema/bank-asset.schema.ts`

- `createBankAccountSchema` - Validates bank account creation input
- `createBankAssetSnapshotSchema` - Validates snapshot with entries
- `updateBankAssetEntrySchema` - Validates balance update
- `deleteSnapshotSchema`, `deleteEntrySchema` - Delete validations
- `getSnapshotsSchema` - Query filters (calendar year, date range)
- `getSnapshotByIdSchema`, `getBankAccountsSchema` - Get validations
- `updateBankAccountSchema` - Validates account name update (Phase 6)

### Controllers
**Location**: `src/server/controllers/bank-asset.controller.ts`

Handlers for all tRPC procedures with business logic layer between router and service.

## Server Actions (Phase 6)

**Location**: `src/app/(authorized)/assets/bank/actions.ts`

- `updateAccountName()` - Server action to update account name
  - Validates session and input
  - Calls service layer
  - Revalidates `/assets/bank` path on success
  - Returns typed response with success/error

## Client Components

### Main Page Component
**Location**: `src/app/(authorized)/assets/bank/page.tsx`

- Server Component wrapper
- Handles authentication, initial data loading, SSR metadata
- Passes session user ID to client component
- Resolves calendar years and initial filters
- Suspense boundary with fallback

### Client Component
**Location**: `src/app/(authorized)/assets/bank/BankAssetsClient.tsx`

Main client orchestrator handling:
- Calendar type selector (FISCAL/ANNUAL/ZAKAT tabs)
- Calendar year dropdown
- Snapshot display and selection
- Grand total summary card
- Bank accordion rendering
- Modal management
- Query invalidation on mutations
- Loading states and error handling

### New Snapshot Modal
**Location**: `src/app/(authorized)/assets/bank/NewSnapshotModal.tsx`

Modal form for creating/editing snapshots:
- Date picker (defaults to today)
- Bank selector dropdown
- Account selector with CreatableSelect (allows new account creation)
- Balance input field
- Add account row button
- Save/Cancel actions
- Pre-fill logic from most recent snapshot
- Form state management with formData state

### Sub-components
**Location**: `src/app/(authorized)/assets/bank/_components/`

- `BankAccordion.tsx` - Accordion display logic
- `AccountRow.tsx` - Individual account row with edit/delete actions
- `SummaryCard.tsx` - Grand total and bank-level summary display
- Other support components for layout, modals, etc.

## Phase Completion Status

| Phase | Status | Completion | Notes |
|-------|--------|-----------|-------|
| **Phase 1: Database & API** | ✅ Complete | 100% | All tRPC endpoints operational, schemas validated |
| **Phase 2: Basic UI - Display** | ✅ Complete | 100% | Calendar selectors (FISCAL/ANNUAL), snapshot display |
| **Phase 3: Snapshot Creation** | ✅ Complete | 100% | Modal form, pre-fill, CreatableSelect accounts |
| **Phase 4: Edit & Delete** | ✅ Complete | 100% | Edit balance, delete entry, delete snapshot |
| **Phase 5: Polish & Testing** | ✅ Complete | 100% | Query invalidation, loading states, error handling |
| **Phase 6: Account Management** | ⏳ Partial | ~50% | Service & server action exist; NOT wired to UI/tRPC |

## Phase 6 Status (Account Rename)

**What's Done**:
- ✅ `updateBankAccount()` service method with uniqueness validation
- ✅ `updateBankAccountSchema` input validation
- ✅ `updateAccountName()` server action in `actions.ts`
- ✅ Route handler pattern established

**What's NOT Done**:
- ❌ No tRPC procedure for account rename (would allow UI to call via tRPC)
- ❌ UI edit icon/modal not implemented
- ❌ No inline edit mode or form in AccountRow component
- ❌ Query invalidation for account updates not wired
- ❌ No integration test coverage

## Known Fixes & Corrections from Original PRD

1. **Model Names**: PRD used `BankAssetSnapshot`/`BankAssetEntry` → **actual**: `BankBalanceSnapshot`/`BankBalanceRecord`
2. **Route Path**: PRD mentioned `/cashflow/bank` → **actual**: `/assets/bank`
3. **Phase 6 Status**: PRD marked as "PENDING (0%)" → **actual**: Partially done (~50%) - service exists, needs UI/tRPC wiring
4. **Type Naming**: Types still use `BankAssetEntry*` naming for backward compatibility with service layer
