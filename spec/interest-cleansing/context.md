# Interest Cleansing — Context

## Problem

The `bank-interest` page was built before the transaction ledger became the source of truth. It is a fully manual island: the user types `amountDue` per month and records payments in a bespoke `BankInterestPayment` model that has no connection to the `Transaction` ledger or the `DonationPayment` model. In Islamic finance, interest received (riba) must be donated in full to charity. The cleansing payments ARE donations, yet they are tracked in a separate model with no linkage. The goal is to make the transaction ledger the source of truth for interest received, and `DonationPayment` the source of truth for cleansing payments, with a clear per-month audit trail.

---

## File Inventory

### Files to CREATE

| File | Purpose |
|---|---|
| `src/app/(authorized)/cashflow/bank-interest/_components/UnlinkedInterestBanner.tsx` | Server Component — count badge + "Cleanse Now" CTA for interest transactions not yet cleansed |
| `src/app/(authorized)/cashflow/bank-interest/_components/CleanseDonationDrawer.tsx` | Client Component — slide-over with mode toggle: "Link to transaction" vs "Manual entry" |
| `src/server/services/bank-interest/interest-cleansing.service.ts` | Query interest CREDIT transactions and their cleansing donations; compute derived per-month summary |
| `prisma/migrations/<timestamp>_add_donation_purpose_enum/migration.sql` | Add `DonationPurposeEnum` and `donationPurpose` column to `DonationPayment`; backfill existing rows |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `DonationPurposeEnum { VOLUNTARY INTEREST_CLEANSING }`; add `donationPurpose` field to `DonationPayment`; add deprecation comment to `BankInterestPayment` |
| `src/server/trpc/router/bank-interest.ts` | Add `getInterestCleansingData` and `getUnlinkedInterestTransactions` procedures |
| `src/server/services/bank-interest.service.ts` | `amountDue` on `BankInterestLiability` becomes a manual override field (not primary source); add helpers to merge derived and manual amounts |
| `src/app/(authorized)/cashflow/bank-interest/BankInterestTableServer.tsx` | Fetch cleansing summary per month; inject into state provider; render `UnlinkedInterestBanner` above table |
| `src/app/(authorized)/cashflow/bank-interest/BankInterestTableClient.tsx` | Replace editable `amountDue` cell with derived read-only display; add Status badge column; open `CleanseDonationDrawer` |
| `src/app/(authorized)/cashflow/bank-interest/_types.ts` | Add `amountReceived`, `amountCleansed`, `balance`, `status`, `uncleansedTxCount` to `BankInterestType` |
| `src/app/(authorized)/cashflow/bank-interest/reducer.ts` | Add `BANK_INTEREST/SET_CLEANSING_SUMMARY` action |
| `src/app/(authorized)/cashflow/bank-interest/page.tsx` | Add summary cards (received / cleansed / remaining) above the form |

### Reference Files (read-only)

| File | Why |
|---|---|
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | Two-panel drawer pattern + mode form structure to reuse |
| `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx` | Banner pattern with count badge |
| `src/app/(authorized)/cashflow/donations/actions.ts` | `addRow` Server Action — reuse for creating `DonationPayment(INTEREST_CLEANSING)` |
| `src/server/trpc/router/transaction-ledger.ts` | `getUnlinkedDonationTransactions` — same query pattern for interest CREDIT transactions |
| `src/app/(authorized)/cashflow/bank-interest/reducer.ts` | Immer/useReducer pattern — extend, do not replace |
| `src/app/(authorized)/cashflow/bank-interest/_components/PaymentHistoryModal.tsx` | Existing manual payment entry UI — migrate logic into `CleanseDonationDrawer` manual mode |

---

## Relevant Schema

### Current (verbatim)

```prisma
enum DonationPurposeEnum {   // DOES NOT EXIST YET — proposed addition
  VOLUNTARY
  INTEREST_CLEANSING
}

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
  // PROPOSED ADDITION:
  // donationPurpose DonationPurposeEnum @default(VOLUNTARY)
}

// BankInterestPayment — DEPRECATED after migration; cleansing payments become DonationPayment(INTEREST_CLEANSING)
model BankInterestPayment {
  id                      String                 @id @default(cuid())
  datePaid                DateTime
  amount                  Decimal                @db.Money
  business                Business?              @relation(fields: [businessId], references: [id])
  businessId              String?
  bankInterestLiability   BankInterestLiability? @relation(fields: [bankInterestLiabilityId], references: [id])
  bankInterestLiabilityId String?
}

// BankInterestLiability — amountDue becomes a MANUAL OVERRIDE field; primary source shifts to Transaction ledger
model BankInterestLiability {
  id         String                @id @default(cuid())
  month      Int
  year       Int
  amountDue  Decimal               @db.Money  // manual override when no CSV coverage
  bank       Business              @relation(fields: [bankId], references: [id])
  bankId     String
  calendar   CalendarYear          @relation(fields: [calendarId], references: [id], onDelete: Restrict)
  calendarId String
  payments   BankInterestPayment[]
}

model Transaction {
  id                  String                @id @default(cuid())
  date                DateTime
  description         String
  amount              Decimal               @db.Money
  type                TransactionTypeEnum   // CREDIT = interest received
  category            String                // sentinel: "Bank Interest"
  offsetCategory      String?
  offsetTransactionId String?
  source              TransactionSourceEnum
  status              TransactionStatusEnum @default(PENDING)
  confirmedAt         DateTime?
  bankAccount         BankAccount?          @relation(fields: [bankAccountId], references: [id])
  bankAccountId       String?
  userId              String
  donationPayment     DonationPayment?      // reverse relation (already exists)
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt

  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
}

model BankAccount {
  id      String    @id @default(cuid())
  name    String
  bankId  String
  bank    Business  @relation(fields: [bankId], references: [id])
  userId  String
  // ...
  transactions Transaction[]
}

enum TransactionTypeEnum   { DEBIT CREDIT }
enum TransactionStatusEnum { PENDING CONFIRMED EXCLUDED }
enum BeneficiaryEnumType   { INDIVIDUAL BUSINESS }
enum CalendarEnumType      { ZAKAT ANNUAL FISCAL }
```

