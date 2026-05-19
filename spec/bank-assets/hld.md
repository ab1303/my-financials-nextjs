# Bank Assets Cash Tracking - High-Level Design

## 1. Feature Overview & Goals

### 1.1 Product Summary

The Bank Assets feature enables authenticated users to track cash holdings across multiple bank accounts by taking point-in-time snapshots. Each snapshot captures the financial position on a specific date, organized by bank and account. Users can view their cash position through different calendar year lenses (Fiscal, Annual, Zakat) to align with financial planning and compliance needs.

**Key Capabilities**:
1. **Snapshot Management** - Create, edit, and delete cash position snapshots with date tracking
2. **Multi-Account Support** - Track multiple accounts per bank using CreatableSelect for dynamic account creation
3. **Calendar Year Views** - Filter snapshots by Fiscal, Annual, or Zakat year types for different reporting needs
4. **Accordion Display** - Collapsible bank sections with summary totals in headers, individual account balances when expanded
5. **Historical Retention** - All snapshots preserved for trend analysis and dashboard/reporting analytics

### 1.2 Business Goals

- Provide comprehensive asset tracking to complement existing cashflow features (Income, Expenses, Donations)
- Enable users to monitor cash position trends over time for financial health assessment
- Support multiple calendar year views for tax planning, zakat calculation, and annual reviews
- Enhance dashboard and reporting capabilities with historical cash position data
- Maintain consistent UX patterns across all financial tracking features

### 1.3 User Goals

- Record cash balances across all bank accounts in a single, organized interface
- Take snapshots on-demand without re-entering all account information each time
- View cash position summaries at bank level and overall total at a glance
- Analyze cash position through different calendar year perspectives
- Maintain historical records for tracking wealth growth or decline over time

### 1.4 Non-Goals

- Real-time bank account synchronization or API integration with financial institutions
- Automatic balance updates or transaction importing
- Investment tracking (stocks, bonds, property) - cash-only
- Multi-currency support (AUD only)
- Interest calculations or projections
- Loan or liability tracking
- Budget recommendations based on cash position

## 2. Data Model

### 2.1 Core Entities

**User** (from NextAuth)
- Primary entity - all data scoped to authenticated user
- Fields: id, email, name, timezone, fiscalYearType (preference)

**Business** (existing)
- Represents banks configured by user
- Enum: type = BANK | PHILANTHROPY | BROKERAGE
- Fields: id, name, type, userId

**BankAccount** (bank-account level)
- Represents an account within a bank
- Relation: belongs to Business (bank) + User
- Fields: id, name, bankId, userId
- Uniqueness: [name, bankId, userId] - account names unique per bank per user

**BankBalanceSnapshot** (snapshot point-in-time)
- Captures user's cash position on a specific date
- Relation: belongs to User
- Fields: id, snapshotDate, userId
- Contains multiple BankBalanceRecord entries (one per account)
- Index: [userId, snapshotDate] for efficient date-range queries

**BankBalanceRecord** (balance entry in snapshot)
- Individual account's balance within a snapshot
- Relation: links Snapshot + Account + balance amount
- Fields: id, balance (Decimal), accountId, snapshotId
- Uniqueness: [accountId, snapshotId] - one record per account per snapshot
- Optional: importImage (for future import workflows)

### 2.2 Relationships

```
User (1) ──→ (many) BankBalanceSnapshot
User (1) ──→ (many) BankAccount

BankBalanceSnapshot (1) ──→ (many) BankBalanceRecord
BankBalanceRecord (many) ──→ (1) BankAccount

Business (1) ──→ (many) BankAccount
BankAccount (1) ──→ (many) BankBalanceRecord
```

### 2.3 Data Flow for Snapshot Creation

```
User Input (Modal Form)
  ↓
Form Data: {snapshotDate, entries[{accountId, balance}]}
  ↓
tRPC Mutation: createSnapshot()
  ↓
Service: createBankAssetSnapshot(userId, snapshotDate, entries)
  ↓
Database Transaction:
  1. Verify all accounts belong to user
  2. Create BankBalanceSnapshot record
  3. Create BankBalanceRecord entries
  ↓
Response: Complete snapshot with entries
  ↓
Client: Invalidate snapshots query, show new snapshot
```

## 3. Architecture

### 3.1 Technology Stack

- **Framework**: Next.js 16 with App Router
- **Server**: tRPC for type-safe APIs, Server Components for data fetching
- **Client**: React 19 with React Query (tRPC hooks)
- **ORM**: Prisma for database operations
- **Auth**: NextAuth v5 beta for session management
- **UI**: Tailwind CSS + Flowbite components, react-icons for icons
- **Forms**: react-hook-form for form state, Zod for validation, CreatableSelect for account selection

