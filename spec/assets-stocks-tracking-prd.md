# PRD: Assets Stocks Tracking

## 1. Product overview

### 1.1 Document title and version

- PRD: Assets Stocks Tracking
- Version: 1.0

### 1.2 Product summary

This feature enables authenticated users to track stock holdings across multiple brokerage accounts (Commsec, Commbank Pocket, MooMoo, etc.) by taking point-in-time snapshots. Users can record stock purchases including ticker symbol, company name, quantity, buy price, purchase date, and investment term outlook. The system supports multi-currency holdings (AUD, USD) with separate totals per currency.

Each snapshot captures the user's stock portfolio position on a specific date within a fiscal year context. When creating a new snapshot, the form pre-fills with the most recent data to minimize repetitive data entry. Users can track both unrealized gains/losses (current holdings) and realized gains/losses (sold stocks), with automatic CGT discount eligibility calculation for holdings ≥12 months.

The UI follows an account-first accordion pattern where each brokerage account is a collapsible summary card showing the account's total portfolio value and P/L. Expanding an account reveals its individual stock holdings in a detailed table. Grand totals aggregate across all accounts, separated by currency.

Key capabilities:

1. **Snapshot Management**: Create, edit, and delete stock portfolio snapshots with date tracking
2. **Multi-Account Support**: Track stocks across multiple brokerage accounts (Business type=BROKERAGE)
3. **Multi-Currency Support**: Separate totals for AUD and USD holdings (no conversion)
4. **Investment Term Tracking**: Dual indicators - planned term (user's intent) vs actual holding period (calculated)
5. **Profit/Loss Calculation**: Unrealized P/L for current holdings, realized P/L for sold stocks
6. **CGT Discount Tracking**: Automatic flagging of holdings ≥12 months for 50% CGT discount eligibility
7. **Fiscal Year Views**: Filter snapshots by fiscal year for tax planning and annual reviews
8. **Historical Retention**: All snapshots preserved for trend analysis and reporting

## 2. Goals

### 2.1 Business goals

- Provide comprehensive stock portfolio tracking to complement existing asset features (Bank Cash, Income)
- Enable users to monitor portfolio performance and exposure across different brokerage accounts
- Support tax planning with CGT discount eligibility tracking and realized gains calculation
- Enhance dashboard and reporting capabilities with historical portfolio data
- Maintain consistent UX patterns across all financial tracking features

### 2.2 User goals

- Record stock purchases and sales across all brokerage accounts in a single interface
- Take snapshots on-demand without re-entering all holdings each time (prefill from previous)
- View portfolio summaries at account level and overall totals at a glance
- Track how stocks are performing against initial investment term expectations
- Calculate profit/loss for tax obligations and investment performance analysis
- Identify CGT discount eligibility based on holding periods
- Maintain historical records for tracking portfolio growth over time

### 2.3 Non-goals

- Real-time stock price feeds or API integration with market data providers (future enhancement)
- Automatic transaction importing from brokerage accounts
- Dividend tracking (separate feature, links to Income with source=STOCKS)
- Options, futures, or derivative instruments tracking
- Currency conversion or consolidated multi-currency totals
- Tax return generation or ATO integration
- Portfolio rebalancing recommendations
- Stock screener or research tools
- Social/shared portfolio features
- Integration with external portfolio management software
- Support for unauthenticated or guest users

## 3. User personas

### 3.1 Key user types

- Authenticated individual users who want to track their stock portfolio across multiple brokerage accounts for investment monitoring, tax planning, and performance analysis

### 3.2 Basic persona details

- **Retail investor**: A user who holds stocks across multiple brokerages (e.g., Commsec for ASX, MooMoo for US stocks) and wants a consolidated view of their total portfolio without logging into each platform
- **Tax-conscious investor**: A user who needs to track purchase dates, holding periods, and realized gains for accurate CGT calculation and discount eligibility
- **Long-term investor**: A user who sets investment horizons (short/mid/long term) for each purchase and wants to track whether their holdings are meeting those timeframe goals
- **Performance tracker**: A user who takes periodic snapshots to monitor how their portfolio value changes over time and identify winning/losing positions

### 3.3 Role-based access

- **Authenticated user**: Can create, view, edit, and delete their own stock snapshots. All data is strictly scoped to the authenticated user - users cannot see or modify records of other users.

## 4. Functional requirements

### 4.1 Stock assets page display (Priority: High)

- **Fiscal year selector** (Priority: High)
  - Dropdown at top of page to select fiscal year (CalendarYear type=FISCAL)
  - Populated from CalendarYear model filtered by FISCAL type
  - Defaults to current/most recent fiscal year
  - Display format: "Fiscal Year 2025-2026" (fromYear-toYear)
  - Changing selection reloads snapshot data for that period

- **Snapshot date selector** (Priority: High)
  - Secondary dropdown showing all snapshots within selected fiscal year
  - Displays snapshot dates in descending order (most recent first)
  - Defaults to most recent snapshot
  - Format: "DD MMM YYYY" (e.g., "01 Feb 2026")
  - If no snapshot exists: "No snapshots recorded"

- **Grand total summary cards** (Priority: High)
  - Summary cards at page top showing aggregate totals
  - Separate card per currency (AUD, USD)
  - Each card displays:
    - Total Portfolio Value: $XX,XXX.XX
    - Total Unrealized P/L: +$X,XXX.XX or -$X,XXX.XX (color coded green/red)
    - Total Realized P/L: +$X,XXX.XX or -$X,XXX.XX (color coded)
  - Cards show $0.00 if no snapshot exists

### 4.2 Account accordion display (Priority: High)

- **Accordion structure** (Priority: High)
  - Each brokerage account (Business type=BROKERAGE) appears as an expandable accordion section
  - Accounts sorted alphabetically by name
  - Only accounts with holdings in the current snapshot are displayed
  - Empty state: "No stock holdings recorded. Click 'New Snapshot' to add your first entry."

- **Accordion header (collapsed state)** (Priority: High)
  - Display: Account name (left-aligned, e.g., "Commsec", "MooMoo")
  - Display: Account currency badge (AUD/USD)
  - Display: Total value (right-aligned) - sum of all holdings in that account
  - Display: Account P/L summary (+$X,XXX or -$X,XXX, color coded)
  - Chevron icon indicating expand/collapse state
  - Click anywhere on header to toggle expansion

- **Accordion body (expanded state)** (Priority: High)
  - Table displaying stock holdings within the account
  - Columns:
    - Stock (Ticker + Company Name)
    - Qty (Quantity held)
    - Buy Price (per share)
    - Buy Date
    - Current Price (Manual)
    - Market Value (Qty × Current Price, calculated)
    - P/L (Market Value - Cost Basis, calculated)
    - P/L % (percentage gain/loss)
    - Planned Term (SHORT/MID/LONG badge)
    - Actual Holding (calculated from buy date, e.g., "8 months")
    - Sale Price (if sold, otherwise "-")
    - Sale Date (if sold, otherwise "-")
    - CGT Eligible (checkmark if ≥12 months at sale)
    - Actions (Edit/Delete icons)
  - Holdings sorted by ticker symbol alphabetically
  - Sold holdings displayed with strikethrough styling or "SOLD" badge

### 4.3 Snapshot creation (Priority: High)

- **New snapshot button** (Priority: High)
  - Button positioned at top of page: "+ New Snapshot"
  - Opens snapshot creation modal/drawer

- **Snapshot form** (Priority: High)
  - **Snapshot Date**: Date picker, defaults to today, required
  - **Pre-fill option**: Checkbox "Copy from previous snapshot" (checked by default)
  - If prefill enabled, form populates with all holdings from most recent snapshot
  - User can then modify values, add new holdings, mark sales, or remove holdings

- **Add stock holding** (Priority: High)
  - **Account Selection**: Dropdown of user's brokerage accounts (Business type=BROKERAGE)
  - **Ticker Symbol**: Text input (free text, e.g., "CBA.AX", "AAPL")
  - **Company Name**: Text input (e.g., "Commonwealth Bank", "Apple Inc")
  - **Quantity**: Numeric input, required, must be > 0
  - **Buy Price**: Currency input with formatting, required, must be > 0
  - **Buy Date**: Date picker, required, must be ≤ snapshot date
  - **Current Price (Manual)**: Currency input, required for P/L calculation
  - **Currency**: Dropdown (AUD, USD), defaults based on account or user preference
  - **Planned Term**: Dropdown (Short Term, Mid Term, Long Term), required
  - **Sale Price**: Currency input, optional (only if stock was sold)
  - **Sale Date**: Date picker, optional (required if sale price provided)

- **Planned term definitions** (Priority: High)
  - **Short Term**: User intends to hold < 12 months (no CGT discount expected)
  - **Mid Term**: User intends to hold 12-36 months
  - **Long Term**: User intends to hold > 36 months

- **Add multiple holdings** (Priority: Medium)
  - Button to add another holding row to same snapshot
  - Can add holdings across different accounts in single snapshot session

### 4.4 Snapshot editing (Priority: Medium)

- **Edit stock holding** (Priority: Medium)
  - Click edit icon on holding row
  - Opens inline edit or modal with pre-filled values
  - All fields editable except Account (to change account, delete and re-add)
  - Save updates the StockHolding record
  - Cancel reverts to original values

- **Record partial or full sale** (Priority: Medium)
  - User updates existing holding with sale information
  - Enter Sale Price and Sale Date
  - For partial sale: Reduce Quantity field to remaining shares
  - System calculates realized P/L for sold portion
  - CGT discount auto-calculated based on Buy Date vs Sale Date

- **Edit snapshot date** (Priority: Low)
  - Option to modify the snapshot date
  - Confirmation if changing to historical date

- **Add holding to existing snapshot** (Priority: Medium)
  - Button within page to add new holding to current snapshot
  - Same form as snapshot creation but links to existing snapshot

### 4.5 Snapshot deletion (Priority: Medium)

- **Delete stock holding** (Priority: Medium)
  - Delete icon on each holding row
  - Confirmation dialog: "Are you sure you want to delete [Ticker] from this snapshot?"
  - Removes StockHolding record
  - Updates account and grand totals

- **Delete entire snapshot** (Priority: Low)
  - Button/option to delete entire snapshot
  - Confirmation: "This will permanently delete the snapshot from [Date] with [X] holdings. This cannot be undone."
  - Removes StockSnapshot and all related StockHolding records
  - Page refreshes to show previous snapshot (if exists)

### 4.6 Calculations (Priority: High)

- **Cost basis calculation** (Priority: High)
  - Cost Basis = Buy Price × Quantity
  - Stored or calculated on-demand

- **Market value calculation** (Priority: High)
  - Market Value = Current Price (Manual) × Quantity
  - Updated when current price is edited

- **Unrealized P/L calculation** (Priority: High)
  - For unsold holdings only
  - Unrealized P/L = Market Value - Cost Basis
  - Unrealized P/L % = ((Market Value - Cost Basis) / Cost Basis) × 100

- **Realized P/L calculation** (Priority: High)
  - For sold holdings only
  - Realized P/L = (Sale Price × Quantity Sold) - (Buy Price × Quantity Sold)
  - If partial sale, calculate based on sold quantity only

- **Holding period calculation** (Priority: High)
  - Actual Holding = differenceInMonths(snapshotDate or saleDate, buyDate)
  - Display as "X months" or "X years, Y months" for longer periods
  - Used for CGT discount eligibility

- **CGT discount eligibility** (Priority: High)
  - Eligible if holding period ≥ 12 months at time of sale
  - Display checkmark/badge for eligible holdings
  - For unsold holdings, show projected eligibility date

- **Account totals** (Priority: High)
  - Total Value = SUM(Market Value) for all holdings in account
  - Total Unrealized P/L = SUM(Unrealized P/L) for unsold holdings
  - Total Realized P/L = SUM(Realized P/L) for sold holdings

- **Grand totals by currency** (Priority: High)
  - Separate totals for each currency (no conversion)
  - AUD Total = SUM of all AUD account totals
  - USD Total = SUM of all USD account totals

### 4.7 Investment term tracking (Priority: Medium)

- **Planned vs actual comparison** (Priority: Medium)
  - Display both planned term (user's intent) and actual holding period
  - Visual indicator comparing plan vs reality:
    - **On Track**: Actual holding aligns with planned term
    - **Ahead**: Held longer than planned category minimum
    - **Behind**: Approaching or past planned term without achieving goal
  - Color coding: Green (on track), Yellow (approaching), Red (exceeded plan)

- **Term thresholds** (Priority: Medium)
  - Short Term: 0-11 months
  - Mid Term: 12-36 months
  - Long Term: 37+ months
  - Used for calculating "on track" status

### 4.8 Brokerage account management (Priority: High)

- **Account prerequisite** (Priority: High)
  - Users must have at least one Business with type=BROKERAGE configured
  - If none exist, display: "You need to add a brokerage account first. Go to Settings → Business."
  - Link navigates to existing Business settings page

- **Account creation** (Priority: High)
  - Uses existing Settings → Business page
  - User creates new Business with type=BROKERAGE
  - Fields: Name (e.g., "Commsec"), Address (optional), Type = BROKERAGE
  - New enum value added to BusinessEnumType

- **Default currency per account** (Priority: Low - Future)
  - Future enhancement: Store default currency per brokerage account
  - Auto-populate currency field when adding holdings to that account

## 5. User experience

### 5.1 Entry points & first-time user flow

- **Navigation**: Assets → Stocks in sidebar (new menu item under Assets disclosure)
- **First visit**: Empty state with clear CTA - "Track your stock portfolio. Take your first snapshot."
- **Prerequisite check**: If user has no brokerage accounts configured, prompt: "You need to add a brokerage account first. Go to Settings → Business."
- **First snapshot**: Guided form with clear labels, tooltips explaining each field

### 5.2 Core experience

- **Step 1: Select fiscal year**: User chooses fiscal year from dropdown
- **Step 2: View snapshot**: Most recent snapshot displays with account accordions and grand totals
- **Step 3: Expand account**: User clicks accordion to see individual holdings
- **Step 4: Take new snapshot**: Click "New Snapshot", form pre-fills with last data, user updates prices/quantities
- **Step 5: Record sales**: User updates holdings with sale price/date when stocks are sold
- **Step 6: Review totals**: Summary cards update showing P/L and CGT eligibility

### 5.3 Advanced features & edge cases

- **No brokerage accounts configured**: Display message with link to Settings → Business
- **Account deleted**: Historical snapshots retain data, account name shows "(Deleted)"
- **Stock symbol change**: Manual update required; historical entries retain old ticker
- **Zero quantity**: Not allowed - if fully sold, mark as sold rather than zero quantity
- **Very large quantities**: Support up to 9 digit quantities
- **Multiple snapshots same day**: Allowed (user might correct a mistake)
- **Fiscal year with no snapshots**: Display empty state, encourage new snapshot
- **Same stock in multiple accounts**: Displayed separately per account (no consolidation)
- **Currency mismatch**: Each holding's currency stored independently; totals grouped by currency

### 5.4 UI/UX highlights

- **Accordion pattern**: Headless UI Disclosure component (consistent with sidebar navigation)
- **Summary cards**: Card component with colored P/L indicators (green positive, red negative)
- **Form controls**: react-select for dropdowns, NumericFormat for currency/quantity, react-day-picker for dates
- **Icons**: react-icons library (FiEdit2, FiTrash2, FiChevronDown, FiChevronUp, FiPlus)
- **Loading states**: Suspense fallbacks while fetching data
- **Responsive design**: Accordion works on mobile, table scrolls horizontally if needed
- **Toast notifications**: Success/error feedback using existing toast pattern
- **Color coding**:
  - Profit: Green text/background
  - Loss: Red text/background
  - CGT Eligible: Green checkmark badge
  - Term status: Green (on track), Yellow (approaching), Red (exceeded)

## 6. Narrative

Marcus opens his financial tracking app on the weekend to update his stock portfolio. He navigates to Assets → Stocks and sees his previous snapshot from last month. The page shows two summary cards - one for his AUD holdings ($47,500, +$3,200 unrealized P/L) and one for USD holdings ($12,300 USD, -$450 unrealized P/L).

Below the summary, he sees his three brokerage accounts as accordions. He expands "Commsec" and sees his ASX holdings - CBA, BHP, and VAS ETF. The table shows each stock's buy price, current price, and P/L. His CBA shares show a green "CGT Eligible" badge since he's held them for 18 months.

He clicks "New Snapshot" and the form opens pre-filled with all his holdings from last month. He updates the current prices based on today's market close - CBA went up to $115, BHP dropped to $42. He also sold half his VAS holdings last week, so he enters the sale price ($98.50) and sale date. The system automatically calculates his realized gain of $1,240 and shows the CGT discount is applicable.

He adds a new stock he purchased this week - 50 shares of TLS at $3.85. He selects "Mid Term" as his planned holding period since he intends to hold for about 2 years. He saves the snapshot and the page updates - his new AUD total is $45,800 with both realized and unrealized P/L clearly displayed.

Later, when preparing his tax return, Marcus switches to the previous fiscal year and can see exactly which stocks he sold, the holding periods, CGT discount eligibility, and total realized gains for that tax year.

## 7. Success metrics

### 7.1 User-centric metrics

- Number of users actively taking stock snapshots (monthly active users)
- Average number of brokerage accounts tracked per user
- Average number of holdings per snapshot
- Frequency of snapshot creation (weekly, monthly patterns)
- Time to complete a new snapshot (target: < 3 minutes with prefill)
- Feature adoption rate among existing users

### 7.2 Business metrics

- Increased overall app engagement/retention
- Users who track stocks more likely to use related features (Income for dividends)
- Cross-feature engagement (users tracking both Bank Assets and Stock Assets)
- Reduced user drop-off during tax planning workflows

### 7.3 Technical metrics

- Page load time for stock assets page (target: < 2 seconds)
- Snapshot save operation time (target: < 500ms)
- Error rate for CRUD operations (target: < 1%)
- Database query performance for snapshot retrieval with aggregations

## 8. Technical considerations

### 8.1 Integration points

- **Authentication**: NextAuth session for user scoping (existing pattern)
- **Brokerage accounts**: Business model (type=BROKERAGE) for account dropdown
- **Calendar years**: CalendarYear model (type=FISCAL) for year filtering
- **tRPC**: API routes for CRUD operations
- **Database**: Prisma ORM with PostgreSQL
- **Date calculations**: date-fns library for holding period calculations

### 8.2 Data storage & privacy

- All snapshot data scoped to authenticated user via userId foreign key
- No cross-user data access possible at query level
- Decimal precision for money fields (@db.Money)
- Soft-delete consideration for audit trail (or hard delete per existing patterns)

### 8.3 Scalability & performance

- Index on userId + snapshotDate for efficient queries
- Index on snapshotId for holding lookups
- Aggregate queries for totals (SUM by account, SUM by currency)
- Consider pagination if user has many holdings (>50 per account)
- Optimistic UI updates for better perceived performance

### 8.4 Potential challenges

- **Prefill complexity**: Efficiently loading and transforming previous snapshot into form state
- **Multi-currency totals**: Ensuring currency grouping is correct without conversion
- **CGT calculations**: Handling partial sales and maintaining accurate cost basis
- **Holding period edge cases**: Leap years, timezone handling for date calculations
- **Account deletion cascade**: Decide whether to cascade delete or preserve historical data
- **Large portfolios**: Performance with users having 100+ holdings across accounts

## 9. Milestones & sequencing

### 9.1 Project estimate

- **Medium-Large project**: 3-4 weeks estimated development time
- Complexity factors: Multi-currency support, dual term tracking, CGT calculations, accordion UI

### 9.2 Team size & composition

- 1 Full-stack developer (familiar with Next.js, Prisma, tRPC)
- UI/UX review for accordion patterns and summary card design

### 9.3 Suggested phases

**Phase 1: Foundation (Week 1)**

- Add BROKERAGE to BusinessEnumType enum
- Create database models (StockSnapshot, StockHolding, enums)
- Run Prisma migrations
- Create tRPC router with basic CRUD operations
- Create Server Actions for snapshot management

**Phase 2: Core UI (Week 2)**

- Build main Stock Assets page with fiscal year filter
- Implement snapshot selector dropdown
- Create grand total summary cards (per currency)
- Build account accordion structure with Disclosure component
- Implement holdings table within accordion

**Phase 3: Snapshot Management (Week 3)**

- Build "New Snapshot" modal/form
- Implement prefill from previous snapshot logic
- Add holding creation form with all fields
- Implement edit holding functionality
- Implement delete holding with confirmation
- Add sale recording (partial/full) functionality

**Phase 4: Calculations & Polish (Week 4)**

- Implement P/L calculations (realized/unrealized)
- Add CGT discount eligibility logic
- Build investment term comparison indicators
- Add holding period calculations
- Implement optimistic UI updates
- Testing and bug fixes
- Responsive design refinements

### 9.4 Future enhancements (Out of scope)

- Live price API integration (Yahoo Finance, Alpha Vantage)
- Dividend tracking integration with Income feature
- Portfolio performance charts and graphs
- Stock comparison across snapshots
- Export to CSV/PDF for tax purposes
- Default currency per brokerage account

## 10. User stories

### 10.1 Snapshot management

| ID      | User Story                                                                                                         | Acceptance Criteria                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| STK-001 | As a user, I want to create a new stock snapshot so that I can record my portfolio position on a specific date     | Given I'm on the Stock Assets page, When I click "New Snapshot" and fill in the form, Then a new snapshot is created with the specified date     |
| STK-002 | As a user, I want my new snapshot pre-filled with previous holdings so that I don't have to re-enter all my stocks | Given I have a previous snapshot, When I create a new snapshot with prefill enabled, Then all holdings from the last snapshot appear in the form |
| STK-003 | As a user, I want to edit an existing holding so that I can update prices or correct mistakes                      | Given I'm viewing a snapshot, When I click edit on a holding and modify values, Then the holding is updated and totals recalculate               |
| STK-004 | As a user, I want to delete a holding from a snapshot so that I can remove incorrect entries                       | Given I'm viewing a snapshot, When I click delete on a holding and confirm, Then the holding is removed and totals recalculate                   |

### 10.2 Recording stock transactions

| ID      | User Story                                                                              | Acceptance Criteria                                                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STK-005 | As a user, I want to add a new stock purchase so that I can track my investment         | Given I'm creating/editing a snapshot, When I add a new holding with ticker, quantity, buy price, and buy date, Then the holding appears in the appropriate account accordion |
| STK-006 | As a user, I want to record a stock sale so that I can track my realized gains/losses   | Given I have an existing holding, When I enter sale price and sale date, Then the realized P/L is calculated and CGT eligibility is shown                                     |
| STK-007 | As a user, I want to record a partial stock sale so that I can track remaining holdings | Given I have 100 shares, When I sell 50 and update quantity to 50 with sale info, Then 50 shares remain and realized P/L reflects sold portion                                |

### 10.3 Portfolio analysis

| ID      | User Story                                                                                              | Acceptance Criteria                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| STK-008 | As a user, I want to see my total portfolio value per currency so that I understand my exposure         | Given I have holdings in AUD and USD, When I view the page, Then I see separate summary cards for each currency total           |
| STK-009 | As a user, I want to see profit/loss for each holding so that I know which stocks are performing        | Given I have holdings with buy and current prices, When I view the holdings table, Then each row shows calculated P/L and P/L % |
| STK-010 | As a user, I want to see which holdings qualify for CGT discount so that I can plan tax-efficient sales | Given I have holdings with various holding periods, When I view holdings, Then those ≥12 months show CGT eligible indicator     |

### 10.4 Investment term tracking

| ID      | User Story                                                                                                   | Acceptance Criteria                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| STK-011 | As a user, I want to set a planned investment term when buying so that I can track my investment strategy    | Given I'm adding a new holding, When I select Short/Mid/Long term, Then the planned term is saved with the holding                     |
| STK-012 | As a user, I want to see how my actual holding period compares to my plan so that I can assess my discipline | Given I have a holding with planned term, When I view it, Then I see both planned term and actual holding period with status indicator |

### 10.5 Account management

| ID      | User Story                                                                                                   | Acceptance Criteria                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| STK-013 | As a user, I want to see my holdings grouped by brokerage account so that I understand exposure per platform | Given I have holdings across multiple accounts, When I view the page, Then each account appears as a separate accordion with its holdings |
| STK-014 | As a user, I want to expand/collapse account sections so that I can focus on specific accounts               | Given I see account accordions, When I click an accordion header, Then it expands to show holdings or collapses to hide them              |

## 11. Database schema (Proposed)

```prisma
// Add to existing BusinessEnumType enum
enum BusinessEnumType {
  BANK
  PHILANTHROPY
  BROKERAGE  // NEW
}

// New enum for investment term outlook
enum InvestmentTermEnumType {
  SHORT_TERM   // User intends to hold < 12 months
  MID_TERM     // User intends to hold 12-36 months
  LONG_TERM    // User intends to hold > 36 months
}

// New enum for supported currencies
enum CurrencyEnumType {
  AUD
  USD
}

// Stock snapshot - point-in-time record of portfolio
model StockSnapshot {
  id           String         @id @default(cuid())
  snapshotDate DateTime
  calendar     CalendarYear   @relation(fields: [calendarId], references: [id])
  calendarId   String
  userId       String
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  holdings     StockHolding[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([userId, snapshotDate])
  @@index([calendarId])
}

// Individual stock holding within a snapshot
model StockHolding {
  id             String                @id @default(cuid())
  ticker         String                // e.g., "CBA.AX", "AAPL"
  companyName    String                // e.g., "Commonwealth Bank", "Apple Inc"
  quantity       Int                   // Number of shares held
  buyPrice       Decimal               @db.Money // Price per share at purchase
  buyDate        DateTime              // Date of purchase
  currentPrice   Decimal               @db.Money // User-entered current price (manual)
  currency       CurrencyEnumType      // AUD or USD
  plannedTerm    InvestmentTermEnumType // User's intended holding period

  // Sale information (optional - populated when stock is sold)
  salePrice      Decimal?              @db.Money // Price per share at sale
  saleDate       DateTime?             // Date of sale

  // Relations
  account        Business              @relation(fields: [accountId], references: [id])
  accountId      String
  snapshot       StockSnapshot         @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  snapshotId     String

  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt

  @@index([snapshotId])
  @@index([accountId])
  @@index([ticker])
}

// Update existing models to add relations
// Add to User model:
//   StockSnapshot StockSnapshot[]

// Add to Business model:
//   StockHolding  StockHolding[]

// Add to CalendarYear model:
//   StockSnapshot StockSnapshot[]
```

## 12. API endpoints (tRPC)

### 12.1 Snapshot operations

| Procedure                       | Type     | Description                          |
| ------------------------------- | -------- | ------------------------------------ |
| `stockSnapshot.getByFiscalYear` | Query    | Get all snapshots for a fiscal year  |
| `stockSnapshot.getLatest`       | Query    | Get most recent snapshot for prefill |
| `stockSnapshot.getById`         | Query    | Get specific snapshot with holdings  |
| `stockSnapshot.create`          | Mutation | Create new snapshot with holdings    |
| `stockSnapshot.delete`          | Mutation | Delete snapshot and all holdings     |

### 12.2 Holding operations

| Procedure             | Type     | Description                          |
| --------------------- | -------- | ------------------------------------ |
| `stockHolding.create` | Mutation | Add holding to existing snapshot     |
| `stockHolding.update` | Mutation | Update holding (including sale info) |
| `stockHolding.delete` | Mutation | Remove holding from snapshot         |

### 12.3 Summary operations

| Procedure                        | Type  | Description                          |
| -------------------------------- | ----- | ------------------------------------ |
| `stockSummary.getAccountTotals`  | Query | Get totals grouped by account        |
| `stockSummary.getCurrencyTotals` | Query | Get grand totals grouped by currency |
| `stockSummary.getCGTReport`      | Query | Get CGT-eligible holdings for tax    |

## 13. UI component structure

```
src/app/(authorized)/assets/stocks/
├── page.tsx                    # Server Component - main page
├── layout.tsx                  # Layout wrapper
├── form.tsx                    # Client Component - fiscal year/snapshot selectors
├── actions.ts                  # Server Actions for CRUD
├── reducer.ts                  # State reducer for optimistic updates
├── StateProvider.tsx           # Context provider for state management
├── _types.ts                   # TypeScript types
├── _schema.ts                  # Zod validation schemas
├── StockSnapshotTableServer.tsx # Server Component - data fetching
├── StockSnapshotTableClient.tsx # Client Component - accordion + table
├── NewSnapshotModal.tsx        # Modal for creating snapshots
├── HoldingForm.tsx             # Form for adding/editing holdings
├── SummaryCards.tsx            # Grand total summary cards
└── _table/
    ├── columns.tsx             # TanStack Table column definitions
    ├── HoldingRow.tsx          # Individual holding row component
    └── AccountAccordion.tsx    # Accordion wrapper per account
```

## 14. Wireframe description

### 14.1 Page layout

```
┌─────────────────────────────────────────────────────────────┐
│  Stock Portfolio Tracking                    [+ New Snapshot]│
├─────────────────────────────────────────────────────────────┤
│  Fiscal Year: [2025-2026 ▼]    Snapshot: [01 Feb 2026 ▼]   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ AUD Holdings        │  │ USD Holdings        │          │
│  │ Total: $47,500.00   │  │ Total: $12,300.00   │          │
│  │ Unrealized: +$3,200 │  │ Unrealized: -$450   │          │
│  │ Realized: +$1,240   │  │ Realized: $0        │          │
│  └─────────────────────┘  └─────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ Commsec                    AUD    $35,200  +$2,100   ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▼ MooMoo                     USD    $12,300  -$450     ││
│  │ ┌─────────────────────────────────────────────────────┐││
│  │ │ Stock    Qty  Buy$  BuyDate  Curr$  Value   P/L ... │││
│  │ │ AAPL     25   $145  15/06/25 $142   $3,550  -$75... │││
│  │ │ MSFT     10   $380  20/08/25 $395   $3,950  +$150...│││
│  │ └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ Commbank Pocket            AUD    $12,300  +$1,100   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 14.2 Holdings table columns (expanded accordion)

| Stock                    | Qty | Buy $  | Buy Date | Curr $  | Value   | P/L     | P/L %  | Plan | Actual | Sale $ | Sale Date | CGT | Actions |
| ------------------------ | --- | ------ | -------- | ------- | ------- | ------- | ------ | ---- | ------ | ------ | --------- | --- | ------- |
| CBA.AX Commonwealth Bank | 100 | $95.50 | 15/03/24 | $115.00 | $11,500 | +$1,950 | +20.4% | LONG | 22mo ✓ | -      | -         | ✓   | ✏️ 🗑️   |
| VAS.AX Vanguard ASX 300  | 50  | $92.00 | 01/06/25 | $98.50  | $4,925  | +$325   | +7.1%  | MID  | 8mo    | $98.50 | 25/01/26  | ✗   | ✏️ 🗑️   |
