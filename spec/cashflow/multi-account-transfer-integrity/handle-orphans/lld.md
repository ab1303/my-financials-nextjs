# Handle Orphans — Low Level Design

## Overview

Introduces the **Orphaned Transfer** concept for single-sided transfer legs that will never
have a counterpart, and the `FinancialAccount.isTracked` flag that models the user's deliberate
choice about which accounts they import. Covers Phases 2 and 3:

- **Phase 2** (read-only, no migration): surface orphans via query + warning banner
- **Phase 3** (requires Prisma migration): schema additions + resolution UI

**Depends on:** `fix-transfer-exclusion` should be deployed first (exclusion guards must exist
before orphan resolution makes sense).

---

## Files to Modify / Create

| File | Change | Phase |
|---|---|---|
| `src/server/trpc/router/transfer.ts` *(or `transfer-match.ts`)* | Add `getOrphanedTransfers` query | 2 |
| `src/server/services/transactions/constants.ts` | Add `ORPHAN_RESOLUTION_DAYS` | 2 |
| `src/app/(authorized)/cashflow/expense/page.tsx` | Add `UnresolvedTransfersBanner` | 2 |
| `src/app/(authorized)/cashflow/income/page.tsx` *(or equivalent)* | Add `UnresolvedTransfersBanner` | 2 |
| `src/components/UnresolvedTransfersBanner.tsx` | New shared banner component | 2 |
| `prisma/schema.prisma` | Add `orphanResolution` enum + field, `isTracked` to FinancialAccount | 3 |
| `src/server/trpc/router/transfer.ts` | Add `resolveOrphan` mutation | 3 |
| Bank account settings UI *(locate existing page)* | Add `isTracked` toggle | 3 |
| Orphan resolution UI | New modal or drawer | 3 |

> Locate the transfer tRPC router by searching for `transferLinkedTransactionId` in `src/server/trpc/router/`.
> Locate the bank account settings page by searching for `FinancialAccount` in `src/app/`.

---

## 1. The Orphan States

An **orphaned transfer** is a transaction that satisfies all three conditions:
1. `category = 'Transfer'` (user or LLM assigned)
2. `transferLinkedTransactionId IS NULL` (not linked to a counterpart)
3. `date < NOW() - ORPHAN_RESOLUTION_DAYS` (the match window has closed)

```typescript
// src/server/services/transactions/constants.ts — ADD:
export const ORPHAN_RESOLUTION_DAYS = 30; // days after import before orphan flag triggers
```

### Why `ORPHAN_RESOLUTION_DAYS`?

The transfer matching job runs post-import. A 30-day buffer prevents false-positive orphan
flags while the user is still in the process of importing the counterpart account's CSV.
After 30 days without a match, the transfer is almost certainly a true orphan.

---

## 2. Phase 2 — Orphan Surfacing (No Schema Changes)

### 2.1 tRPC Procedure — `transfer.getOrphanedTransfers`

```typescript
getOrphanedTransfers: protectedProcedure
  .input(z.object({
    bankAccountId: z.string().optional(),
  }))
  .query(async ({ ctx, input }) => {
    const cutoffDate = subDays(new Date(), ORPHAN_RESOLUTION_DAYS);

    return ctx.prisma.transaction.findMany({
      where: {
        userId: ctx.session.user.id,
        category: TRANSFER_CATEGORY,
        transferLinkedTransactionId: null,
        date: { lt: cutoffDate },
        // Phase 3: add orphanResolution: null once schema exists
        ...(input.bankAccountId && { bankAccountId: input.bankAccountId }),
      },
      include: {
        bankAccount: { select: { name: true, institutionName: true } },
      },
      orderBy: { date: 'desc' },
    });
  }),
```

### 2.2 `UnresolvedTransfersBanner` Component

Create a new **shared** component (used by both Expense and Income pages):

```typescript
// src/components/UnresolvedTransfersBanner.tsx
// Server Component — receives count as prop

interface UnresolvedTransfersBannerProps {
  count: number;
  href: string;
}

export function UnresolvedTransfersBanner({ count, href }: UnresolvedTransfersBannerProps) {
  if (count === 0) return null;

  return (
    <Alert color="warning" icon={HiExclamationTriangle} className="mb-4">
      <span className="font-medium dark:text-yellow-200">
        {count} unresolved transfer{count > 1 ? 's' : ''}
      </span>{' '}
      may be inflating your figures.{' '}
      <Link href={href} className="underline font-medium">
        Review now →
      </Link>
    </Alert>
  );
}
```

Place in `src/components/` (not inside any feature `_components/` folder — used by 2+ pages).

### 2.3 Add Banner to Expense Page

```typescript
// src/app/(authorized)/cashflow/expense/page.tsx (Server Component)

// Add to data fetching:
const orphanedTransfers = await api.transfer.getOrphanedTransfers.query();

// Add to render output (above the main expense content):
<UnresolvedTransfersBanner
  count={orphanedTransfers.length}
  href="/cashflow/transactions?tab=transfers"
/>
```

Repeat the same pattern for the Income page.

---

## 3. Phase 3 — Schema + Orphan Resolution (Requires Migration)

### 3.1 Schema Additions

```prisma
// prisma/schema.prisma

// Add new enum:
enum TransferOrphanResolution {
  EXCLUDED    // User confirmed: single-sided transfer, exclude from all reports
  EXPENSE     // User confirmed: re-categorised as real expense
  INCOME      // User confirmed: re-categorised as real income
}

// Add to Transaction model:
model Transaction {
  // ... existing fields ...
  orphanResolution   TransferOrphanResolution?  // null = unresolved orphan
}

// Add to FinancialAccount model:
model FinancialAccount {
  // ... existing fields ...
  isTracked  Boolean  @default(true)
  // true  = user imports CSVs from this account; transfers between two tracked accounts are neutral
  // false = off-budget; transfers to/from this account count as expense/income
}
```