### 3.2 Component Architecture

**Server Component Boundary** (`page.tsx`)
- Fetches user session
- Resolves calendar years and filters
- Passes initial data to client
- Provides Suspense boundary

**Client Component** (`BankAssetsClient.tsx`)
- Manages all interactive state (calendar selection, snapshots, modals)
- Uses tRPC queries for data fetching
- Uses tRPC mutations for CRUD operations
- Handles query invalidation after mutations

**Modal Pattern** (`NewSnapshotModal.tsx`)
- Child component managed by parent client component
- Receives snapshot data and callbacks as props
- Pre-fills from most recent snapshot on open
- Handles form submission and validation

**Accordion Sub-Components** (`_components/`)
- Stateless display components receiving data as props
- `BankAccordion` - accordion container
- `AccountRow` - individual account display with edit/delete actions
- `SummaryCard` - totals display

### 3.3 Server-Client Boundary

```
┌─ Server (page.tsx)
│  ├─ Fetch user session
│  ├─ Resolve calendar years
│  └─ Pass props to client
│
└─ Client (BankAssetsClient.tsx)
   ├─ Calendar selection UI
   ├─ Snapshot display
   ├─ tRPC queries: getSnapshots, getSnapshotById
   ├─ tRPC mutations: createSnapshot, updateEntry, deleteEntry
   └─ Modals & Sub-components
       └─ NewSnapshotModal (form handling)
```

### 3.4 Data Flow Patterns

**Display Flow**:
1. Server loads initial calendar years
2. Client mounts, selects default calendar year
3. tRPC query: `getSnapshots(filters)` returns snapshot list
4. Client renders most recent snapshot with accordion
5. User can expand accordion to see account details

**Mutation Flow**:
1. User submits form (create/edit/delete)
2. tRPC mutation called with validated input
3. Server processes in transaction (Prisma)
4. Server returns updated data or error
5. React Query auto-updates cache (optimistic if using useOptimistic)
6. Manual invalidation via `trpc.useUtils().bankAsset.getSnapshots.invalidate()`
7. Refetch triggers, UI updates

**Calendar Filter Flow**:
1. User selects calendar type (FISCAL/ANNUAL/ZAKAT)
2. Client updates URL searchParams: `?type=FISCAL&yearId=xyz`
3. Server re-resolves calendar years for that type
4. Client triggers snapshot query with new filters
5. Snapshots within date range returned and displayed

## 4. Key Flows & Interactions

### 4.1 Create Snapshot

```
"New Snapshot" button click
  ↓
Modal opens → Pre-fill from most recent snapshot
  ↓
User enters/modifies data:
  - Date (defaults today)
  - Banks and accounts (CreatableSelect allows new account creation)
  - Balances
  ↓
Click "Save"
  ↓
Validation: date, accounts, balances required
  ↓
tRPC: bankAsset.createSnapshot({snapshotDate, entries})
  ↓
Server-side validation & transaction
  ↓
Success: 
  - Invalidate snapshots query
  - Modal closes
  - Page re-fetches
  - New snapshot displayed
```

### 4.2 Edit Account Balance

```
User clicks edit icon on account row
  ↓
Modal/inline editor opens with current balance
  ↓
User modifies balance
  ↓
Click "Save"
  ↓
tRPC: bankAsset.updateEntry({entryId, balance})
  ↓
Server validates ownership & updates BankBalanceRecord
  ↓
Success:
  - Invalidate snapshot query
  - Totals recalculated
  - UI updates
```

### 4.3 Delete Account Entry

```
User clicks delete icon on account row
  ↓
Confirmation dialog: "Delete [Account] from snapshot?"
  ↓
Confirm:
  ↓
tRPC: bankAsset.deleteEntry({entryId})
  ↓
Server verifies user ownership & deletes BankBalanceRecord
  ↓
Success:
  - Invalidate snapshot query
  - Entry removed from accordion
  - Totals recalculated
```

### 4.4 Filter by Calendar Year (Phase 2/3)

```
User selects calendar type (FISCAL/ANNUAL) & year
  ↓
URL updates: ?type=FISCAL&yearId=xyz
  ↓
tRPC: getSnapshots({calendarYearId, ...filters})
  ↓
Service filters snapshots: fromDate ≤ snapshotDate ≤ toDate
  ↓
Snapshots within range returned
  ↓
Most recent displayed by default
  ↓
Grand total calculated only from snapshots in range
```

### 4.5 Edit Account Name (Phase 6 - Partial)

