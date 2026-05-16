# Transaction Enrichment Pipeline — Context

## Problem

The Transaction Ledger (bank CSV imports) and the Donations/Zakat pages evolved independently. A bank transaction categorised as "Gifts & donations" has no automatic path to a `DonationPayment` or `ZakatPayment` record, forcing double-entry. More critically, `ZakatPayment` has no `transactionId` FK — and more importantly, no `donationPaymentId` FK — making it impossible to link a Zakat payment either to the bank transaction that funded it OR to the `DonationPayment` record that already enriches it. This is the primary stated gap: **some donations are made with the intent to fulfil a Zakat obligation, but there is no way to record that intent**. A cash donation (no bank transaction) also has no path to Zakat at all under the current schema. Additionally, `CalendarYear` stores only month-level boundaries, which is insufficient for Zakat years that start and end on specific days (e.g., Jul **7** – Jun **26** for a lunar-derived year).

---

## File Inventory

### Files to CREATE

| File | Purpose |
|---|---|
| `src/server/services/transactions/zakat-link.service.ts` | Query unlinked "Gifts & donations" transactions for a Zakat year date range; mirrors `donation-link.service.ts` |
| `src/server/services/transactions/calendar-boundary.service.ts` | Compute exact start/end `Date` from a `CalendarYear` (uses `fromDay`/`toDay`); validate transaction date eligibility with FISCAL hard-block / ZAKAT soft-warn |
| `src/app/(authorized)/zakat/_components/UnlinkedZakatBanner.tsx` | Server Component — count badge + "Link Transactions" CTA for selected Zakat year |
| `src/app/(authorized)/zakat/_components/LinkZakatDrawerTrigger.tsx` | Client Component — button that opens the drawer |
| `src/app/(authorized)/zakat/_components/LinkZakatDrawer.tsx` | Client Component — two-panel slide-over: unlinked tx list (left) + enrich form (right) |
| `prisma/migrations/<ts>_calendar_year_day_precision/migration.sql` | Add nullable `fromDay`, `toDay` to `CalendarYear` |
| `prisma/migrations/<ts>_zakat_payment_transaction_fk/migration.sql` | Add optional `transactionId` FK + `donationPaymentId` FK to `ZakatPayment` |
| `src/server/services/transactions/donation-zakat-link.service.ts` | Query unlinked `DonationPayment` records (with or without a transaction) for a Zakat year date range |
| `src/app/(authorized)/zakat/_components/UnlinkedDonationsZakatBanner.tsx` | Server Component — count of DonationPayments not yet linked to this Zakat year + CTA |

### Files to MODIFY

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `fromDay Int?`, `toDay Int?` to `CalendarYear`; add `transactionId String? @unique`, `donationPaymentId String? @unique`, relations to `ZakatPayment`; add `zakatPayment ZakatPayment?` back-reference to `Transaction` and `DonationPayment` |
| `src/server/trpc/router/transaction-ledger.ts` | Add `getUnlinkedZakatTransactions` tRPC procedure; include `zakatPayment { select: { id: true } }` in `getAll` include; add `isZakatLinked?: boolean` to `TransactionRow` output |
| `src/app/(authorized)/zakat/page.tsx` | Inject `<UnlinkedZakatBanner>` and `<UnlinkedDonationsZakatBanner>` above the payments table |
| `src/app/(authorized)/zakat/ZakatTableServer.tsx` | Pass `transactionId` field to client |
| `src/app/(authorized)/zakat/_types.ts` | Add `transactionId?: string` and `donationPaymentId?: string` to `ZakatPaymentType` |
| `src/app/(authorized)/zakat/actions.ts` | Accept optional `transactionId` in `addRow`; write `transactionId` when creating via `addZakatPaymentDetail` |
| `src/app/(authorized)/zakat/_schema.ts` | Add `transactionId z.string().optional()` and `donationPaymentId z.string().optional()` to `CreateZakatPaymentSchema` |
| `src/server/services/zakat.service.ts` | Accept optional `transactionId` in `addZakatPaymentDetail`; pass to Prisma create |
| `src/components/transactions/TransactionRow.tsx` | Add 🕌 Zakat linked badge; badge logic checks BOTH `tx.zakatPayment != null` AND `tx.donationPayment?.zakatPayment != null` (Zakat via donation path) |
| `src/app/(authorized)/settings/calendar/` | Expose `fromDay`/`toDay` inputs for ZAKAT-type calendar years |

### Reference Files (read-only)

