# Transfer Counterpart Display — LLD

**Version:** 1.0
**Status:** Ready for implementation
**Branch base:** `feature/app-stability-v1`
**Feature branch:** `feature/transfer-counterpart-display`
**Worktree dir:** `C:\My Github\my-financials-transfer-counterpart-display`

---

## Problem

When a transaction is linked as a transfer pair, the row shows a chain-link icon but gives no information about **what it is linked to**. The user cannot see the counterpart's description, amount, date, or account without manually hunting for it in the ledger.

---

## Phase Map

| Phase | Files Changed | Description |
|-------|--------------|-------------|
| **1** | `src/server/trpc/router/transaction-ledger.ts` | Include counterpart fields in `getAll` query + map to output |
| **2** | `src/server/trpc/router/transaction-ledger.ts` | Add `transferCounterpart` shape to `TransactionRow` type |
| **3** | `src/components/transactions/TransactionRow.tsx` | Render counterpart summary chip inline on linked rows |

No schema changes. No new tRPC procedures. No migrations.

---

## Phase 1 — tRPC Query

### File: `src/server/trpc/router/transaction-ledger.ts`

**Current include (around line 244):**
```typescript
transferCounterpart: { select: { id: true } },
```

**Replace with:**
```typescript
transferLinkedTransaction: {
  select: {
    id: true,
    date: true,
    description: true,
    amount: true,
    type: true,
    bankAccount: { select: { name: true, bank: { select: { name: true } } } },
  },
},
transferCounterpart: {
  select: {
    id: true,
    date: true,
    description: true,
    amount: true,
    type: true,
    bankAccount: { select: { name: true, bank: { select: { name: true } } } },
  },
},
```

**Why both relations:** `transferLinkedTransaction` is the FK side (DEBIT holds the FK pointing to CREDIT). `transferCounterpart` is the back-relation (CREDIT's view). Exactly one will be non-null on any linked row.

**In the mapping block (after line ~289), replace:**
```typescript
transferCounterpartId: tx.transferCounterpart?.id ?? null,
```
**With:**
```typescript
transferCounterpartId: tx.transferCounterpart?.id ?? null, // keep for backwards compat
transferCounterpart: (() => {
  const raw = (tx as any).transferLinkedTransaction ?? tx.transferCounterpart ?? null;
  if (!raw) return null;
  return {
    id: raw.id,
    date: raw.date.toISOString(),
    description: raw.description,
    amount: Number(raw.amount),
    type: raw.type as string,
    bankAccountName: raw.bankAccount?.name ?? null,
    bankName: raw.bankAccount?.bank?.name ?? null,
  };
})(),
```

---

## Phase 2 — TransactionRow Type

### File: `src/server/trpc/router/transaction-ledger.ts`

Find the `TransactionRow` interface/type (near the top of the file) and add:

```typescript
transferCounterpart: {
  id: string;
  date: string;       // ISO string YYYY-MM-DD
  description: string;
  amount: number;
  type: string;
  bankAccountName: string | null;
  bankName: string | null;
} | null;
```

---

## Phase 3 — TransactionRow UI

### File: `src/components/transactions/TransactionRow.tsx`

**Find the existing transfer link icon block.** Search for `transferLinkedTransactionId` or `transferCounterpartId` in the JSX. There will be a section that renders a link icon or badge for already-linked rows.

**Add the counterpart chip immediately after that icon/badge:**

```tsx
{transaction.transferCounterpart && (
  <div className="mt-1 flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs dark:border-blue-800 dark:bg-blue-950/30">
    <span className="shrink-0 text-blue-500">⇄</span>
    <div className="min-w-0 flex-1">
      <span className="block truncate font-medium text-blue-800 dark:text-blue-300">
        {transaction.transferCounterpart.description}
      </span>
      <span className="block text-blue-600 dark:text-blue-400">
        {transaction.transferCounterpart.date.slice(0, 10)}
        {' · '}
        {transaction.transferCounterpart.bankAccountName ?? 'Unknown account'}
        {' · '}
        ${transaction.transferCounterpart.amount.toFixed(2)}
      </span>
    </div>
  </div>
)}
```

**Visual design intent:**
- Blue chip (distinct from teal reimbursement chip, distinct from amber warning)
- `⇄` bidirectional arrow signals inter-account movement
- Truncated description + date + account + amount on second line
- Dark mode variants included

---

## Current Code Reference

### TransactionRow prop/type shape (current — in `transaction-ledger.ts`)

```typescript
// Already present:
transferLinkedTransactionId: string | null;
transferCounterpartId: string | null;
isTransferClassified: boolean;

// NEW to add:
transferCounterpart: { id, date, description, amount, type, bankAccountName, bankName } | null;
```

### PrismaTransaction type (local, in `transaction-ledger.ts`)

This type is built inline via `prisma.transaction.findMany` return. The new include fields (`transferLinkedTransaction`, expanded `transferCounterpart`) will need to be reflected in this local type too. Check around line 30–70 for the `PrismaTransaction` type definition and extend it.

---

## Success Criteria

| # | Criterion |
|---|-----------|
| 1 | Linked DEBIT row shows blue chip with the CREDIT's description, date, account, amount |
| 2 | Linked CREDIT row shows blue chip with the DEBIT's description, date, account, amount |
| 3 | Unlinked rows show no chip (no regression) |
| 4 | Dark mode renders correctly |
| 5 | `pnpm run build` passes with zero TypeScript errors |
| 6 | No change to existing unlink flow or link mutation behaviour |

---

## Out of Scope

- Clicking the chip to navigate/scroll to the counterpart row (future)
- Any schema changes or migrations
- Changes to the Transfer Linking Drawer (already shows counterpart during linking)
