# Transaction Ledger — Patterns & Gotchas

Learnt from sessions debugging the auto-apply / review-batch feature.
Read this before touching `TransactionLedgerTable.tsx`, `TransactionRow.tsx`,
or `transaction-ledger.ts` router.

---

## Architecture Overview

```
TransactionLedgerTable (orchestrator)
  ├── queryInput (useMemo)  ← drives the single useInfiniteQuery
  ├── reviewBatch (string[] | null)  ← when set, queryInput gains ids filter
  ├── retainedRows (Map<id, row>)  ← rows kept visible after they leave the filter
  └── TransactionRow (per row)
        └── useCategoryEdit hook  ← owns localCategory, rule prompt, debounce timer
```

---

## 1. `buildTransactionWhere` — `ids` must be an early return

**File**: `src/server/trpc/router/transaction-ledger.ts`

When `input.ids` is provided (review mode), return immediately with only
`{ userId, id: { in: input.ids } }`. Do NOT let any other filter (type, status,
category, dateFrom, etc.) run first.

```typescript
// ✅ CORRECT — early return before any other filter
export function buildTransactionWhere(input, userId) {
  if (input.ids?.length) {
    return { userId, id: { in: input.ids } } satisfies Prisma.TransactionWhereInput;
  }
  // ... rest of filter logic
}
```

**Why**: matched transactions have already been re-categorised. The active tab filter
(`type: 'DEBIT'`, `category: 'Other'`, etc.) will exclude them → "No transactions
found" in the review panel. The early return bypasses all this.

---

## 2. `placeholderData` on the infinite query prevents unmount

**File**: `src/components/transactions/TransactionLedgerTable.tsx`

```typescript
trpc.transactionLedger.getAll.useInfiniteQuery(queryInput, {
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  placeholderData: (previousData) => previousData,  // ← REQUIRED
});
```

**Why**: when `queryInput` changes (e.g. `reviewBatch` is set, adding `ids`),
React Query clears the cached data immediately and starts a fresh fetch. Without
`placeholderData`, all `TransactionRow` components unmount for the duration of the
fetch, destroying local state including `showRulePrompt`.

---

## 3. `retainedRows` — Transfers tab only

**File**: `src/components/transactions/TransactionLedgerTable.tsx`

`retainedRows` keeps a row visible after it would be filtered out, so the user can
complete follow-up actions (e.g. linking a transfer pair). **This pattern is
intentionally scoped to the transfers tab only.**

```typescript
// Transfers tab: retain row when moving away from Transfer category
if (activeTab === 'transfers' && newCategory !== TRANSFER_CATEGORY) {
  setRetainedRows(prev => new Map(prev).set(id, { ...txData, category: newCategory }));
}
```

**Do NOT extend this to the general category-filter case.** When a user has a
category filter active (e.g. `Category: Other`) and changes a row to `Groceries`,
the row correctly leaves the view — that is expected behaviour. Retaining it for
every such change clutters the screen with many "Moved to X" banners that serve
no purpose and confuse the user.

The `CategoryRulePrompt` (amber banner) is therefore only shown when the row
**stays in the current view** after the category change. When the row would leave
the view, the rule prompt simply doesn't fire — this is intentional.

---

## 4. `useCategoryEdit` hook

**File**: `src/components/transactions/hooks/useCategoryEdit.ts`

Extracted from `TransactionRow` to own all category-change logic:

| Owns | Why here, not in component |
|---|---|
| `localCategory` + server sync | Needs to survive prop updates from cache |
| `showRulePrompt`, `showRuleDrawer`, `ruleCategory`, `similarCount` | Rule prompt lifecycle is async — lives with the timer |
| `isInReviewBatchRef` | Async timer callbacks need a live (non-stale) value |
| `similarCheckTimerRef` | 400 ms debounce before `categoryRule.findSimilar` |
| Cleanup on unmount | Cancels timer so stale `findSimilar` doesn't show prompt after unmount |

**Key invariant**: `setShowRulePrompt(false)` is called at the START of `handleChange`
to reset any previous prompt. It is NOT called when `isInReviewBatch` becomes `true` —
a prompt already visible should persist so the user can act on it.

---

## 5. Review batch lifecycle

```
User changes category
  → updateCategory mutation fires
  → onSuccess: matchedIds.length > 0?
      YES → setReviewBatch(matchedIds)     ← queryInput gains ids filter
              setPreReviewCategory(category) ← save to restore on exit
              toast (5 s)
      NO  → void refetch()                 ← retained row handles the filter-out case
              toast

Review banner → "Exit review" button
  → handleExitReview: setReviewBatch(null), setCategory(preReviewCategory)

Tab change / reset
  → setReviewBatch(null)  — NO filter restore (user navigated deliberately)
```

**`matchedIds` always includes the original**: the router appends
`matchedIds.unshift(transaction.id)` after bulk-applying so the row the user
directly edited is visible in the review panel alongside the auto-updated ones.

---

## 6. `applyToMatching` prevents recursive auto-apply

In `handleChange` inside `useCategoryEdit`:
```typescript
onCategoryChange(id, newCategory, undefined, undefined, !isInReviewBatch);
//                                                        ↑
// false when isInReviewBatch = true → router skips bulk-apply block
```

The router skips the `findMany` + bulk-update block when
`input.applyToMatching === false`. Category edits made during review are
single-row only — no re-entry into review.

---

## 7. `CategoryRulePrompt` is an actionable prompt — no auto-dismiss

`CategoryRulePrompt` renders as a `<tr>` immediately below the row that triggered it.
It has **no auto-dismiss timeout**. It disappears only when:
- User clicks "Create Rule" → opens `CategoryRuleDrawer`
- User clicks "✕" → `setShowRulePrompt(false)`
- The row unmounts (see §2 and §3 for how to prevent this)

The 400 ms value in `useCategoryEdit` is a **debounce** before the `findSimilar` API
call, not a display duration. Increasing it delays the prompt appearing without
making it more persistent.

---

## Interaction between `findSimilar` and `matchedIds`

These are **different queries** for different purposes:

| | `matchedIds` (router) | `findSimilar` (client hook) |
|---|---|---|
| Matching | Exact description match | Fuzzy / similar description |
| Purpose | Bulk auto-apply + review batch | Suggest creating a category rule |
| Trigger | On every `updateCategory` | 400 ms after category change (client-side) |
| Result | IDs updated server-side | Count only (no mutation) |

A transaction can have `matchedIds = []` (unique description → no review) yet
`findSimilar.count = 9` (fuzzy matches → rule prompt). Both paths are independent.