| File | Why |
|---|---|
| `src/server/services/transactions/donation-link.service.ts` | Mirror pattern for `zakat-link.service.ts` and `donation-zakat-link.service.ts` |
| `src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx` | Mirror pattern for `UnlinkedZakatBanner.tsx` |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer.tsx` | Mirror pattern for `LinkZakatDrawer.tsx` |
| `src/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawerTrigger.tsx` | Mirror pattern for `LinkZakatDrawerTrigger.tsx` |
| `src/server/services/transactions/constants.ts` | `DONATION_CATEGORY` sentinel — reuse for Zakat eligibility check |
| `src/app/(authorized)/zakat/_table/BeneficiarySelectionCell.tsx` | Reuse in drawer form |
| `src/app/(authorized)/zakat/reducer.ts` | Immer/useReducer dispatch patterns |

---

## Relevant Schema

```prisma
// Current — CalendarYear (month precision only)
model CalendarYear {
  id          String           @id @default(cuid())
  description String
  fromYear    Int
  fromMonth   Int
  // fromDay  Int?   ← MISSING (proposed)
  toYear      Int
  toMonth     Int
  // toDay    Int?   ← MISSING (proposed)
  type        CalendarEnumType? // ZAKAT | ANNUAL | FISCAL
  zakatObligations        ZakatObligation[]
  bankInterestLiabilities BankInterestLiability[]
  incomeLedgers           IncomeLedger[]
  expenseLedgers          ExpenseLedger[]
  donationLedgers         DonationLedger[]
}

enum CalendarEnumType {
  ZAKAT
  ANNUAL
  FISCAL
}

// Current — ZakatPayment (no transactionId, no donationPaymentId)
model ZakatPayment {
  id              String              @id @default(cuid())
  datePaid        DateTime
  amount          Decimal             @db.Money
  beneficiaryType BeneficiaryEnumType
  business        Business?           @relation(fields: [businessId], references: [id])
  businessId      String?
  individual      Individual?         @relation(fields: [individualId], references: [id])
  individualId    String?
  zakatObligation ZakatObligation     @relation(fields: [zakatObligationId], references: [id])
  zakatObligationId String
  // transactionId    String? @unique  ← MISSING (proposed) — direct bank tx path
  // transaction      Transaction?     ← MISSING (proposed)
  // donationPaymentId String? @unique ← MISSING (proposed) — via donation path (primary gap)
  // donationPayment  DonationPayment? ← MISSING (proposed)
}

// Current — ZakatObligation
model ZakatObligation {
  id         String         @id @default(cuid())
  calendar   CalendarYear   @relation(fields: [calendarId], references: [id], onDelete: Restrict)
  calendarId String         @unique
  amountDue  Decimal        @db.Money
  payments   ZakatPayment[]
}

// Current — DonationPayment (already has transactionId — the reference pattern)
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
  // zakatPayment  ZakatPayment?       ← PROPOSED back-reference (added when donationPaymentId FK added to ZakatPayment)
}

// Current — Transaction (has donationPayment back-ref, missing zakatPayment)
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
  bankAccount         BankAccount?          @relation(fields: [bankAccountId], references: [id])
  bankAccountId       String?
  user                User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId              String
  importSession       ImportSession?        @relation(fields: [importSessionId], references: [id])
  importSessionId     String?
  offsetTransaction   Transaction?          @relation("ReimbursementLink", fields: [offsetTransactionId], references: [id])
  reimbursements      Transaction[]         @relation("ReimbursementLink")
  donationPayment     DonationPayment?
  // zakatPayment     ZakatPayment?         ← MISSING (proposed)
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
  @@index([userId, bankAccountId, date])
  @@index([userId, type, status])
  @@index([importSessionId])
}

enum TransactionTypeEnum   { DEBIT CREDIT }
enum TransactionStatusEnum { PENDING CONFIRMED EXCLUDED }
enum BeneficiaryEnumType   { INDIVIDUAL BUSINESS }
```

**Expense category sentinel**: `'Gifts & donations'` (case-insensitive, stored in `Transaction.category`) — same category used for both donation and Zakat eligibility.

**Australian fiscal year**: Jul 1 (`fromYear`) → Jun 30 (`toYear`). `fromDay` defaults to 1, `toDay` defaults to last day of month.

**Zakat year**: User-defined custom start/end (e.g., Jul 7 – Jun 26 for lunar-derived). Requires `fromDay`/`toDay` precision.

---

## Existing Patterns to Reuse

### Donation link service (mirror for Zakat)

```typescript
// src/server/services/transactions/donation-link.service.ts
export async function getUnlinkedDonationTransactions(
  userId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<UnlinkedDonationTransaction[]> {
  return prisma.transaction.findMany({
    where: {
      userId,
      type: 'DEBIT',
      status: 'CONFIRMED',
      category: { equals: 'Gifts & donations', mode: 'insensitive' },
      date: { gte: dateFrom, lte: dateTo },
      donationPayment: null,    // ← filter: no linked DonationPayment
    },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, description: true, amount: true },
  });
}
```

### tRPC protected procedure

```typescript
// src/server/trpc/router/transaction-ledger.ts
getUnlinkedDonationTransactions: protectedProcedure
  .input(z.object({ dateFrom: z.string(), dateTo: z.string() }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const dateFrom = new Date(`${input.dateFrom}T00:00:00`);
    const dateTo = new Date(`${input.dateTo}T23:59:59`);
    return getUnlinkedDonationTransactions(userId, dateFrom, dateTo);
  }),
