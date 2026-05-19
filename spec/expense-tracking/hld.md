# High-Level Design: Monthly Expense Tracking

## Feature Overview

Monthly Expense Tracking enables authenticated users to view, manage, and import monthly expense data organized by fiscal year and expense categories. The system provides two data entry modes:

1. **Manual Entry** — Users directly enter aggregated amounts by category for each month
2. **CSV Import** — Users upload bank statements; the system classifies transactions, shows them for review, then aggregates confirmed transactions into monthly summaries

The feature follows architectural patterns from Bank Interest and Income pages with fiscal year filtering, Server Actions for CRUD, and optimistic UI updates.

## Goals

**Business Goals:**
- Provide simplified expense tracking complementing income and donation features
- Enable users to understand spending patterns for tax planning and budgeting
- Maintain consistent UX across all financial tracking features

**User Goals:**
- Track monthly expenses organized by categories
- View fiscal year expense totals for tax preparation
- Analyze spending patterns by month and category
- Maintain summary-level records (not date-level granularity)

**Non-Goals:**
- Individual transaction tracking for manual entry (summary-level only)
- Receipt attachments or photo uploads
- Budget alerts or spending limit notifications
- Direct bank API integration (CSV only)
- Support for multiple currencies (initial version AUD/USD only)
- Custom user categories (seeded global categories only)
- Drill-down from `MonthlyExpenseSummary` into raw transactions (Phase 3 future enhancement)

## Data Model Architecture

### Three-Layer Model

```
ManualEntry or CSVImport
        │
        ▼
ExpenseLedger (fiscal-year container)
    one row per user per fiscal year
        │
        ├──► MonthlyExpenseSummary[] (aggregated totals)
        │    one row per category per month
        │    source: manual entry OR rolled-up from Transaction records
        │
        └──► Transaction[] (audit trail)
             one row per CSV debit line
             provides reconciliation capability
             ⚠️  Note: Uses Transaction model, not dedicated BankTransaction model
```

### Model Details

#### ExpenseCategory (Global, Seeded)
- **Id**: CUID
- **Name**: Unique identifier (Housing, Utilities, Food, etc.)
- **IsActive**: Boolean flag for soft-delete
- Relations: `MonthlyExpenseSummary[]`, `Transaction[]`

#### ExpenseLedger (Container)
- **Id**: CUID
- **CalendarId**: FK to CalendarYear (fiscal year)
- **UserId**: FK to User (owner)
- **CreatedAt / UpdatedAt**: Timestamps
- **Constraint**: `@@unique([calendarId, userId])` — One per user per fiscal year
- Relations: `MonthlyExpenseSummary[]`

#### MonthlyExpenseSummary (Aggregate)
- **Id**: CUID
- **Month**: Integer 1–12
- **Amount**: Decimal (currency)
- **CategoryId**: FK to ExpenseCategory
- **ExpenseLedgerId**: FK to ExpenseLedger (cascade delete)
- **CreatedAt / UpdatedAt**: Timestamps
- **No unique constraint** — Allows multiple entries per (month, category) pair; application sums them
- Relations: `ExpenseLedger`, `ExpenseCategory`, `Transaction[]` (back-reference)

#### Transaction (Audit Trail)
- **Id**: CUID
- **Date**: DateTime (parsed from CSV or user-provided)
- **Description**: String (raw merchant description or user note)
- **Amount**: Decimal (currency)
- **Type**: TransactionTypeEnum (DEBIT for expense imports)
- **Category**: String (expense category name or "Transfer", "Excluded")
- **Source**: TransactionSourceEnum (LLM_CLASSIFIED or USER_OVERRIDE for CSV; direct for manual)
- **Status**: TransactionStatusEnum (CONFIRMED or EXCLUDED for transfers)
- **UserId**: FK to User
- **BankAccountId**: FK to BankAccount (optional, for multi-account users)
- **ImportSessionId**: FK to ImportSession
- **ConfirmedAt**: DateTime (when user confirmed the transaction)
- **CreatedAt / UpdatedAt**: Timestamps
- Indexes: `(userId, date)`, `(importSessionId)`, `(userId, categoryId)`, optimized for queries

#### MerchantCategoryMap (Write-Through Cache)
- **Id**: CUID
- **UserId**: FK to User
- **Description**: String (merchant description from CSV)
- **CategoryId**: FK to ExpenseCategory (learned category)
- **Constraint**: `@@unique([userId, description])` — One mapping per user per merchant
- Relations: `User`, `ExpenseCategory`

### Why Transaction Instead of BankTransaction

The original spec planned a dedicated `BankTransaction` model. The implementation uses the shared `Transaction` model for:

- **Code reuse**: Supports income, donations, and expense imports with one table
- **Flexibility**: `TransactionTypeEnum` and `TransactionSourceEnum` provide sufficient categorization
- **Audit trail**: `Transaction.source`, `Transaction.status`, `Transaction.confirmedAt` capture provenance
- **Performance**: Fewer tables = simpler schema, better foreign key efficiency

