# Donation Transaction Linking — Context

## Problem

CSV DEBIT transactions classified as "Gifts & donations" are saved to the expense ledger but have no connection to the Donations page. The Donations page is a manual-entry system recording `DonationPayment` rows with beneficiary and tax-category metadata. There is no FK between `Transaction` and `DonationPayment`, forcing users to double-enter every donation.

---

## File Inventory

### Files to CREATE

| File | Purpose |
|---|---|
| `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx` | Server Component — count badge + "Link Transactions" CTA for current fiscal year |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | Client Component — two-panel slide-over: unlinked tx list (left) + enrich form (right) |
| `src/server/services/transactions/donation-link.service.ts` | Query unlinked donation transactions by fiscal year date range |
| `prisma/migrations/<timestamp>_add_donation_payment_transaction_fk/migration.sql` | Add optional `transactionId` FK to `DonationPayment` |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `transactionId String? @unique` + `transaction Transaction?` relation to `DonationPayment` |
| `src/server/trpc/router/transaction-ledger.ts` | Add `getUnlinkedDonationTransactions` procedure |
| `src/app/(authorized)/cashflow/donations/page.tsx` | Inject `<UnlinkedTransactionsBanner>` above payments table |
| `src/app/(authorized)/cashflow/donations/DonationTableServer.tsx` | Pass `transactionId` field through to client |
| `src/app/(authorized)/cashflow/donations/_types.ts` | Add `transactionId?: string` to `DonationPaymentType` |
| `src/app/(authorized)/cashflow/donations/actions.ts` | Accept optional `transactionId` in `addRow` |
| `src/app/(authorized)/cashflow/donations/_schema.ts` | Add `transactionId` optional field to `CreateDonationPaymentSchema` |
| `src/components/transactions/TransactionRow.tsx` | Add linked/unlinked badge for "Gifts & donations" DEBIT rows |

### Reference Files (read-only)

| File | Why |
|---|---|
| `src/app/(authorized)/cashflow/donations/DonationTableClient.tsx` | TanStack Table pattern to follow |
| `src/app/(authorized)/cashflow/donations/reducer.ts` | Immer/useReducer pattern |
| `src/app/(authorized)/cashflow/donations/_table/BeneficiarySelectionCell.tsx` | Beneficiary dropdown — reuse in drawer form |
| `src/server/services/donation.service.ts` | Existing CRUD pattern |
| `src/server/services/transactions/csv-confirm.service.ts` | How "Gifts & donations" transactions are created |

---

## Relevant Schema

```prisma
model Transaction {
  id                  String                @id @default(cuid())
  date                DateTime
  description         String
  amount              Decimal               @db.Money
  type                TransactionTypeEnum
  category            String
  offsetCategory      String?
  offsetTransactionId String?
  source              TransactionSourceEnum
  status              TransactionStatusEnum @default(PENDING)
  confirmedAt         DateTime?
  bankAccountId       String?
  userId              String
  importSessionId     String?
  // PROPOSED: donationPayment DonationPayment?
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
}

model DonationLedger {
  id         String            @id @default(cuid())
  calendarId String            @unique
  payments   DonationPayment[]
}

model DonationPayment {
  id               String              @id @default(cuid())
  datePaid         DateTime
  amount           Decimal             @db.Money
  beneficiaryType  BeneficiaryEnumType
  taxCategory      String
  businessId       String?
  individualId     String?
  donationLedgerId String
  // PROPOSED ADDITION:
  // transactionId String? @unique
  // transaction   Transaction? @relation(fields: [transactionId], references: [id])
}

model CalendarYear {
  id          String           @id @default(cuid())
  fromYear    Int
  toYear      Int
  type        CalendarEnumType // FISCAL | ZAKAT
  description String?
}

enum TransactionTypeEnum   { DEBIT CREDIT }
enum TransactionStatusEnum { PENDING CONFIRMED EXCLUDED }
enum BeneficiaryEnumType   { INDIVIDUAL BUSINESS }
```

**Expense category seed**: `{ name: 'Gifts & donations', iconName: 'gift' }` — the sentinel category string used to identify donation debits.

**Australian fiscal year**: July 1 (`fromYear`) → June 30 (`toYear`). E.g. FY2025 = `fromYear=2024, toYear=2025` → date range `2024-07-01` to `2025-06-30`.

---

## Existing Patterns to Reuse

### tRPC protected procedure
```typescript
// src/server/trpc/router/transaction-ledger.ts
export const transactionLedgerRouter = router({
  getUnlinkedDonationTransactions: protectedProcedure
    .input(z.object({ dateFrom: z.string(), dateTo: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      // ctx.prisma ...
    }),
});
```

### Server Action pattern (donations)
```typescript
'use server';
export async function addRow(input: CreateDonationPaymentInput): Promise<ServerActionType<DonationPaymentType>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, message: 'Unauthorized' };
  // ...
}
```

### State reducer dispatch (Immer)
```typescript
dispatch({ type: 'DONATION/Payments/ADD_PAYMENT', payload: newPayment });
```

---

## Data Flow

### Current (post-CSV-import)
```
CSV confirm → confirmDebitTransactions()
    → MonthlyExpenseSummary upsert (category="Gifts & donations")
    → Transaction(DEBIT, CONFIRMED, category="Gifts & donations") saved
    → [NO DonationPayment created — Donations page stays empty]
```

### Proposed (enrichment path)
```
User selects fiscal year on Donations page
  → Server query: count DEBIT CONFIRMED transactions WHERE
      category = "Gifts & donations"
      AND date BETWEEN fiscalYear.start AND fiscalYear.end
      AND id NOT IN (SELECT transactionId FROM DonationPayment WHERE transactionId IS NOT NULL)
  → UnlinkedTransactionsBanner: "3 donation transactions need recipient details"
  → User clicks "Link Transactions" → LinkTransactionsDrawer opens
      Left panel: list of unlinked transactions (date, amount, description)
      Right panel: form with date+amount locked, user fills taxCategory + beneficiaryType + beneficiary
  → Save → DonationPayment created WITH transactionId FK
  → "Save & Next" → advances to next unlinked transaction
  → On drawer close → Donations table refreshes
```

---

## Constraints & Gotchas

- `transactionId` must be `@unique` — one Transaction maps to at most one DonationPayment.
- Manual donations (no CSV) continue to work — `transactionId` is nullable.
- The `DonationLedger` must exist for the selected fiscal year before a `DonationPayment` can be created; the existing `addRow` action already handles this via `createDonationYearHandler`.
- The "Gifts & donations" category string is a plain string in `Transaction.category` — no enum. Compare case-insensitively or normalise at seed time.
- The `DonationLedger` has no `userId` — user scoping is through `Individual`/`Business` FK ownership. The banner must query `Transaction` (which has `userId`) to scope correctly.