### Key Relationships for This Feature

```
Business (BANK)
  └── BankAccount[]
        └── Transaction(CREDIT, category="Bank Interest")
              └── DonationPayment(INTEREST_CLEANSING)?   ← new linkage

Business (BANK)
  └── BankInterestLiability (month, year, amountDue as override)
        └── BankInterestPayment[]                        ← deprecated; migrate to DonationPayment
```

**Category sentinel**: `"Bank Interest"` — the plain-string `Transaction.category` value that identifies interest CREDIT transactions. Case-insensitive comparison recommended.

---

## Existing Patterns to Reuse

### Derived per-month interest summary (tRPC protected procedure)

```typescript
// src/server/trpc/router/bank-interest.ts
getInterestCleansingData: protectedProcedure
  .input(z.object({ bankId: z.string(), calendarYearId: z.string() }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    // 1. Find all BankAccounts for bankId owned by userId
    // 2. Query CREDIT transactions WHERE category ILIKE "Bank Interest"
    //    AND bankAccountId IN (those accounts) AND date IN calendar range
    //    AND status = CONFIRMED
    // 3. Load DonationPayment(INTEREST_CLEANSING) WHERE transactionId IN (those tx ids)
    // 4. Load BankInterestLiability (manual overrides) for bankId + calendarYearId
    // 5. Group by month → compute receivedFromLedger, manualOverride, amountCleansed, balance
  }),
```

### Cleansing donation Server Action (reuse donations/actions.ts addRow)

```typescript
// Reuse existing addRow with donationPurpose: 'INTEREST_CLEANSING'
await addRow({
  datePaid,
  amount,
  taxCategory,
  beneficiaryType,
  beneficiaryId,
  calendarYearId,
  transactionId: linkedTransactionId ?? undefined,  // null for manual path
  donationPurpose: 'INTEREST_CLEANSING',
});
```

### Mode-toggled drawer (new pattern)

```typescript
// CleanseDonationDrawer internal state
type DrawerMode = 'linked' | 'manual';
const [mode, setMode] = useState<DrawerMode>('linked');
// 'linked': left panel shows unlinked interest CREDIT transactions; amount locked
// 'manual': no transaction selection; amount field editable; datePaid editable
```

---

## Data Flow

### Current (fully manual)

```
User opens bank-interest page
  → Selects bank + year
  → BankInterestLiability rows created for 12 months (amountDue = 0)
  → User manually types amountDue per month
  → User clicks "Payments" icon → PaymentHistoryModal opens
  → User manually enters datePaid + amount → BankInterestPayment created
  → [NO connection to Transaction ledger]
  → [NO connection to DonationPayment]
```

### Proposed (ledger-first with manual fallback)

```
CSV import confirms CREDIT transactions (category="Bank Interest")
  → Transaction(CREDIT, CONFIRMED, category="Bank Interest") saved to ledger

User opens bank-interest page
  → Selects bank + year
  → getInterestCleansingData query:
      - Aggregates CREDIT "Bank Interest" tx by month → receivedFromLedger
      - Merges BankInterestLiability.amountDue (manual override) for months with no CSV
      - Loads linked DonationPayment(INTEREST_CLEANSING) → amountCleansed per month
      - Computes balance = (receivedFromLedger + manualOverride) - amountCleansed
  → Summary cards: Total Received / Total Cleansed / Remaining
  → UnlinkedInterestBanner: "N interest transactions need cleansing"
  → Monthly table: Month | Received | Cleansed | Balance | Status badge

User clicks "Cleanse Now" in banner OR row action:
  → CleanseDonationDrawer opens
      Mode A (Linked): left panel = unlinked interest CREDITs, right panel = enrichment form
        → amount + date locked from tx; user enters taxCategory + beneficiary
        → Save → DonationPayment(INTEREST_CLEANSING, transactionId=tx.id) created
      Mode B (Manual): no tx list; user enters date + amount + taxCategory + beneficiary
        → Save → DonationPayment(INTEREST_CLEANSING, transactionId=null) created
  → On close → table refreshes via router.refresh()
```

---

## Constraints & Gotchas

- `Transaction.category = "Bank Interest"` is a plain string — compare case-insensitively or normalise the seed value.
- A `BankAccount.bankId` links to `Business.id`; the interest query must join through `BankAccount` to scope by bank, not by `bankAccountId` alone.
- `DonationLedger` is scoped to a `CalendarYear` (ANNUAL type), not FISCAL. The existing `createDonationYearHandler` already handles upsert — reuse it.
- `transactionId @unique` on `DonationPayment` is already in place — one CREDIT transaction maps to at most one DonationPayment. Manual payments (`transactionId = null`) are exempt from this constraint.
- `BankInterestPayment` rows from before migration must be backfilled into `DonationPayment` with `donationPurpose = INTEREST_CLEANSING` and `transactionId = null` (they were manually entered, so no tx link).
- `amountDue` on `BankInterestLiability` is kept as a manual override for interest not captured in CSV (e.g., term deposit statements, in-branch paper notices). It is NOT the primary source after migration.
- Status badge `MANUAL` (all cleansed but via manual entries only) is informational, not a warning.
- Australian ANNUAL calendar year: `fromYear` → `toYear`, months 1–12 within `fromYear`. E.g., Annual 2024 = Jan–Dec 2024.