**Trade-off**: Drill-down from `MonthlyExpenseSummary` → raw transactions requires filtering by `importSessionId` and type, not a dedicated type column. A future phase could add a separate expense-specific table if analytics demands it.

## User Personas

- **Budget-conscious individual**: Wants to understand monthly spending patterns across major categories
- **Fiscal year planner**: Needs organized summaries by fiscal year for tax preparation
- **Simplicity seeker**: Prefers summary-level tracking (total spent on "Food" in January) over detailed transaction logging

## Feature Scope

### Manual Entry Mode
- User selects fiscal year
- Opens modal for specific month
- Adds expense entries (category + amount)
- Entries aggregated into `MonthlyExpenseSummary`
- Stored directly; no intermediate transaction table

### CSV Import Mode
- User uploads bank statement (CSV)
- System parses rows and classifies each into an `ExpenseCategory` (LLM-based with merchant cache)
- Wizard shows individual transactions for review; user can override category
- On confirm:
  - Writes `Transaction` record per CSV line (audit trail)
  - Aggregates by (month, categoryId) → upserts `MonthlyExpenseSummary`
  - Upserts `MerchantCategoryMap` for merchant learning

### Main Table
- 12 rows (ordered by fiscal year start month)
- Columns: Month, Total Expense, Category Breakdown button
- Footer: Annual total
- Clicking category breakdown opens modal

### Category Breakdown Modal
- Shows all entries for selected month organized by category
- Inline add/edit/delete
- Category dropdown (global seeded list, no custom categories in MVP)
- Amount input with currency formatting
- Footer displays monthly total

## Authentication & Authorization

- All operations require NextAuth session
- User ID validated server-side in all Server Actions and Route Handlers
- Expense records strictly scoped to authenticated user
- No shared data between users

## State Management Strategy

### Server-Side
- **Expense records** stored in `ExpenseLedger` and `MonthlyExpenseSummary`
- **Transaction records** stored in `Transaction` table for audit trail
- **Server Actions** perform CRUD with `revalidatePath` for cache invalidation

### Client-Side
- **Modal entry state** managed with Context + useReducer (Immer-based)
- **Optimistic updates** reflect immediately; rolled back on error
- **Fiscal year selection** passed via URL params; triggers full page reload

## Performance Considerations

- **Aggregation queries**: Use Prisma `.groupBy()` to calculate monthly totals (not client-side summation)
- **Data fetching**: Fetch only current fiscal year (not all historical data)
- **Indexes**: Put on `(expenseLedgerId, month)` for fast month lookups
- **Target SLA**: Page load <2s, modal open <1s, CRUD <1s

## Security Model

- **Input validation**: Zod schemas on all Server Actions
- **Session validation**: Every action verifies user session before DB operations
- **Data isolation**: Queries filter by `userId` FK
- **CSRF protection**: NextAuth session tokens
- **SQL injection protection**: Prisma ORM

## Alignment with Existing Features

- **Pattern match**: Bank Interest (monthly table) and Income (fiscal year filtering, Server Actions)
- **Code structure**: `page.tsx`, `form.tsx`, `Table` components, `_schema.ts`, `actions.ts`
- **UI library**: Tailwind CSS, Flowbite, react-select for dropdowns, TanStack Table
- **State pattern**: Context + useReducer (Immer) for modal state

## Known Design Decisions & Trade-Offs

| Decision | Rationale | Trade-Off |
|----------|-----------|-----------|
| Use `Transaction` model, not `BankTransaction` | Code reuse across import types | No expense-specific audit fields; drill-down requires filter |
| No duplicate prevention on (month, category) pair | Allow multiple entries for different contexts | Application must sum entries; UI must list all |
| Manual entry is summary-level only | Simpler UX; faster data entry | Users cannot drill down to individual receipts for manual entries |
| Fiscal year filtering only | Standard for financial tracking; matches Income/Donations | Some users may expect calendar year view (will be added as enhancement) |
| Seeded global categories only | MVP simplicity; reduces per-user complexity | Users cannot define custom categories (future enhancement) |
| No MerchantCategoryMap UI edits | Write-through learning sufficient for most cases | Users cannot correct merchant mappings; only LLM override in wizard |

## Scalability Notes

- **User growth**: Indexes on `(userId, date)` and `(expenseLedgerId)` scale to 1M+ users
- **Data volume**: 10 categories/month × 12 months × 10+ fiscal years = manageable per user
- **CSV imports**: Deduplication logic prevents duplicate transactions from repeated uploads
- **Merchant cache**: `MerchantCategoryMap` grows with unique merchants; query cost constant (index lookup)

## Future Enhancements (Out of Scope)

1. **BankTransaction drill-down** in modal — "What transactions make up this $450 Groceries/July figure?"
2. **User-editable MerchantCategoryMap** — UI to correct merchant mappings
3. **Transaction retention policy** — Configurable pruning of raw records after N months
4. **Expense reports & visualizations** — Charts, trends, year-over-year comparison
5. **Budget tracking** — Category budgets and spending limit alerts
6. **Custom categories** — Per-user category management
7. **Recurring templates** — Monthly rent, utilities auto-fill
8. **Receipt uploads** — Photo capture and attachment storage
