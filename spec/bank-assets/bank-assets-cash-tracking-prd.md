# PRD: Bank Assets Cash Tracking

## Implementation Progress

**Current Status**: Phase 1 Complete ✅ | Phase 2 In Progress 🔄

| Phase                       | Status      | Completion |
| --------------------------- | ----------- | ---------- |
| Phase 1: Database & API     | ✅ Complete | 100%       |
| Phase 2: Basic UI - Display | 🔄 Next     | 0%         |
| Phase 3: Snapshot Creation  | ⏳ Pending  | 0%         |
| Phase 4: Edit & Delete      | ⏳ Pending  | 0%         |
| Phase 5: Polish & Testing   | ⏳ Pending  | 0%         |

**Last Updated**: 2026-01-31

---

## 1. Product overview

### 1.1 Document title and version

- PRD: Bank Assets Cash Tracking
- Version: 1.0

### 1.2 Product summary

This feature enables authenticated users to track cash holdings across multiple bank accounts by taking point-in-time snapshots. Users can record how much cash they have in various accounts (Savings, Term Deposits, Cheque accounts, etc.) within their pre-configured banks, with each snapshot capturing the financial position on a specific date.

The system retains historical snapshots for trend analysis and reporting, while always displaying the most recent snapshot by default. When creating a new snapshot, the form pre-fills with the most recent data to minimize repetitive data entry. Users can view their cash position through different calendar year lenses (Fiscal, Annual, or Zakat) to align with various financial planning and compliance needs.

The UI follows an accordion pattern where each bank is a collapsible section with a summary card in the header showing the bank's total cash position. Expanding a bank reveals its individual account balances. A grand total summary displays the aggregate cash position across all banks for the selected calendar year view.

Key capabilities:

1. **Snapshot Management**: Create, edit, and delete cash position snapshots with date tracking
2. **Multi-Account Support**: Track multiple accounts per bank using CreatableSelect for account management
3. **Calendar Year Views**: Filter snapshots by Fiscal, Annual, or Zakat year types
4. **Accordion Display**: Collapsible bank sections with summary totals in headers
5. **Historical Retention**: All snapshots preserved for dashboard/reporting analytics

## 2. Goals

### 2.1 Business goals

- Provide comprehensive asset tracking to complement existing cashflow features (Income, Expenses, Donations)
- Enable users to monitor cash position trends over time for financial health assessment
- Support multiple calendar year views for tax planning, zakat calculation, and annual reviews
- Enhance dashboard and reporting capabilities with historical cash position data
- Maintain consistent UX patterns across all financial tracking features

### 2.2 User goals

- Record cash balances across all bank accounts in a single, organized interface
- Take snapshots on-demand without re-entering all account information each time
- View cash position summaries at bank level and overall total at a glance
- Analyze cash position through different calendar year perspectives
- Maintain historical records for tracking wealth growth or decline over time
- Quickly identify which banks and accounts hold the most cash

### 2.3 Non-goals

- Real-time bank account synchronization or API integration with financial institutions
- Automatic balance updates or transaction importing
- Investment tracking (stocks, bonds, property) - this is cash-only
- Multi-currency support (AUD only in initial version)
- Interest calculations or projections
- Loan or liability tracking
- Budget recommendations based on cash position
- Export to external accounting software (future enhancement)
- Shared/joint account management across users

## 3. User personas

### 3.1 Key user types

- Authenticated individual users who want to track their cash holdings across multiple bank accounts for financial planning, tax preparation, or religious obligations (Zakat)

### 3.2 Basic persona details

- **Wealth tracker**: A user who maintains accounts across multiple banks and wants a consolidated view of their total cash position without logging into each bank separately
- **Zakat calculator**: A user who needs to know their cash assets on specific dates for accurate Zakat liability calculations
- **Financial planner**: A user who takes periodic snapshots (monthly, quarterly) to monitor cash flow trends and ensure they're meeting savings goals
- **Tax preparer**: A user who needs fiscal year-end cash position summaries for tax documentation and planning

### 3.3 Role-based access

- **Authenticated user**: Can create, view, edit, and delete their own bank asset snapshots. All data is strictly scoped to the authenticated user - users cannot see or modify records of other users.

## 4. Functional requirements

### 4.1 Bank assets page display (Priority: High)

