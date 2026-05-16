# Transfer Reconciliation — Context

**Feature:** `transfer-reconciliation`
**Status:** Specced — ready for implementation

---

## Problem Summary

Inter-account transfers appear on both sides when users upload CSVs from multiple bank accounts. The debit side (sending account) is always classified as a real expense because `"Transfer"` is not a debit category in the LLM classifier prompt — it only exists for credit classification. This inflates `MonthlyExpenseSummary` totals with phantom spending. The credit side is partially mitigated (`EXCLUDED` status) but the two sides are never linked, making reconciliation and auditing impossible.

---

## File Inventory

### Files to MODIFY

| File | Change |
|------|--------|
| `src/server/services/ai-import/csv-classifier.service.ts` | Add `'Transfer'` to debit classifier system prompt and output type |
| `src/server/services/transactions/csv-confirm.service.ts` | Skip `MonthlyExpenseSummary` when debit category is `'Transfer'`; set `status=EXCLUDED` |
| `src/server/services/transactions/constants.ts` | Add `TRANSFER_CATEGORY` and `EXCLUDED_DEBIT_LABELS` constants |
| `src/server/services/transactions/_types.ts` | Add `TransferLinkResult`, `TransferCandidateScore` types |
| `src/server/trpc/router/transaction-ledger.ts` | Expose `transferLinkedTransactionId` in `TransactionRow`; add `transferOnly` filter |
| `prisma/schema.prisma` | Add `transferLinkedTransactionId`, `preLinkCategory`, `preLinkStatus` to `Transaction` |
| `src/app/(authorized)/cashflow/transactions/_components/csv/_types.ts` | Add `transferLinkedTransactionId` to local transaction type |

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/server/services/transactions/transfer.service.ts` | Candidate scoring, link/unlink mutations, rollup reversal |
| `src/server/trpc/router/transfer.ts` | tRPC router: `getCandidates`, `link`, `unlink`, `getUnmatched`, `getPairs` |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/TransferLinkDrawer.tsx` | Candidate match UI — shows scored candidates, confirm/cancel |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/UnmatchedTransfersBadge.tsx` | Badge/alert showing count of unmatched transfer-classified transactions |
| `src/app/(authorized)/cashflow/transactions/_components/transfer/_types.ts` | Shared UI types for transfer linking |
| `prisma/migrations/{timestamp}_add_transfer_link/migration.sql` | Auto-generated; adds 3 nullable columns |

### Files to REFERENCE (unchanged)

| File | Why Referenced |
|------|---------------|
| `src/server/services/transactions/ledger.service.ts` | `rerollupExpenseSummary()` — reused to reverse expense rollup when debit is linked |
| `src/server/services/transactions/dedup.service.ts` | Pattern for batch pre-fetch + in-memory Set lookup |
| `src/server/services/transactions/donation-link.service.ts` | Pattern for cross-entity linking service |
| `src/server/trpc/router/transaction-ledger.ts` | Existing `updateCategory` / `applyReimbursementOffset` patterns |

---

## Verbatim Schema — Relevant Models

```prisma
enum TransactionSourceEnum {
  LLM_CLASSIFIED
  USER_OVERRIDE
}

enum TransactionStatusEnum {
  PENDING
  CONFIRMED
  EXCLUDED
  VOIDED
}

// Transaction — staging record for every line in a CSV or AI-extracted receipt
model Transaction {
  id                  String                @id @default(cuid())
  date                DateTime
  description         String
  amount              Decimal               @db.Money
  type                TransactionTypeEnum
  category            String
  offsetCategory      String?               // non-null only when category = 'Reimbursement'
  offsetTransactionId String?
  source              TransactionSourceEnum
  status              TransactionStatusEnum @default(PENDING)
  confirmedAt         DateTime?

  bankAccount         BankAccount?          @relation(fields: [bankAccountId], references: [id])
  bankAccountId       String?
  user                User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String
  importSession       ImportSession?        @relation(fields: [importSessionId], references: [id])
  importSessionId     String?

  offsetTransaction Transaction?  @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements    Transaction[] @relation("ReimbursementLink")
  donationPayment   DonationPayment?
  incomeRecord      IncomeRecord?

  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}