```
User clicks pencil icon next to account name
  ↓
Inline edit mode activated
  ↓
User enters new name
  ↓
Server Action: updateAccountName({accountId, name})
  ↓
Server validates:
  - User owns account
  - New name unique within bank + user
  ↓
Success:
  - Account name updated in BankAccount model
  - Name change visible across all snapshots (shared model)
  - Page revalidated
  
Note: This flow NOT YET WIRED to UI in implementation
```

## 5. Implementation Status

### 5.1 Phase Completion

| Phase | Status | Details |
|-------|--------|---------|
| **1: Database & API** | ✅ 100% | All tRPC endpoints operational, schemas validated, service methods complete |
| **2: Basic UI - Display** | ✅ 100% | Calendar selectors, snapshot display, accordion, grand total |
| **3: Snapshot Creation** | ✅ 100% | Modal, pre-fill, CreatableSelect, validation, persistence |
| **4: Edit & Delete** | ✅ 100% | Edit balance, delete entry, delete snapshot, confirmations |
| **5: Polish & Testing** | ✅ 100% | Query invalidation, loading states, error handling, React Query lifecycle |
| **6: Account Management** | ⏳ 50% | Service & server action exist; NOT wired to UI/tRPC |

### 5.2 Phase 6 Work In Progress

**Completed Work**:
- ✅ `updateBankAccount()` service with uniqueness validation
- ✅ `updateAccountName()` server action
- ✅ Input schema for account rename validation
- ✅ Server-side error handling and response types

**Remaining Work**:
- 🔲 Create tRPC procedure: `bankAssetRouter.updateAccount()`
- 🔲 UI component: Edit icon & inline editor for account name
- 🔲 Form handling: Account name input validation & submission
- 🔲 Query invalidation: Wire account update to cache refresh
- 🔲 Error boundary: Handle duplicate name errors gracefully
- 🔲 Integration tests: E2E test for rename flow

## 6. Technical Decisions

### 6.1 Pre-fill Behavior

When user clicks "New Snapshot", the form pre-populates with:
- All banks and accounts from the most recent snapshot
- Previous balances for each account
- Snapshot date defaults to today (not previous snapshot date)

**Rationale**: Minimizes repetitive data entry since balances typically change incrementally.

### 6.2 Account Uniqueness

Account names must be unique within the same bank for each user: `UNIQUE[name, bankId, userId]`

**Rationale**: Allows same account name across different banks (e.g., "Savings"), but prevents duplicates within one bank.

### 6.3 Snapshot Immutability

Snapshot date is editable but represents a historical point-in-time. Changes cascade to all accounts within that snapshot.

**Rationale**: Provides flexibility for corrections but maintains data integrity via transaction.

### 6.4 Calendar Year Filtering

Snapshots filtered by calendar year type (Fiscal/Annual/Zakat) with date range: `fromDate ≤ snapshotDate ≤ toDate`

**Rationale**: Different users have different fiscal year starts (e.g., Fiscal may start July 1 for Australian FY). Separate views reduce confusion.

### 6.5 Account Name Updates

When a BankAccount name is edited, the change propagates to all snapshots (past and future) because the account record is shared.

**Rationale**: Ensures consistency—viewing historical snapshots always shows the current account name. Users can still access old names via audit logs if needed (future enhancement).

## 7. Known Issues & Fixes

### Issue 1: Loading State Never Clears (FIXED)
- **Problem**: Page showed "Loading bank assets..." indefinitely
- **Root Cause**: Checked array length instead of tRPC loading status
- **Fix**: Uses `isLoadingSnapshots` from query state

### Issue 2: Wrong Empty State Logic (FIXED)
- **Problem**: Showed "You need to add banks" even when banks were configured
- **Root Cause**: Checked snapshots instead of actual banks from Settings
- **Fix**: Query actual Banks from `business.getBusinessesByType`

### Issue 3: React Hook Invalid Call (FIXED)
- **Problem**: "Invalid hook call" in CreatableSelect `onCreateOption` callback
- **Root Cause**: Callback was async with `await`, violating Hooks rules
- **Fix**: Changed to promise-based `.then()/.catch()` pattern

### Issue 4: Snapshot Data Not Persisting (FIXED)
- **Problem**: Snapshot appeared to save but no data in database
- **Root Cause**: `window.location.reload()` refreshed page before query invalidation
- **Fix**: Replaced with tRPC query invalidation: `trpc.useUtils().bankAsset.getSnapshots.invalidate()`

## 8. Future Enhancements

- Snapshot comparison (side-by-side view of two snapshots with delta indicators)
- Bulk import from CSV/image file
- Export snapshots to PDF or accounting software
- Historical account name tracking (audit log)
- Zero-balance account handling policies
- Very large balance display formatting (billion+)
- Mobile-optimized calendar selectors