**Migration command** (run after stopping the dev server):
```bash
pnpm prisma migrate dev --name add-orphan-resolution-and-tracked-account
```

### 3.2 `isTracked` Toggle in Bank Account Settings UI

On the existing bank account settings page, add a toggle per account:

```tsx
// Flowbite Toggle component — add to each FinancialAccount row
<ToggleSwitch
  checked={account.isTracked}
  label="Track this account (I import CSVs from it)"
  onChange={(checked) => updateAccountTracking({ id: account.id, isTracked: checked })}
/>
```

When `isTracked = false`:
- Outbound transfers to this account (DEBIT): user categorises them as real expenses — money left their tracked universe
- Inbound transfers from this account (CREDIT): user categorises them as real income — money entered their tracked universe
- No automatic transfer matching is attempted against this account

Add a `updateTracking` tRPC mutation:

```typescript
updateTracking: protectedProcedure
  .input(z.object({
    accountId: z.string(),
    isTracked: z.boolean(),
  }))
  .mutation(async ({ ctx, input }) => {
    return ctx.prisma.financialAccount.update({
      where: { id: input.accountId, userId: ctx.session.user.id },
      data: { isTracked: input.isTracked },
    });
  }),
```

### 3.3 tRPC Procedure — `transfer.resolveOrphan`

```typescript
resolveOrphan: protectedProcedure
  .input(z.object({
    transactionId: z.string(),
    resolution: z.enum(['EXCLUDED', 'EXPENSE', 'INCOME']),
    newCategory: z.string().optional(), // required when resolution is EXPENSE or INCOME
  }))
  .mutation(async ({ ctx, input }) => {
    // Guard: verify it IS an orphaned transfer owned by this user
    const tx = await ctx.prisma.transaction.findFirstOrThrow({
      where: {
        id: input.transactionId,
        userId: ctx.session.user.id,
        category: TRANSFER_CATEGORY,
        transferLinkedTransactionId: null,
      },
    });

    if ((input.resolution === 'EXPENSE' || input.resolution === 'INCOME') && !input.newCategory) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'newCategory required for EXPENSE/INCOME resolution' });
    }

    return ctx.prisma.transaction.update({
      where: { id: input.transactionId },
      data: {
        orphanResolution: input.resolution,
        // Re-categorise if user chose EXPENSE or INCOME
        ...(input.resolution !== 'EXCLUDED' && input.newCategory
          ? { category: input.newCategory }
          : {}),
      },
    });
    // Caller must revalidate affected cashflow pages after this mutation
  }),
```

### 3.4 Orphan Resolution UI

Add an **"Orphaned Transfers"** section to the existing Transfers tab
(`/cashflow/transactions?tab=transfers`), or a dedicated `/cashflow/transfer-review` page.

For each orphaned transfer, present three choices:

| Choice | What it does |
|---|---|
| **"It's a real expense"** | `resolution: 'EXPENSE'` + user picks category → appears in Expense totals |
| **"It's a real income"** | `resolution: 'INCOME'` + user picks category → appears in Income totals |
| **"Exclude (single-sided transfer)"** | `resolution: 'EXCLUDED'` → excluded from all aggregations, stays in Transfers tab with "Orphan (excluded)" chip |

> **Design decision:** `EXCLUDED` orphans should still appear in the Transfers tab with a
> distinguishing chip so users can audit their exclusion decisions. They should NOT appear in
> the `getOrphanedTransfers` query once resolved (add `orphanResolution: null` guard there).

### 3.5 Update `getOrphanedTransfers` Query (Phase 3 addition)

Once the schema migration is applied, add the null guard to exclude already-resolved orphans:

```typescript
where: {
  // ... existing filters ...
  orphanResolution: null, // Only show unresolved orphans
}
```

---

## 4. Acceptance Criteria

### Phase 2 (no schema required)
- [ ] `getOrphanedTransfers` returns transactions where `category = 'Transfer'`, `transferLinkedTransactionId IS NULL`, and `date < NOW() - 30 days`
- [ ] Expense page shows `UnresolvedTransfersBanner` when orphaned count > 0
- [ ] Income page shows `UnresolvedTransfersBanner` when orphaned count > 0
- [ ] Banner links to the Transfers tab

### Phase 3 (after migration)
- [ ] `prisma migrate dev` completes without errors for `add-orphan-resolution-and-tracked-account`
- [ ] `FinancialAccount.isTracked` defaults to `true` for all existing and new accounts
- [ ] Bank account settings UI shows the `isTracked` toggle
- [ ] `resolveOrphan` mutation succeeds for all three resolution types
- [ ] After resolving as `EXCLUDED`: transaction does not appear in any expense or income aggregate; still appears in Transfers tab with "Orphan (excluded)" chip
- [ ] After resolving as `EXPENSE`: transaction appears in Expense page with the user-selected category
- [ ] After resolving as `INCOME`: transaction appears in Income totals with the user-selected category
- [ ] `getOrphanedTransfers` no longer returns resolved orphans (`orphanResolution IS NOT NULL`)
- [ ] `resolveOrphan` is reversible: setting `orphanResolution = null` re-opens the orphan for re-resolution

---

## 5. Implementation Notes

- **Phase 2 is safe to ship independently** before Phase 3 — the banner is read-only and uses
  existing schema fields only.
- **Stop the dev server** before running `prisma migrate dev` (Windows EPERM risk).
- **Commit `schema.prisma` AND the new migration SQL together** in a single commit.
- **Do not** run `pnpm lint --fix`, global formatters, or `prisma db push`. Touch only files listed above.
