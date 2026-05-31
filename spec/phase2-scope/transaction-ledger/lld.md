# Phase Map

| Phase | Description |
|-------|-------------|
| 1     | Router: Replace offset pagination with cursor pagination in `transactionLedgerRouter.getAll` |
| 2     | Client: Update `TransactionsClient` to use "Load More" with `nextCursor` |

---

## 1. Router: Cursor-Based Pagination

### Input Schema Change

```typescript
// Before
const getTransactionsInput = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(50),
  // ... filters unchanged
});

// After
const getTransactionsInput = z.object({
  cursor: z.string().cuid().optional(),   // last id from previous page; omit for first page
  limit: z.number().int().min(1).max(200).default(50),
  // ... all filters unchanged
});
```

### Response Shape Change

```typescript
// Before
{
  transactions: TransactionRow[];
  total: number;        // COUNT(*) — expensive
  page: number;
  pageCount: number;
}

// After
{
  transactions: TransactionRow[];
  nextCursor: string | null;   // id of the last item; null if no more pages
}
```

### Router Implementation

```typescript
// In transactionLedgerRouter.getAll
const where = buildTransactionWhere(input, ctx.session.user.id);

// Fetch limit+1 to detect if there is a next page
const rows = await ctx.prisma.transaction.findMany({
  where,
  orderBy: [{ date: 'desc' }, { id: 'desc' }],   // stable sort: date desc, id desc as tiebreaker
  take: input.limit + 1,
  cursor: input.cursor ? { id: input.cursor } : undefined,
  skip: input.cursor ? 1 : 0,   // skip the cursor item itself on subsequent pages
  include: { /* same as before */ },
});

const hasNextPage = rows.length > input.limit;
const transactions = hasNextPage ? rows.slice(0, input.limit) : rows;
const nextCursor = hasNextPage ? transactions[transactions.length - 1]!.id : null;

// Remove the COUNT query entirely — no totalCount, no pageCount
// Aggregates (debit sum, credit sum) remain in Promise.all unchanged

return {
  transactions: transactions.map(mapToTransactionRow),
  nextCursor,
};
```

### Index Note
Cursor pagination on `(date DESC, id DESC)` is served by the existing `@@index([userId, bankAccountId, date])`. If no `bankAccountId` filter is applied, add `@@index([userId, date])` for the common case.

---

## 2. Client: "Load More" UX

### State Changes in TransactionsClient

```typescript
// Replace:
const [page, setPage] = useState(1);

// With:
const [cursor, setCursor] = useState<string | undefined>(undefined);
const [allTransactions, setAllTransactions] = useState<TransactionRow[]>([]);
```

### tRPC Query Change

```typescript
// Use useInfiniteQuery instead of useQuery
const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
  trpc.transactionLedger.getAll.useInfiniteQuery(
    { ...filters, limit: 50 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialCursor: undefined,
    },
  );

// Flatten pages
const transactions = data?.pages.flatMap((page) => page.transactions) ?? [];
```

### UI Change

Replace the `<Pagination>` component at the bottom of the table with:
```tsx
{hasNextPage && (
  <tr>
    <td colSpan={colCount} className="py-4 text-center">
      <button
        type="button"
        onClick={() => fetchNextPage()}
        disabled={isFetchingNextPage}
        className="text-sm text-teal-600 hover:underline disabled:opacity-50"
      >
        {isFetchingNextPage ? 'Loading...' : 'Load more transactions'}
      </button>
    </td>
  </tr>
)}
```

### Filter Reset
When any filter changes, reset the cursor:
```typescript
useEffect(() => {
  // Reset infinite query when filters change — cursor must restart from beginning
  // tRPC useInfiniteQuery handles this automatically when query key changes
}, [filters]);
```
Because filters are part of the query key, tRPC `useInfiniteQuery` resets automatically when any filter changes. No manual cursor reset needed.

---

## TDD Test Cases

### Phase 1: Router
| Test | Type | Verifies |
|------|------|----------|
| Returns `nextCursor` when more rows exist | unit | Cursor is last row's id |
| Returns `nextCursor: null` on last page | unit | No over-fetch |
| Second page with cursor excludes first page rows | integration | No duplicates |
| Filter changes restart from beginning | unit | Cursor omitted → first page |

### Phase 2: Client
| Test | Type | Verifies |
|------|------|----------|
| "Load more" button appears when nextCursor present | unit | UI control visible |
| "Load more" button absent on last page | unit | UI control hidden |
| Clicking "Load more" appends rows (not replaces) | integration | Accumulation works |
| Changing filter clears accumulated rows | integration | Stale data not shown |

---

## Acceptance Criteria

- [x] No `COUNT(*)` query fired on any page load
- [x] First page loads in the same latency as current implementation
- [x] Subsequent pages append rows to the table (do not replace)
- [x] Any filter change resets to the first page automatically (`useInfiniteQuery` resets on query key change)
- [x] "Load More" button is hidden when on the last page
- [x] No regression in existing filter, sort, or aggregate behaviour

---

## File Inventory (As-Built)

| File | Status | Description |
|------|--------|-------------|
| `src/server/trpc/router/transaction-ledger.ts` | ✅ BUILT | `cursor` replaces `page`; `take: limit+1`; `nextCursor` in response; `COUNT(*)` removed |
| `src/components/transactions/TransactionLedgerTable.tsx` | ✅ BUILT | `useInfiniteQuery` + "Load More" button; `pages.flatMap` for accumulation; all `setPage` calls removed |
| `prisma/schema.prisma` | ✅ BUILT | Added `@@index([userId, date, id])` for cursor keyset pagination on unfiltered ledger |
| `src/__tests__/unit/transaction-ledger.router.test.ts` | ✅ BUILT | 4 new cursor pagination tests: nextCursor present/null, cursor forwarded to findMany, no COUNT call |
| `src/__tests__/unit/TransactionLedgerTable.test.tsx` | ✅ BUILT | Mock updated from `useQuery` to `useInfiniteQuery`; data shape updated to `pages[]` |
