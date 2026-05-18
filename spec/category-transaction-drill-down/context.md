# Category Transaction Drill-Down — Context

## Problem

Users viewing the monthly expense modal see category totals (e.g., "Groceries: $1,445.62") but cannot see which individual transactions make up that amount. There is no way to drill into a category, verify accuracy, or inspect the underlying transactions. User research on market-leading money apps (YNAB, Wave, Mint) shows the best UX is navigation to a filtered transactions page, not inline expansion.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/app/(authorized)/cashflow/transactions/_components/CategoryTransactionFilters.tsx` | Client Component — pre-populated category + month filters, resets available |
| `src/server/api/routers/category-transactions.ts` | tRPC router — `getByCategory` query with month/category filters |
| `src/server/services/transactions/category.service.ts` | DB query logic — fetch transactions by category, month, userId |

### Files to MODIFY

| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/transactions/page.tsx` | Add optional search params: `?category=groceries&month=2` (for deep-link support) |
| `src/components/monthly-expenses/MonthlyExpensesSummary.tsx` | Make category rows clickable; navigate to `/cashflow/transactions?category=<name>&month=<num>` |
| `src/server/api/root.ts` | Register `categoryTransactions` router |

---

## Schema Details

### `Transaction` model (relevant fields)
```prisma
model Transaction {
  id              String                 @id @default(cuid())
  date            DateTime
  description     String
  amount          Decimal                @db.Money
  type            TransactionTypeEnum    // DEBIT | CREDIT
  category        String                 // free-text category name
  status          TransactionStatusEnum  // PENDING | CONFIRMED | EXCLUDED
  bankAccountId   String?
  bankAccount     BankAccount?
  userId          String
  user            User
  createdAt       DateTime               @default(now())

  @@index([userId, type, status])
}
```

### `MonthlyExpenseSummary` model
```prisma
model MonthlyExpenseSummary {
  id              String          @id @default(cuid())
  month           Int             // 1-12
  amount          Decimal         @db.Money
  category        ExpenseCategory @relation(fields: [categoryId], references: [id])
  categoryId      String
  expenseLedger   ExpenseLedger   @relation(fields: [expenseLedgerId], references: [id], onDelete: Cascade)
  expenseLedgerId String
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([expenseLedgerId, month])
}
```

### `ExpenseCategory` model
```prisma
model ExpenseCategory {
  id                    String                  @id @default(cuid())
  name                  String                  @unique
  description           String?                 @db.Text
  isActive              Boolean                 @default(true)
  createdAt             DateTime                @default(now())
  monthlyExpenseSummaries MonthlyExpenseSummary[]
}
```

---

## Existing Patterns to Reuse

### tRPC router pattern
See `src/server/api/routers/` — protectedProcedure, Zod input validation, `ctx.session.user.id` scoping.

### Transaction query pattern
`src/server/api/routers/transaction-ledger.ts` — transaction filtering by type, status, date range, bank account, search.

### URL search params pattern
`src/app/(authorized)/cashflow/transactions/page.tsx` already uses search params for filters (via `useSearchParams` hook).

### Navigation pattern
Components use `next/navigation` `useRouter` + `useSearchParams` for deep-linking and filter state persistence.

---

## Data Flow

### Current State (No Drill-Down)
```
MonthlyExpensesSummary modal
  └─ Shows category totals (read-only)
     └─ User cannot see underlying transactions
```

### Proposed State (With Drill-Down)
```
MonthlyExpensesSummary modal
  └─ Category row (clickable link)
     → navigate to /cashflow/transactions?category=groceries&month=feb&year=2025
        └─ CategoryTransactionFilters (pre-populated, user can adjust)
           ├─ Category: [Groceries ▼] (locked or soft-locked)
           ├─ Month: [February ▼]
           ├─ [Reset filters]
           └─ TransactionLedgerTable
              └─ Shows all DEBIT transactions for Groceries in Feb (filtered)
```

### Query Execution
```
User clicks category link
  → push to router: /cashflow/transactions?category=groceries&month=02
     ↓
TransactionLedgerTable mounts
  → parseSearchParams: category, month, year
     ↓
tRPC categoryTransactions.getByCategory(category, month, year, userId)
  → Prisma: findMany(Transaction)
       where: { userId, type: DEBIT, status: CONFIRMED, category, month }
     ↓
Display filtered rows
  → Update title: "Groceries – February 2025 (12 transactions, $1,445.62)"
```

---

## Constraints & Gotchas

1. **Category name match is case-sensitive** — `Transaction.category` is a free string (not an FK to `ExpenseCategory`). Query must match exactly or use case-insensitive search.
2. **Month is numeric (1-12)** — Must parse URL param `month=02` as integer `2` for query.
3. **Transaction.type filtering** — Must filter by `type: DEBIT` for expense categories (credits are income, not expenses).
4. **Status filtering** — Show only `CONFIRMED` transactions by default; `EXCLUDED` transactions are not expenses (they are orphaned imports).
5. **Date range calculation** — Month is context-dependent (user's fiscal year). Query must resolve the date range for the month within the fiscal calendar.

---

## Out of Scope (Future)

- Drill-down from income transactions (credit type)
- Drill-down from transfer transactions (excluded type)
- Real-time sync of transaction amounts back to the expense modal (amounts are aggregated at import time)
- Editing transactions from the drill-down view (already exists in transaction ledger)