- **Calendar year type selector** (Priority: High)
  - Toggle/tabs at top of page to switch between: FISCAL, ANNUAL, ZAKAT views
  - Default to FISCAL on initial page load
  - Changing view filters the displayed data to show snapshots within that calendar period
  - Display format shows the year range (e.g., "Fiscal 2025-2026", "Annual 2025", "Zakat 2025-2026")

- **Calendar year dropdown** (Priority: High)
  - Dropdown to select specific year within the chosen calendar type
  - Populated from CalendarYear model filtered by selected type
  - Defaults to current/most recent calendar year
  - Changing selection reloads snapshot data for that period

- **Snapshot date display** (Priority: High)
  - Display the date of the most recent snapshot being shown
  - Format: "Snapshot as of: DD MMM YYYY" (e.g., "Snapshot as of: 01 Feb 2026")
  - If no snapshot exists for selected period, display: "No snapshot recorded"

- **Grand total summary card** (Priority: High)
  - Prominently displayed card showing total cash across all banks
  - Format: "Total Cash Position: $XX,XXX.XX"
  - Updates dynamically when calendar year selection changes
  - Shows $0.00 if no snapshot exists

### 4.2 Bank accordion display (Priority: High)

- **Accordion structure** (Priority: High)
  - Each bank configured by the user appears as an accordion section
  - Banks sorted alphabetically by name
  - Only banks with at least one account in the snapshot are displayed
  - Empty state: "No bank accounts recorded. Click 'New Snapshot' to add your first entry."

- **Accordion header (collapsed state)** (Priority: High)
  - Display: Bank name (left-aligned)
  - Display: Bank total (right-aligned) - sum of all accounts in that bank
  - Chevron icon indicating expand/collapse state
  - Click anywhere on header to toggle expansion

- **Accordion body (expanded state)** (Priority: High)
  - Table displaying accounts within the bank
  - Columns: Account Name, Balance, Actions (Edit/Delete icons)
  - Accounts sorted alphabetically by name
  - Action icons follow existing patterns (react-icons)
  - Edit opens inline edit mode or modal
  - Delete shows confirmation dialog before removing

### 4.3 Snapshot creation (Priority: High)

- **New snapshot button** (Priority: High)
  - Button positioned at top of page: "New Snapshot" or "+ Take Snapshot"
  - Opens snapshot creation modal/drawer

- **Snapshot form** (Priority: High)
  - **Snapshot Date**: Date picker, defaults to today, required
  - **Bank Selection**: Dropdown populated from user's configured banks (Business model, type=BANK)
  - **Account Selection**: CreatableSelect allowing selection of existing accounts or creation of new ones
  - **Balance**: Numeric input with currency formatting, required, must be >= 0
  - **Add Account Row**: Button to add another account entry to the same snapshot
  - Multiple banks can be added in a single snapshot session

- **Pre-fill behavior** (Priority: High)
  - When opening "New Snapshot", pre-populate with most recent snapshot data
  - All banks and accounts from last snapshot appear with their previous balances
  - User can modify balances, add new accounts, or remove accounts
  - Date defaults to today (not the previous snapshot date)

- **Account persistence** (Priority: High)
  - New accounts created via CreatableSelect are saved to BankAccount model
  - Accounts are scoped to user and linked to specific bank
  - Previously created accounts appear in dropdown for future snapshots
  - Account names must be unique within a bank for the same user

- **Save snapshot** (Priority: High)
  - Validates all required fields
  - Creates BankAssetSnapshot record with snapshot date
  - Creates BankAssetEntry records for each account balance
  - Success: Toast notification, modal closes, page refreshes to show new snapshot
  - Error: Display validation errors inline

### 4.4 Snapshot editing (Priority: Medium)

- **Edit account balance** (Priority: Medium)
  - Click edit icon on account row
  - Opens inline edit or modal with pre-filled balance
  - Save updates the BankAssetEntry record
  - Cancel reverts to original value

- **Edit snapshot date** (Priority: Medium)
  - Option to modify the snapshot date (with confirmation if historical)
  - Updates BankAssetSnapshot record

- **Add account to existing snapshot** (Priority: Medium)
  - Button within expanded accordion to add new account
  - Uses CreatableSelect for account selection
  - Creates new BankAssetEntry linked to existing snapshot

### 4.5 Snapshot deletion (Priority: Medium)

