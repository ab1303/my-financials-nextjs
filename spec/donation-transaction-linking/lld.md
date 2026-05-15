# Donation Transaction Linking — Low Level Design

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| 1 | `prisma/schema.prisma`, migration | Add optional `transactionId` FK on `DonationPayment` |
| 2 | `donation-link.service.ts` (new), `transaction-ledger.ts` tRPC router | Service + tRPC procedure for unlinked donation transactions |
| 3 | `UnlinkedTransactionsBanner.tsx` (new), `donations/page.tsx` | Server Component banner wired into Donations page |
| 4 | `LinkTransactionsDrawer.tsx` (new), `_types.ts`, `_schema.ts`, `actions.ts` | Drawer UI + schema/action updates for linking flow |
| 5 | `TransactionRow.tsx`, `transaction-ledger.ts` (getAll extend) | Transaction Ledger donation badge |

---

## Phase 1 — Schema Migration

### 1.1 Schema change

**File:** `prisma/schema.prisma`

```prisma
model DonationPayment {
  id               String              @id @default(cuid())
  datePaid         DateTime
  amount           Decimal             @db.Money
  beneficiaryType  BeneficiaryEnumType
  taxCategory      String
  business         Business?           @relation(fields: [businessId], references: [id])
  businessId       String?
  individual       Individual?         @relation(fields: [individualId], references: [id])
  individualId     String?
  donationLedger   DonationLedger      @relation(fields: [donationLedgerId], references: [id])
  donationLedgerId String
  transaction      Transaction?        @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId    String?             @unique
}

model Transaction {
  // ... all existing fields unchanged ...
  donationPayment  DonationPayment?   // back-reference only, no FK column added
}
```

### 1.2 Migration SQL

**File:** `prisma/migrations/<timestamp>_add_donation_payment_transaction_fk/migration.sql`

```sql
-- Add optional transactionId FK to DonationPayment
ALTER TABLE "DonationPayment"
  ADD COLUMN "transactionId" TEXT;

CREATE UNIQUE INDEX "DonationPayment_transactionId_key"
  ON "DonationPayment"("transactionId");

ALTER TABLE "DonationPayment"
  ADD CONSTRAINT "DonationPayment_transactionId_fkey"
  FOREIGN KEY ("transactionId")
  REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

### 1.3 TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| `DonationPayment` can be created with `transactionId = null` | Integration | Nullable — existing manual entries unaffected |
| `DonationPayment` can be created with a valid `transactionId` | Integration | FK accepted, back-relation resolves |
| Creating a second `DonationPayment` with the same `transactionId` throws unique constraint error | Integration | `@unique` enforced |
| Deleting a `Transaction` sets `DonationPayment.transactionId` to null (SetNull) | Integration | Cascade behaviour correct |

---

## Phase 2 — Service & tRPC Procedure

### 2.1 Donation Link Service

**File:** `src/server/services/transactions/donation-link.service.ts`

```typescript
import { prisma } from '@/server/db/client';

export interface UnlinkedDonationTransaction {
  id: string;
  date: string;         // ISO YYYY-MM-DD
  description: string;
  amount: number;
}

/**
 * Returns DEBIT CONFIRMED transactions with category "Gifts & donations"
 * that have no linked DonationPayment, within the given date range.
 */
export async function getUnlinkedDonationTransactions(
  userId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<UnlinkedDonationTransaction[]> {
  const DONATION_CATEGORY = 'Gifts & donations';

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: DONATION_CATEGORY, mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
      donationPayment: null,  // no linked DonationPayment
    },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, description: true, amount: true },
  });

  return rows.map((tx) => ({
    id: tx.id,
    date: tx.date.toISOString().slice(0, 10),
    description: tx.description,
    amount: Number(tx.amount),
  }));
}

/**
 * Returns the count of unlinked donation transactions for a fiscal year.
 * Fiscal year: fromYear-07-01 to toYear-06-30.
 */