```

### Server Action pattern (Zakat)

```typescript
'use server';
export async function addRow(input: CreateZakatPaymentInput) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Unauthorized' };
  const validatedInput = CreateZakatPaymentSchema.parse(input);
  // ...
}
```

### UnlinkedTransactionsBanner (Server Component)

```typescript
// src/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner.tsx
export default async function UnlinkedTransactionsBanner({ fromYear, toYear, dateFrom, dateTo, calendarYearId }) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const count = await countUnlinkedDonationTransactions(session.user.id, fromYear, toYear);
  if (count === 0) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        🔗 <strong>{count}</strong> transactions need recipient details.
      </p>
      <LinkTransactionsDrawerTrigger dateFrom={dateFrom} dateTo={dateTo} calendarYearId={calendarYearId} />
    </div>
  );
}
```

---

## Data Flow

### Current (Zakat payment — no transaction link)

```
User confirms CSV → Transaction(DEBIT, CONFIRMED, category="Gifts & donations")
                                        ↓
                           [NO ZakatPayment created]
                           [NO link to ZakatObligation]

User goes to Zakat page → adds ZakatPayment manually (no transactionId)
  → ZakatObligation updated
  → Transaction and ZakatPayment remain disconnected silos
```

### Proposed (enrichment pipeline)

**Path A — Direct transaction → Zakat (no donation enrichment yet):**
```
User confirms CSV → Transaction(DEBIT, CONFIRMED, "Gifts & donations")
                            ↓
        Zakat page: UnlinkedZakatBanner: "2 transactions need Zakat attribution"
        User opens LinkZakatDrawer → selects transaction → fills beneficiary
                            ↓
        Save → ZakatPayment created WITH transactionId FK
          → Transaction shows 🕌 Zakat badge (direct path)
```

**Path B — Donation → Zakat (primary use case: donation already enriched or cash donation):**
```
DonationPayment exists (with or without transactionId)
  — could be: CSV tx enriched on Donations page
  — could be: manually entered cash donation (no transactionId)
                            ↓
        Zakat page: UnlinkedDonationsZakatBanner:
          "3 donation payments from this period can count toward Zakat"
        User opens LinkDonationsToZakatDrawer → selects DonationPayment
          → form pre-fills date + amount from DonationPayment
          → user confirms/adjusts (partial attribution allowed)
                            ↓
        Save → ZakatPayment created WITH donationPaymentId FK
          → ZakatObligation.payments updated
          → If DonationPayment has a transactionId:
              Transaction shows 🕌 Zakat badge (via donation chain)

**Path C — Donations page convenience shortcut:**
```
User is on Donations page, editing/adding a DonationPayment
  → "Count toward Zakat?" toggle (collapsed by default)
  → If toggled: shows Zakat year selector
  → On save: creates ZakatPayment linked via donationPaymentId
```

**Manual Zakat payments (cash/in-kind, no transaction, no donation):**
```
User on Zakat page → adds ZakatPayment manually
  → No transactionId, no donationPaymentId
  → Works as before
```

### Calendar attribution (same transaction, two purposes)

```
Transaction ($500 debit, 2024-11-15, "Gifts & donations")
  └── DonationPayment → DonationLedger → CalendarYear(FISCAL, FY2025: Jul 1 2024–Jun 30 2025)
        └── ZakatPayment (via donationPaymentId) → ZakatObligation → CalendarYear(ZAKAT, 1446H)

OR (if no donation enrichment):
Transaction ($500 debit, 2024-11-15, "Gifts & donations")
  └── ZakatPayment (via transactionId) → ZakatObligation → CalendarYear(ZAKAT, 1446H)

Cash donation (no Transaction):
  DonationPayment (transactionId = null)
    └── ZakatPayment (via donationPaymentId) → ZakatObligation → CalendarYear(ZAKAT, 1446H)

NOT double-counting: independent ledgers for independent obligations.
@unique on each FK prevents same-purpose duplication per enrichment type.
```

---

## Constraints & Gotchas

- `transactionId` must be `@unique` on `ZakatPayment` — one Transaction → at most one ZakatPayment.
- Manual Zakat payments (cash/in-kind) continue without `transactionId` — nullable FK.
- `CalendarYear.fromDay` / `toDay` are nullable; null means first/last day of month respectively. Non-breaking for existing FISCAL/ANNUAL records.
- FISCAL year date boundaries are hard: ATO dates are legally defined. Validate strictly.
- Zakat year date boundaries are soft: lunar calendar is approximate. Warn but allow override.
- **Never add `calendarYearId` to `Transaction`** — a transaction can belong to multiple calendar year types simultaneously. Attribution flows through enrichment records only.
- `ZakatPayment.amount` may differ from `Transaction.amount` (partial attribution — e.g., $400 of $500 donated, $100 excluded as admin fee). Both fields are independent.
- The `ZakatObligation` must exist for the selected Zakat year before a `ZakatPayment` can be created. The existing `createZakatYearHandler` handles this.
- `category = 'Gifts & donations'` is a plain string. Use `mode: 'insensitive'` in all Prisma queries.
- The Zakat page currently has no `_components/` subfolder — create it.