- **Delete account entry** (Priority: Medium)
  - Delete icon on each account row
  - Confirmation dialog: "Are you sure you want to delete [Account Name] from this snapshot?"
  - Removes BankAssetEntry record
  - Updates bank and grand totals

- **Delete bank from snapshot** (Priority: Low)
  - Option in accordion header menu to remove entire bank
  - Confirmation: "This will remove all [X] accounts for [Bank Name] from this snapshot. Continue?"
  - Removes all BankAssetEntry records for that bank in the snapshot

- **Delete entire snapshot** (Priority: Low)
  - Button/option to delete the entire snapshot
  - Confirmation: "This will permanently delete the snapshot from [Date] with [X] banks and [Y] accounts. This cannot be undone."
  - Removes BankAssetSnapshot and all related BankAssetEntry records
  - Page refreshes to show previous snapshot (if exists)

### 4.6 Historical snapshot access (Priority: Medium)

- **Snapshot history dropdown** (Priority: Medium)
  - Secondary dropdown or date picker showing all snapshots within selected calendar year
  - Allows viewing historical snapshots (read-only or editable based on UX decision)
  - Most recent snapshot selected by default

- **Snapshot comparison** (Priority: Low - Future)
  - Ability to compare two snapshots side-by-side
  - Show changes (increase/decrease) per account and bank
  - Visual indicators (green for increase, red for decrease)

## 5. User experience

### 5.1 Entry points & first-time user flow

- **Navigation**: Assets → Bank(s) in sidebar (already exists, update route)
- **First visit**: Empty state with clear CTA - "Track your cash across bank accounts. Take your first snapshot."
- **Prerequisite check**: If user has no banks configured, prompt: "You need to add banks first. Go to Settings → Banks."
- **First snapshot**: Guided experience with clear labels and tooltips

### 5.2 Core experience

- **Step 1: Select view**: User chooses calendar year type (Fiscal/Annual/Zakat) and specific year
- **Step 2: View snapshot**: Most recent snapshot displays with accordion of banks and grand total
- **Step 3: Take new snapshot**: Click "New Snapshot", form pre-fills with last data, user updates balances
- **Step 4: Save and review**: Snapshot saves, totals update, user sees current position

### 5.3 Advanced features & edge cases

- **No banks configured**: Display message with link to Settings → Banks
- **Bank deleted**: If a bank is deleted from Settings, historical snapshots retain the data but bank name shows "(Deleted)"
- **Account renamed**: If account is renamed, historical entries retain old name, new snapshots use new name
- **Zero balance**: Allow $0.00 entries (account exists but empty)
- **Very large balances**: Support up to 9 digits with 2 decimal places
- **Multiple snapshots same day**: Allow (user might correct a mistake)
- **Calendar year with no snapshots**: Display empty state, encourage new snapshot

### 5.4 UI/UX highlights

- **Accordion pattern**: Follows Headless UI Disclosure component pattern used elsewhere in app
- **Summary cards**: Consistent with existing card components in the codebase
- **Form controls**: react-select/CreatableSelect, NumericFormat for currency
- **Icons**: react-icons library (FiEdit2, FiTrash2, FiChevronDown, FiPlus)
- **Loading states**: Suspense fallbacks while fetching data
- **Responsive design**: Accordion works on mobile, table scrolls horizontally if needed
- **Toast notifications**: Success/error feedback using react-toastify (existing pattern)

## 6. Narrative

Sarah opens her financial tracking app on the first of each month to record her cash position. She navigates to Assets → Banks and sees her previous snapshot from last month. The accordion view shows her three banks - ANZ, CBA, and Westpac - each with a summary total in the header. The grand total at the top shows $47,500.

She clicks "New Snapshot" and the form opens pre-filled with all her accounts and their previous balances. She updates her ANZ Savings from $12,000 to $13,500 (nice, her salary went in), adjusts her CBA Term Deposit to $25,000, and adds a new "Emergency Fund" account at Westpac with $5,000. She saves the snapshot and the page updates immediately - her new total is $53,500. She notices the date shows "Snapshot as of: 01 Feb 2026" confirming her entry was recorded.

Later that month, Sarah needs to calculate her Zakat. She switches the calendar view from Fiscal to Zakat, and the system shows her cash position filtered to the Zakat year range. She can now see exactly what her cash holdings were during the relevant period for her calculations.

