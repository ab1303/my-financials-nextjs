# Drill-Down — LLD

## Overview
This cashflow-taxonomy feature turns monthly expense category totals into deep links to the transactions page, where the ledger opens in a preset category/month/year state. It adds URL-driven filters, a category-specific server query, and a filtered ledger presentation that preserves the existing transactions page as the canonical review surface.

---

## Implementation Slices

### 1. Link from summary to transactions
- Make category rows in the monthly expense summary navigable.
- Encode category and period into `/cashflow/transactions` search params.
- Preserve the existing summary UI while adding a clear drill-down affordance.

### 2. Parse and persist filter state
- Extend the transactions page/client boundary to accept initial `category`, `month`, and `year` params.
- Render a category drill-down filter panel when drill-down state is active.
- Keep the URL as the persistent filter contract; reset returns to the base ledger route.

### 3. Add category transaction query
- Create a protected tRPC procedure for category drill-down.
- Scope queries to the authenticated user.
- Filter by category, time range, expense transaction type, and confirmed status.
- Return both ledger rows and summary metadata (`total`, `totalAmount`, optional aggregates).

### 4. Render filtered ledger state
- Detect when category drill-down is active and switch the ledger into a category-filtered mode.
- Show heading/summary metadata so users can verify the selected category and period.
- Allow users to adjust filters or clear them without leaving the transactions page.

---

## Query Contract

### Input
```ts
{
  category: string;
  month: number;
  year: number;
  limit?: number;
  offset?: number;
}
```

### Output
```ts
{
  transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    status: string;
    bankAccountName: string | null;
  }>;
  category: string;
  month: number;
  year: number;
  total: number;
  totalAmount: number;
  averageAmount?: number;
}
```

### Server rules
- Match category names case-insensitively when reading transaction rows.
- Restrict to the transaction population represented by monthly expense totals.
- Build the month date range on the server so URL params stay simple.

---

## UX Rules
- Drill-down opens on the transactions page, not inside the summary modal.
- Preset filters should be visible and editable.
- Reset clears the URL params and restores the default ledger.
- Empty states should still show the active filter context, even when no rows match.

---

## Files
| File | Action | Description |
|---|---|---|
| `src\components\monthly-expenses\MonthlyExpensesSummary.tsx` | MODIFY | Turn category rows into deep links to the filtered transactions page |
| `src\app\(authorized)\cashflow\transactions\page.tsx` | MODIFY | Parse category/month/year search params and pass them to the client boundary |
| `src\app\(authorized)\cashflow\transactions\_components\TransactionsClient.tsx` | MODIFY | Render drill-down filter UI and pass initial filter state into the ledger |
| `src\app\(authorized)\cashflow\transactions\_components\CategoryTransactionFilters.tsx` | CREATE | Client filter component that reflects and updates URL-driven drill-down state |
| `src\components\transactions\TransactionLedgerTable.tsx` | MODIFY | Switch between default ledger behavior and category-filtered ledger mode |
| `src\server\api\routers\category-transactions.ts` | CREATE | Protected tRPC router for category/month transaction drill-down queries |
| `src\server\api\root.ts` | MODIFY | Register the category drill-down router |
| `src\server\services\transactions\category.service.ts` | CREATE | Optional service extraction for shared date-range/category query logic |

---

## Acceptance Criteria
- Users can click a category total and land on `/cashflow/transactions` with preset category/month/year filters.
- The transactions page shows only the matching expense transactions for the selected period.
- The filtered view displays summary metadata consistent with the source aggregate.
- Users can adjust filters or reset back to the unfiltered ledger without losing page context.
