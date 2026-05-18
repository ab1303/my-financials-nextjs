# Category Transaction Drill-Down — High Level Design

## Problem Statement

When a user views the monthly expense modal and sees a category total (e.g., "Groceries: $1,445.62"), they cannot drill into that category to see which transactions made up that amount. Market research across YNAB, Wave, and Mint shows that the optimal UX is **navigation to a filtered transactions page** rather than inline expansion. This allows users to:

- Verify category accuracy post-import
- Understand spending patterns within a category
- Leverage full transaction editing/filtering capabilities
- Export or review transactions as a batch

---

## Goals

- Enable users to click a category in the expense modal and navigate to a filtered transactions view
- Pre-populate the transactions page with category + month filters
- Allow users to adjust filters (e.g., change month, clear category) from the transactions page
- Maintain filter state via URL search params for bookmarking/sharing

---

## Out of Scope

- Editing transactions (already handled by transaction ledger page)
- Drill-down from income or transfer transactions (income is in ledger; transfers are excluded)
- Bulk category re-assignment from the drill-down view
- Real-time aggregation rollup (amounts are computed at import time)

---

## Architecture

### Component Hierarchy

```
MonthlyExpensesSummary Modal (Server Component)
  └─ Category row with link
     ├─ {categoryName} (clickable text)
     └─ {amount} (read-only)
        → on click: useRouter().push(/cashflow/transactions?category=...&month=...)

TransactionsClient (Client Component)
  ├─ ImportCard row (existing)
  └─ CategoryTransactionFilters (NEW, Client Component)
     ├─ Category select (dropdown, pre-populated from URL)
     ├─ Month select (dropdown, pre-populated from URL)
     ├─ [Reset] button
     └─ TransactionLedgerTable
        └─ Displays transactions filtered by category + month
```

### Data Fetching

- **URL parsing:** `useSearchParams` extracts `category`, `month`, `year` from URL
- **Pre-population:** `CategoryTransactionFilters` reads params and sets local state
- **Query execution:** `tRPC categoryTransactions.getByCategory({ category, month, year })` returns filtered transactions
- **Fallback:** If no category/month provided in URL, show all transactions (existing ledger behavior)

### Data Model

**New tRPC Procedure:**
```
categoryTransactions.getByCategory(input: {
  category: string;      // e.g., "Groceries"
  month: number;         // 1-12
  year: number;          // e.g., 2025
  limit?: number;        // default 50
  offset?: number;       // default 0
})

Output:
{
  transactions: TransactionRow[];  // all DEBIT, CONFIRMED for this category+month
  category: string;                 // confirmed category name
  month: number;
  year: number;
  total: number;                    // count of matching transactions
  totalAmount: number;              // sum of amounts
}
```

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Navigation mechanism | Link with URL params (not modal overlay) | Market standard; full transaction editing available; faster on mobile |
| Filter presets | Category + month locked/semi-locked | User context is clear; discourages accidental filter resets |
| URL persistence | Search params in URL, not session state | Bookmarkable, shareable, survives page refresh |
| Filter reset | [Reset] button clears all filters | UX pattern from YNAB, Wave; users expect single button |
| Default view | Show all transactions if no category param | Graceful fallback; no broken URLs |
| Transaction type | Only DEBIT (expense category) transactions | Income and transfers are separate ledgers |
| Status filter | Only CONFIRMED transactions | EXCLUDED/PENDING are not part of monthly expense total |
| Month scope | Numeric (1-12) in URL, resolved via fiscal calendar | Matches expense summary data model |

---

## Success Criteria

- ✅ User can click a category row in the expense modal
- ✅ Browser navigates to `/cashflow/transactions?category=groceries&month=02&year=2025`
- ✅ Category and month filters are pre-populated in the filter UI
- ✅ Transaction ledger table shows only transactions matching the filters
- ✅ User can adjust filters (change month, clear category) and see results update
- ✅ URL updates when filters change (for bookmarking)
- ✅ [Reset] button clears all filters and shows all transactions
- ✅ Sum of filtered transaction amounts matches the category total in the modal

---

## tRPC Router Surface

```
categoryTransactions
  .getByCategory(input) → filtered transactions + metadata
```

Full signatures and implementation details in LLD.