## 7. Success metrics

### 7.1 User-centric metrics

- Number of users actively taking snapshots (monthly active users)
- Average number of banks/accounts tracked per user
- Frequency of snapshot creation (daily, weekly, monthly patterns)
- Time to complete a new snapshot (target: < 2 minutes with pre-fill)
- Feature adoption rate among existing users

### 7.2 Business metrics

- Increased overall app engagement/retention
- Users who track bank assets more likely to use other features (Zakat, Income, Expenses)
- Reduced user drop-off during financial planning workflows

### 7.3 Technical metrics

- Page load time for bank assets page (target: < 2 seconds)
- Snapshot save operation time (target: < 500ms)
- Error rate for CRUD operations (target: < 1%)
- Database query performance for snapshot retrieval with aggregations

## 8. Technical considerations

### 8.1 Integration points

- **Authentication**: NextAuth session for user scoping (existing pattern)
- **Bank data**: Business model (type=BANK) for bank dropdown
- **Calendar years**: CalendarYear model for year filtering (existing)
- **tRPC**: API routes for CRUD operations
- **Database**: Prisma ORM with PostgreSQL

### 8.2 Data storage & privacy

- All snapshot data scoped to authenticated user via userId foreign key
- No cross-user data access possible at query level
- Soft-delete consideration for audit trail (or hard delete per existing patterns)
- Decimal precision for money fields (@db.Money)

### 8.3 Scalability & performance

- Index on userId + snapshotDate for efficient queries
- Aggregate queries for totals (SUM by bank, SUM overall)
- Consider pagination if user has many historical snapshots
- Optimistic UI updates for better perceived performance

### 8.4 Potential challenges

- **Pre-fill complexity**: Efficiently loading and transforming previous snapshot into form state
- **CreatableSelect persistence**: Ensuring new accounts are created before snapshot entries reference them
- **Calendar year filtering**: Snapshots span dates, need to correctly filter by calendar year boundaries
- **Concurrent editing**: If user has multiple tabs open, ensure data consistency
- **Bank deletion cascade**: Decide whether to cascade delete or preserve historical data

## 9. Milestones & sequencing

### 9.1 Project estimate

- Medium: 2-3 weeks for complete implementation including testing

### 9.2 Team size & composition

- 1 Full-stack developer familiar with Next.js, tRPC, Prisma, and existing codebase patterns

### 9.3 Suggested phases

<<<<<<< Updated upstream

- **Phase 1: Database & API** (3-4 days)
  - Create Prisma models (BankAccount, BankAssetSnapshot, BankAssetEntry)
  - Run migrations
  - Implement tRPC routers for CRUD operations
  - Add server controllers and handlers

- # **Phase 2: Basic UI - Display** (3-4 days)
- **Phase 1: Database & API** (3-4 days) ✅ **COMPLETED**
  - ✅ Create Prisma models (BankAccount, BankAssetSnapshot, BankAssetEntry)
  - ⏳ Run migrations (Ready - requires PowerShell 6+, see `spec/bank-assets-migration-instructions.md`)
  - ✅ Implement tRPC routers for CRUD operations
  - ✅ Add server controllers and handlers
  - ✅ Created comprehensive service layer with user-scoped queries
  - ✅ Implemented security checks ensuring data isolation

  **Files Created:**
  - `src/server/schema/bank-asset.schema.ts` - Zod schemas for validation
  - `src/server/services/bank-asset.service.ts` - Database service layer
  - `src/server/controllers/bank-asset.controller.ts` - Request handlers
  - `src/server/trpc/router/bank-asset.ts` - tRPC router
  - `scripts/migrate-bank-assets.ps1` - Migration helper script
  - `spec/bank-assets-migration-instructions.md` - Migration guide

  **Files Modified:**
  - `prisma/schema.prisma` - Added BankAccount, BankAssetSnapshot, BankAssetEntry models
  - `src/server/trpc/router/_app.ts` - Registered bankAsset router

- **Phase 2: Basic UI - Display** (3-4 days) 🔄 **NEXT**

  > > > > > > > Stashed changes
  - Create page structure with calendar year selectors
  - Implement accordion component with bank summaries
  - Display account tables within accordions
  - Add grand total summary card
  - Implement Suspense loading states

