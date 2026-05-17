# Bank Account Management — Context

## Problem

The app has a `BankAccount` model (user's individual account at a bank institution) that is required for CSV imports — the upload step presents a dropdown of `BankAccount` records. However, there is **no UI to create, edit, or delete `BankAccount` records**. A new user with zero rows in the `BankAccount` table sees an empty dropdown and cannot import any CSV.

The existing `/settings/banks` page manages **bank institutions** (`Business` model with `type: 'BANK'`) only. Bank accounts are a separate, lower-level concept that links a user to one of those institutions with a specific account name.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/server/schema/bank-account.schema.ts` | Zod schemas: `createBankAccountSchema`, `deleteBankAccountSchema` |
| `src/server/services/bank-account.service.ts` | DB logic: `createBankAccount`, `getBankAccounts`, `deleteBankAccount` |
| `src/server/controllers/bank-account.controller.ts` | Handlers wrapping service with error handling |
| `src/server/trpc/router/bank-account.ts` | tRPC router: `create`, `list`, `delete` procedures |
| `src/app/(authorized)/settings/banks/_components/BankAccountsSection.tsx` | Client Component: table of existing accounts + inline create form |

### Files to MODIFY

| File | Change |
|---|---|
| `src/server/trpc/root.ts` | Register `bankAccountRouter` as `bankAccount` |
| `src/app/(authorized)/settings/banks/form.tsx` | Add `<BankAccountsSection>` below the bank institution card |
| `src/app/(authorized)/settings/banks/page.tsx` | Rename title; accommodate both sections |

---

## Schema Details

### `BankAccount` model (already in DB — no migration needed)

```prisma
// BankAccount — user's individual account at a bank
model BankAccount {
  id           String               @id @default(cuid())
  name         String               // e.g. "CBA Everyday Savings"
  bankId       String               // FK → Business (type=BANK)
  bank         Business             @relation(fields: [bankId], references: [id])
  userId       String
  user         User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  balanceRecords BankBalanceRecord[]
  createdAt    DateTime             @default(now())
  updatedAt    DateTime             @updatedAt

  @@unique([name, bankId, userId])     // prevents duplicate account names per user+bank
  @@index([userId, bankId])
  transactions Transaction[]
  debitTransferRules  TransferMatchRule[] @relation("debitRules")
  creditTransferRules TransferMatchRule[] @relation("creditRules")
}
```

### `Business` model (bank institution, already managed)

```prisma
model Business {
  id           String       @id @default(cuid())
  name         String
  type         BusinessType  // BANK | EMPLOYER | ...
  userId       String
  // address fields...
  bankAccounts BankAccount[]
}
```

**Key constraint**: `BankAccount` requires a valid `bankId` (FK → `Business` where `type = 'BANK'`). User must have at least one bank institution before creating a bank account. The UI must enforce this.

---

## Existing Patterns to Reuse

### tRPC router pattern
```typescript
// src/server/trpc/router/bank.ts — exact pattern to follow
import { router, protectedProcedure } from '@/server/trpc/trpc';
export const bankRouter = router({
  saveBankDetails: protectedProcedure.input(createBankSchema).mutation(({ input, ctx: { session } }) => ...),
  getAllBanks: protectedProcedure.query(() => allBankDetailsHandler()),
  removeBankDetails: protectedProcedure.input(params).mutation(({ input }) => ...),
});
```

### Service pattern
```typescript
// src/server/services/bank.service.ts
export const addBankDetails = async (input: Prisma.BusinessUncheckedCreateInput) => {
  return prisma.business.create({ data: { ...input } });
};
```

### Bank institution list (already available via tRPC)
`trpc.bank.getAllBanks.useQuery()` returns `Business[]` — reuse in the new BankAccounts section dropdown.

### Settings page structure
`src/app/(authorized)/settings/banks/form.tsx` — single Client Component with `Card` + `FormProvider`. Add `BankAccountsSection` as a second card below it.

### Delete pattern with confirmation
`src/components/ui/ConfirmationDialog` — used in ImportSessionHistory for undo/delete confirmations.

---

## Data Flow

### Current (broken for new users)
```
/cashflow/transactions → page.tsx fetches BankAccount.findMany(userId)
                      → TransactionsClient receives bankAccounts=[]
                      → CSVUploadStep dropdown is empty → user blocked
```

### Proposed
```
/settings/banks → user creates bank institution (already works)
               → user creates BankAccount linked to that institution
               → /cashflow/transactions dropdown now has entries → CSV import works
```

---

## Constraints and Gotchas

1. **No schema migration needed** — `BankAccount` model and table already exist.
2. **Bank must exist first** — the create form must show a dropdown of existing banks (`Business` type=BANK). If no banks exist, show an inline prompt: "Add a bank institution above first."
3. **Unique constraint** — `@@unique([name, bankId, userId])` — show a toast error if user tries to add a duplicate account name at the same bank.
4. **Cascading delete** — `BankAccount` has child `Transaction[]`, `BankBalanceRecord[]`, and `TransferMatchRule[]` relations. Deletion must be guarded: show a confirmation dialog and warn if the account has transactions.
5. **`getAllBanks` is not user-scoped** — current `bank.service.ts` `getBankDetails()` has no `userId` filter (`getBankDetails()` returns all banks). The bank account section should only show accounts for the current user (`userId` from session, not passed from client).