```

### Proposed Schema Additions

```prisma
model Transaction {
  // ... all existing fields ...

  // Transfer reconciliation (Phase 1B)
  transferLinkedTransactionId  String?                @unique
  transferLinkedTransaction    Transaction?           @relation("TransferLink", fields: [transferLinkedTransactionId], references: [id])
  transferCounterpart          Transaction?           @relation("TransferLink")
  preLinkCategory              String?                // Original category before linking (for safe unlink)
  preLinkStatus                TransactionStatusEnum? // Original status before linking (for safe unlink)
}
```

---

## Existing Patterns to Reuse

### Reimbursement Link Pattern (self-referential 1:1)

The `offsetTransaction` / `ReimbursementLink` relation on `Transaction` is the exact same structure needed for transfer linking. Both are:
- Self-referential 1:1 on the `Transaction` model
- Optional (nullable FK)
- Used to link two transactions that represent two sides of one financial event

Transfer link adds a **second** named self-relation `"TransferLink"` alongside `"ReimbursementLink"`.

### `rerollupExpenseSummary` in `ledger.service.ts`

```typescript
export async function rerollupExpenseSummary(params: {
  prismaClient: PrismaClient;
  userId: string;
  oldCategory: string;
  newCategory: string;
  amount: Decimal;
  date: Date;
}): Promise<void>
```

Called whenever a confirmed debit's category changes. When linking a debit as a transfer, call with `newCategory: 'Transfer'` to move the amount out of the original expense category.

### `EXCLUDED_CREDIT_LABELS` in `constants.ts`

```typescript
export const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'] as const;
```

Phase 1A adds a parallel constant for debits:

```typescript
export const TRANSFER_CATEGORY = 'Transfer' as const;
export const EXCLUDED_DEBIT_LABELS = ['Transfer'] as const;
```

### `confirmDebitTransactions` in `csv-confirm.service.ts`

Currently writes `MonthlyExpenseSummary` for ALL confirmed debits. Phase 1A adds a guard:

```typescript
if (EXCLUDED_DEBIT_LABELS.includes(tx.category as typeof EXCLUDED_DEBIT_LABELS[number])) {
  // Save Transaction(EXCLUDED) — skip MonthlyExpenseSummary
  await createTransactionRecord({ ..., status: TransactionStatusEnum.EXCLUDED });
  continue;
}
```

### tRPC Router Pattern (from `transaction-ledger.ts`)

```typescript
import { router, protectedProcedure } from '@/server/trpc/trpc';

export const transferRouter = router({
  getCandidates: protectedProcedure
    .input(getCandidatesSchema)
    .query(async ({ ctx, input }) => { ... }),
  link: protectedProcedure
    .input(linkSchema)
    .mutation(async ({ ctx, input }) => { ... }),
});
```

---

## Data Flow — Current vs Proposed

### Current Debit Transfer Flow (broken)

```
ANZ Savings CSV → classify → LLM assigns "Groceries" (or random expense) to "Transfer to Current"
                           → confirmDebitTransactions()
                           → MonthlyExpenseSummary["Groceries"] += $500  ← PHANTOM EXPENSE
                           → Transaction(DEBIT, CONFIRMED, category="Groceries")

ANZ Current CSV → classify → LLM assigns "Transfer" to "Transfer from Savings"  
                           → confirmCreditTransactions()
                           → Transaction(CREDIT, EXCLUDED, category="Transfer")   ← orphan
```

### Proposed Debit Transfer Flow (Phase 1A + 1B)

```
ANZ Savings CSV → classify → LLM assigns "Transfer" to "Transfer to Current"  ← NEW
                           → confirmDebitTransactions()
                           → EXCLUDED_DEBIT_LABELS check → skip MonthlyExpenseSummary  ← NEW
                           → Transaction(DEBIT, EXCLUDED, category="Transfer")

ANZ Current CSV → classify → LLM assigns "Transfer" to "Transfer from Savings"
                           → Transaction(CREDIT, EXCLUDED, category="Transfer")

Phase 1B → User opens TransactionLedgerTable → sees "Transfer" tab
         → Clicks "Link as Transfer" on the DEBIT row
         → TransferLinkDrawer shows scored candidates from OTHER accounts
         → User confirms match
         → transfer.link() mutation:
             - Sets transferLinkedTransactionId on both rows
             - Both status=EXCLUDED, category="Transfer"
             - If debit was previously CONFIRMED: rerollupExpenseSummary(oldCat → 'Transfer')
             - If credit had IncomeRecord: delete it
```

---

## LLM Classifier — Current State

### `classifyTransactions` (debit classifier) — `csv-classifier.service.ts`

**System prompt (current):**
```
You are a financial transaction classifier for an Australian personal finance app.
Classify each bank transaction description into exactly one of the following expense categories.
Available categories:
- [dynamic list from ExpenseCategory table]

Rules:
- Use ONLY the exact category names listed above.
- If uncertain, use closest match — never return null or "Other".
```

❌ `Transfer` is **NOT in the available categories** for debits. The LLM will classify transfer debits as the nearest expense category.

### `classifyCreditTransactions` (credit classifier)

**System prompt (current) includes:**
```
- Transfer: internal bank transfer (savings, offset)
```

✅ `Transfer` IS available for credits.

**Phase 1A fix:** Add `Transfer` to the debit system prompt categories and instruct the LLM:
```
- Transfer: money moved between your own bank accounts (savings, current, offset, mortgage)
```

---

## Known Constraints & Gotchas

1. **`@unique` on `transferLinkedTransactionId`** enforces 1:1 — one transaction cannot be in two transfer pairs. This is correct behaviour.

2. **Self-referential FK in Prisma** requires careful migration ordering. The column is nullable so the migration is non-breaking.

3. **`rerollupExpenseSummary` assumes `ExpenseCategory` exists** for both old and new category. `'Transfer'` is NOT an `ExpenseCategory` — it's a string label. The function handles `newCategory` not found gracefully (skips upsert), so this is safe.

4. **Month boundary edge case**: A debit on March 31 and credit on April 1 belong to different `MonthlyExpenseSummary` months. The link is still valid; the rollup reversal targets the debit's month only.

5. **`preLinkStatus` is needed for unlink**: Without it, unlinking a previously-CONFIRMED debit would need to re-infer whether it should be CONFIRMED or EXCLUDED, which requires replaying business rules.

6. **`incomeRecord` on Transaction**: The `Transaction` model has a 1:1 `incomeRecord` relation. When linking a credit that was previously CONFIRMED (rare), the orphaned `IncomeRecord` must be deleted in the `transfer.link` mutation.