- **Phase 3: Snapshot Creation** (3-4 days)
  - Build snapshot creation modal/form
  - Implement CreatableSelect for account management
  - Add pre-fill logic from previous snapshot
  - Handle multi-account, multi-bank entry
  - Implement save with Server Actions

- **Phase 4: Edit & Delete** (2-3 days)
  - Add edit functionality for account balances
  - Implement delete with confirmation dialogs
  - Add optimistic UI updates
  - Handle edge cases (last account in bank, etc.)

- **Phase 5: Polish & Testing** (2-3 days)
  - Historical snapshot viewing
  - Error handling and validation refinement
  - Responsive design adjustments
  - Unit and integration tests
  - Build verification and bug fixes

## 10. User stories

### 10.1 View bank assets page with calendar year filter

- **ID**: BA-001
- **Description**: As an authenticated user, I want to view my bank assets page with a calendar year type selector and year dropdown, so that I can see my cash position for different financial periods.
- **Acceptance criteria**:
  - Page displays toggle/tabs for FISCAL, ANNUAL, ZAKAT calendar types
  - Default selection is FISCAL on initial load
  - Dropdown shows available years for selected calendar type
  - Changing calendar type updates the year dropdown options
  - Changing year reloads snapshot data for that period
  - Page shows "No snapshot recorded" if no data exists for selected period

### 10.2 View most recent snapshot in accordion format

- **ID**: BA-002
- **Description**: As an authenticated user, I want to see my most recent snapshot displayed in an accordion format with bank summaries, so that I can quickly understand my cash position across all banks.
- **Acceptance criteria**:
  - Grand total summary card shows aggregate cash across all banks
  - Each bank appears as a collapsible accordion section
  - Accordion header shows bank name and bank total
  - Clicking header expands/collapses the section
  - Expanded section shows table of accounts with balances
  - Snapshot date is displayed (e.g., "Snapshot as of: 01 Feb 2026")
  - Banks are sorted alphabetically
  - Only user's own data is visible (not other users' data)

### 10.3 Create new snapshot with pre-fill

- **ID**: BA-003
- **Description**: As an authenticated user, I want to create a new snapshot that pre-fills with my most recent data, so that I don't have to re-enter all my account information each time.
- **Acceptance criteria**:
  - "New Snapshot" button is visible at top of page
  - Clicking button opens snapshot creation form/modal
  - Form pre-fills with all banks, accounts, and balances from most recent snapshot
  - Snapshot date field defaults to today's date
  - User can modify any balance value
  - User can add new accounts or banks
  - User can remove accounts from the snapshot
  - If no previous snapshot exists, form opens empty

### 10.4 Add bank account using CreatableSelect

- **ID**: BA-004
- **Description**: As an authenticated user, I want to add bank accounts using a searchable dropdown that allows me to select existing accounts or create new ones, so that I can efficiently manage my account list.
- **Acceptance criteria**:
  - Account dropdown uses CreatableSelect component
  - Dropdown shows previously created accounts for the selected bank
  - User can type to search/filter existing accounts
  - User can create a new account by typing a name and selecting "Create..."
  - New accounts are persisted to database for future use
  - Account names must be unique within a bank for the user
  - Validation error shown if duplicate account name entered

### 10.5 Save snapshot with multiple accounts

- **ID**: BA-005
- **Description**: As an authenticated user, I want to save a snapshot containing multiple accounts across multiple banks in a single action, so that I can efficiently record my complete cash position.
- **Acceptance criteria**:
  - Form supports adding multiple account entries
  - Each entry requires: Bank (dropdown), Account (CreatableSelect), Balance (numeric)
  - "Add Account" button adds another entry row
  - All entries are validated before save (no empty required fields)
  - Single save action creates/updates all records
  - Success toast notification displayed on save
  - Page refreshes to show new snapshot data
  - Totals update to reflect new snapshot

### 10.6 Edit account balance in snapshot

- **ID**: BA-006
- **Description**: As an authenticated user, I want to edit an account balance in my snapshot, so that I can correct mistakes or update values.
- **Acceptance criteria**:
  - Edit icon visible on each account row in expanded accordion
  - Clicking edit icon enables inline editing or opens edit modal
  - Balance field is pre-filled with current value
  - User can modify and save the new balance
  - Cancel option reverts to original value without saving
  - Success toast shown on save
  - Bank total and grand total update automatically