export async function countUnlinkedDonationTransactions(
  userId: string,
  fromYear: number,
  toYear: number,
): Promise<number> {
  const dateFrom = new Date(fromYear, 6, 1);          // July 1
  const dateTo   = new Date(toYear,   5, 30, 23, 59, 59);  // June 30

  return prisma.transaction.count({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: 'Gifts & donations', mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
      donationPayment: null,
    },
  });
}
```

### 2.2 tRPC Procedure

**File:** `src/server/trpc/router/transaction-ledger.ts` — add to existing router:

```typescript
getUnlinkedDonationTransactions: protectedProcedure
  .input(
    z.object({
      dateFrom: z.string(), // ISO date string YYYY-MM-DD
      dateTo:   z.string(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userId   = ctx.session.user.id;
    const dateFrom = new Date(`${input.dateFrom}T00:00:00`);
    const dateTo   = new Date(`${input.dateTo}T23:59:59`);
    return getUnlinkedDonationTransactions(userId, dateFrom, dateTo);
  }),
```

Also extend `getAll` output type and query to include `isDonationLinked` on "Gifts & donations" DEBIT rows:

```typescript
// In getAll query — include donationPayment relation:
include: {
  bankAccount:     { select: { name: true, bank: { select: { name: true } } } },
  reimbursements:  { /* existing */ },
  donationPayment: { select: { id: true } },  // ADD THIS
},

// In output mapping — add to TransactionRow:
isDonationLinked: tx.category.toLowerCase() === 'gifts & donations' && tx.type === 'DEBIT'
  ? tx.donationPayment !== null
  : undefined,   // undefined for non-donation rows
```

Update `TransactionRow` interface:
```typescript
export interface TransactionRow {
  // ... existing fields ...
  isDonationLinked?: boolean;  // only present for "Gifts & donations" DEBIT rows
}
```

### 2.3 TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| `getUnlinkedDonationTransactions` returns only DEBIT CONFIRMED "Gifts & donations" transactions with no linked DonationPayment | Integration | Correct filter |
| `getUnlinkedDonationTransactions` excludes transactions already linked to a DonationPayment | Integration | `donationPayment: null` filter works |
| `getUnlinkedDonationTransactions` excludes transactions outside the given date range | Integration | Date range filter |
| `countUnlinkedDonationTransactions` returns 0 when all donations are linked | Integration | Count accuracy |
| `getAll` tRPC procedure returns `isDonationLinked: true` for a linked "Gifts & donations" DEBIT | Integration | Flag correctness |
| `getAll` tRPC procedure returns `isDonationLinked: undefined` for a non-donation DEBIT | Unit | No false positives |

---

## Phase 3 — Unlinked Transactions Banner

### 3.1 Banner Component

**File:** `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx`

```typescript
import { countUnlinkedDonationTransactions } from '@/server/services/transactions/donation-link.service';
import { auth } from '@/server/auth';
import LinkTransactionsDrawerTrigger from './LinkTransactionsDrawerTrigger';

interface UnlinkedTransactionsBannerProps {
  fromYear: number;
  toYear:   number;
  dateFrom: string;  // ISO YYYY-MM-DD for tRPC param passthrough
  dateTo:   string;
}

export default async function UnlinkedTransactionsBanner({
  fromYear,
  toYear,
  dateFrom,
  dateTo,
}: UnlinkedTransactionsBannerProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const count = await countUnlinkedDonationTransactions(
    session.user.id,
    fromYear,
    toYear,
  );

  if (count === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        🔗 <strong>{count}</strong> "Gifts &amp; donations" transaction
        {count !== 1 ? 's' : ''} from your bank import need recipient details.
      </p>
      <LinkTransactionsDrawerTrigger dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
}
```

**Note:** `LinkTransactionsDrawerTrigger` is a small `"use client"` wrapper that opens the drawer — required to pass an onClick from server to client.

### 3.2 Page Integration

**File:** `src/app/(authorized)/cashflow/donations/page.tsx` — add inside `selectedCalendarYear` block:

```typescript
const fromYear   = selectedCalendarYear.fromYear;
const toYear     = selectedCalendarYear.toYear;
const dateFrom   = `${fromYear}-07-01`;
const dateTo     = `${toYear}-06-30`;

// Inside JSX, above DonationPaymentsTableServer:
{selectedCalendarYear && (
  <Suspense fallback={null}>
    <UnlinkedTransactionsBanner
      fromYear={fromYear}
      toYear={toYear}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  </Suspense>
)}
```

### 3.3 TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| Banner renders when `count > 0` | Unit (React Testing Library) | Correct conditional render |
| Banner returns `null` when `count === 0` | Unit | No false banner shown |
| Banner shows correct count in message | Unit | Count interpolation |
| Banner not rendered when no fiscal year is selected | Integration | Guard condition in page.tsx |

---

## Phase 4 — Link Transactions Drawer

### 4.1 Types Update

**File:** `src/app/(authorized)/cashflow/donations/_types.ts`

```typescript
export type DonationPaymentType = {
  id:              string;
  datePaid:        Date;
  amount:          number;
  beneficiaryType: BeneficiaryEnumType;
  taxCategory:     string;
  beneficiaryId:   string;
  transactionId?:  string;  // ADD — undefined for manual entries
};
```

### 4.2 Schema Update

**File:** `src/app/(authorized)/cashflow/donations/_schema.ts`

```typescript
export const CreateDonationPaymentSchema = z.object({
  calendarYearId:  z.string().min(1),
  datePaid:        z.string().min(1),
  amount:          z.number().positive(),
  taxCategory:     z.string().min(1),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId:   z.string().min(1),
  transactionId:   z.string().optional(),  // ADD
});
```

### 4.3 Server Action Update

**File:** `src/app/(authorized)/cashflow/donations/actions.ts`

```typescript
export async function addRow(
  input: CreateDonationPaymentInput,
): Promise<ServerActionType<DonationPaymentType>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: 'Unauthorized' };

  // ... existing donation year creation ...

  const payment = await addDonationPaymentDetail(donationLedger.id, {
    datePaid:       new Date(input.datePaid),
    amount:         input.amount,
    taxCategory:    input.taxCategory,
    beneficiaryType: input.beneficiaryType,
    beneficiaryId:  input.beneficiaryId,
    transactionId:  input.transactionId,  // ADD — pass through
  });

  return { success: true, data: payment };
}
```

### 4.4 Drawer Component

**File:** `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { trpc } from '@/server/trpc/client';
import type { UnlinkedDonationTransaction } from '@/server/services/transactions/donation-link.service';

interface LinkTransactionsDrawerProps {
  isOpen:        boolean;
  onClose:       () => void;
  dateFrom:      string;
  dateTo:        string;
  calendarYearId: string;
  individualsOptions: OptionType[];
  businessesOptions:  OptionType[];
  onLinked:      () => void;  // callback to refresh parent
}

// Internal form shape
interface LinkFormValues {
  taxCategory:    string;
  beneficiaryType: 'INDIVIDUAL' | 'BUSINESS';
  beneficiaryId:  string;
}
```

**Key interactions:**
1. On mount: call `trpc.transactionLedger.getUnlinkedDonationTransactions.useQuery({ dateFrom, dateTo })`
2. User selects a transaction from the left panel → `selectedTx` state updated
3. Right panel form pre-fills date (display only) and amount (display only) from `selectedTx`
4. User fills: Tax Category (text input), Beneficiary Type (radio/select), Beneficiary (react-select)
5. On submit: call `addRow({ ...formValues, datePaid: selectedTx.date, amount: selectedTx.amount, transactionId: selectedTx.id, calendarYearId })`
6. On success: `toast.success('Donation linked!')`, call `onLinked()`, advance to next transaction in list
7. "Save & Next" button disabled when no transaction is selected or form is invalid
8. On drawer close: reset form and selected transaction

### 4.5 TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| Drawer lists all unlinked transactions returned by tRPC query | Unit (RTL) | Left panel renders correctly |
| Selecting a transaction locks date and amount fields | Unit (RTL) | Fields are read-only |
| Submitting calls `addRow` with correct `transactionId` | Unit (RTL + mock) | Payload correctness |
| On success, `onLinked` callback is fired | Unit (RTL + mock) | Refresh triggered |
| Drawer shows empty state when no unlinked transactions | Unit (RTL) | Empty state message |
| Form validation: submitting without beneficiary shows error | Unit (RTL) | Zod validation enforced |

---

## Phase 5 — Transaction Ledger Badge

### 5.1 TransactionRow Update

**File:** `src/components/transactions/TransactionRow.tsx`

Add badge rendering for "Gifts & donations" DEBIT rows using `isDonationLinked` flag from the updated `TransactionRow` interface:

```typescript
{tx.category.toLowerCase() === 'gifts & donations' && tx.type === 'DEBIT' && (
  <span className={clsx(
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
    tx.isDonationLinked
      ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  )}>
    {tx.isDonationLinked ? '🔗 Linked' : '⚠️ Needs recipient'}
  </span>
)}
```

### 5.2 TDD Test Cases

| Test description | Test type | What it verifies |
|---|---|---|
| "🔗 Linked" badge renders when `isDonationLinked === true` | Unit (RTL) | Correct badge for linked state |
| "⚠️ Needs recipient" badge renders when `isDonationLinked === false` | Unit (RTL) | Correct badge for unlinked state |
| No badge rendered for non-donation DEBIT rows | Unit (RTL) | No false positives |
| No badge rendered for CREDIT rows | Unit (RTL) | Type guard correct |

---

## Migration Notes

- Run `pnpm prisma migrate dev --name add_donation_payment_transaction_fk` after schema change
- Stop dev server before running migration (prevents EPERM file locks on Windows)
- No data backfill needed — `transactionId` is nullable; all existing `DonationPayment` rows remain valid with `transactionId = NULL`
- If rolling back: `ALTER TABLE "DonationPayment" DROP COLUMN "transactionId"` — safe, no data dependency

---

## Integration Edge Cases

| Case | Handling |
|---|---|
| User deletes a linked Transaction | `onDelete: SetNull` — `DonationPayment.transactionId` becomes null; payment is preserved |
| User deletes a DonationPayment that was linked | Transaction becomes "⚠️ Needs recipient" again |
| Fiscal year has no "Gifts & donations" transactions | Banner renders nothing (count = 0) |
| Same fiscal year has both linked and unlinked transactions | Banner shows count of unlinked only |
| User adds a manual DonationPayment (no transaction) via "+" button | `transactionId` is undefined/null — existing flow unchanged |
| "Gifts & donations" transaction category string has different casing | `mode: 'insensitive'` in Prisma query handles this |