### 10.7 Delete account entry from snapshot

- **ID**: BA-007
- **Description**: As an authenticated user, I want to delete an account entry from my snapshot, so that I can remove accounts I no longer want to track.
- **Acceptance criteria**:
  - Delete icon visible on each account row
  - Clicking delete shows confirmation dialog
  - Confirmation message includes account name
  - Confirming deletes the entry
  - Canceling closes dialog without deleting
  - Bank total and grand total update after deletion
  - Success toast notification displayed
  - If last account in bank is deleted, bank section is removed from accordion

### 10.8 View historical snapshots

- **ID**: BA-008
- **Description**: As an authenticated user, I want to view historical snapshots within a calendar year, so that I can see how my cash position has changed over time.
- **Acceptance criteria**:
  - Dropdown or date picker shows all snapshot dates within selected calendar year
  - Most recent snapshot is selected by default
  - Selecting a different date loads that snapshot's data
  - Historical snapshot displays in same accordion format
  - User can edit or delete entries in historical snapshots
  - Clear indication of which snapshot date is being viewed

### 10.9 Empty state handling

- **ID**: BA-009
- **Description**: As an authenticated user, I want to see helpful guidance when I have no snapshots or no banks configured, so that I understand how to get started.
- **Acceptance criteria**:
  - If no banks configured: Display message "You need to add banks first" with link to Settings → Banks
  - If banks exist but no snapshots: Display "No snapshots recorded. Take your first snapshot to start tracking."
  - "New Snapshot" button prominently displayed in empty state
  - Empty state uses consistent styling with other empty states in app

### 10.10 Delete entire snapshot

- **ID**: BA-010
- **Description**: As an authenticated user, I want to delete an entire snapshot, so that I can remove erroneous or duplicate entries.
- **Acceptance criteria**:
  - Delete snapshot option available (button or menu item)
  - Confirmation dialog shows snapshot date and count of banks/accounts
  - Warning that action cannot be undone
  - Confirming deletes snapshot and all related entries
  - Page refreshes to show previous snapshot (or empty state)
  - Success toast notification displayed

### 10.11 Authentication and data isolation

- **ID**: BA-011
- **Description**: As an authenticated user, I want my bank asset data to be completely private and isolated from other users, so that my financial information remains secure.
- **Acceptance criteria**:
  - All database queries filter by authenticated user's ID
  - User cannot see, access, or modify other users' snapshots
  - User cannot see other users' bank accounts in dropdowns
  - API endpoints validate user ownership before any CRUD operation
  - Unauthenticated requests are rejected with appropriate error

### 10.12 Responsive accordion display

- **ID**: BA-012
- **Description**: As an authenticated user, I want the bank assets page to work well on mobile devices, so that I can check my cash position on the go.
- **Acceptance criteria**:
  - Accordion expands and collapses correctly on touch devices
  - Summary card and totals are readable on small screens
  - Account table scrolls horizontally if needed on narrow screens
  - New snapshot form is usable on mobile
  - Touch targets (buttons, icons) are appropriately sized

---

## Database Schema (Proposed)

```prisma
// Bank Account (user's individual accounts within a bank)
model BankAccount {
  id        String   @id @default(cuid())
  name      String   // e.g., "Savings", "Term Deposit", "Everyday"
  bankId    String   // Reference to Business (type=BANK)
  bank      Business @relation(fields: [bankId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries   BankAssetEntry[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, bankId, userId]) // Unique account name per bank per user
  @@index([userId, bankId])
}

// Snapshot header (one per snapshot date)
model BankAssetSnapshot {
  id           String           @id @default(cuid())
  snapshotDate DateTime
  userId       String
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries      BankAssetEntry[]
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([userId, snapshotDate])
}

// Individual account balance entries within a snapshot
model BankAssetEntry {
  id         String            @id @default(cuid())
  balance    Decimal           @db.Money
  accountId  String
  account    BankAccount       @relation(fields: [accountId], references: [id])
  snapshotId String
  snapshot   BankAssetSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  createdAt  DateTime          @default(now())
  updatedAt  DateTime          @updatedAt

  @@unique([accountId, snapshotId]) // One entry per account per snapshot
  @@index([snapshotId])
}
```

---

**Note**: This PRD is ready for review. Once approved, I can proceed with creating GitHub issues for the user stories if desired.
