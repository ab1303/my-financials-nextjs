# Interest Cleansing — Low-Level Design

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| 1 | `prisma/schema.prisma`, migration SQL, `donations/actions.ts`, `donations/_schema.ts`, `donations/_types.ts` | Schema migration: add `DonationPurposeEnum`, extend `DonationPayment`, backfill `BankInterestPayment` rows |
| 2 | `interest-cleansing.service.ts` (new), `bank-interest.ts` router, `transaction-ledger.ts` router | Backend: derive interest from ledger; compute per-month cleansing summary |
| 3 | `BankInterestTableServer.tsx`, `BankInterestTableClient.tsx`, `_types.ts`, `reducer.ts`, `page.tsx` | UI: summary cards, derived table columns, status badges, `UnlinkedInterestBanner` |
| 4 | `CleanseDonationDrawer.tsx` (new) | UI: two-mode slide-over drawer (Linked + Manual) for recording cleansing donations |

---

## Phase 1 — Schema Migration & Action Extension

### Prisma Schema Changes

```prisma
// Add before DonationPayment
enum DonationPurposeEnum {
  VOLUNTARY
  INTEREST_CLEANSING
}

// Modify DonationPayment — add one field
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
  donationPurpose  DonationPurposeEnum @default(VOLUNTARY)   // ← NEW
}
```

### Migration SQL

```sql
-- Step 1: Add enum type
CREATE TYPE "DonationPurposeEnum" AS ENUM ('VOLUNTARY', 'INTEREST_CLEANSING');

-- Step 2: Add column with default
ALTER TABLE "DonationPayment"
  ADD COLUMN "donationPurpose" "DonationPurposeEnum" NOT NULL DEFAULT 'VOLUNTARY';

-- Step 3: Backfill existing BankInterestPayment rows into DonationPayment
-- NOTE: BankInterestPayment.businessId maps to DonationPayment.businessId
-- NOTE: All backfilled rows have transactionId = NULL (manually entered, no ledger trace)
-- NOTE: taxCategory defaults to 'Interest Cleansing' for backfilled rows
-- NOTE: DonationLedger must exist for the calendar year — handled by application layer before this runs
INSERT INTO "DonationPayment" (
  "id", "datePaid", "amount", "beneficiaryType", "taxCategory",
  "businessId", "donationLedgerId", "donationPurpose"
)
SELECT
  gen_random_uuid()::text,
  bip."datePaid",
  bip."amount",
  'BUSINESS'::"BeneficiaryEnumType",
  'Interest Cleansing',
  bip."businessId",
  dl."id",
  'INTEREST_CLEANSING'::"DonationPurposeEnum"
FROM "BankInterestPayment" bip
JOIN "BankInterestLiability" bil ON bip."bankInterestLiabilityId" = bil."id"
JOIN "DonationLedger" dl ON dl."calendarId" = bil."calendarId"
WHERE bip."businessId" IS NOT NULL;
-- Rows with NULL businessId are skipped; they had incomplete data and cannot be reliably migrated.
```

### Extended Zod Schema

```typescript
// src/app/(authorized)/cashflow/donations/_schema.ts — add to CreateDonationPaymentSchema
import { DonationPurposeEnum } from '@prisma/client';

export const CreateDonationPaymentSchema = z.object({
  datePaid: z.date(),
  amount: z.number().positive(),
  taxCategory: z.string().min(1),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1),
  calendarYearId: z.string().min(1),
  transactionId: z.string().optional(),
  donationPurpose: z.nativeEnum(DonationPurposeEnum).optional().default('VOLUNTARY'),  // NEW
});
```

### Extended Type

```typescript
// src/app/(authorized)/cashflow/donations/_types.ts — add field
export type DonationPaymentType = {
  // ...existing fields...
  transactionId?: string;
  donationPurpose: 'VOLUNTARY' | 'INTEREST_CLEANSING';  // NEW
};
```

### Extended Server Action

```typescript
// src/app/(authorized)/cashflow/donations/actions.ts — pass donationPurpose to prisma.create
await ctx.prisma.donationPayment.create({
  data: {
    // ...existing fields...
    transactionId: validatedInput.transactionId,
    donationPurpose: validatedInput.donationPurpose ?? 'VOLUNTARY',  // NEW
  },
});
```

### Phase 1 Test Cases

| Test | Type | Verifies |
|---|---|---|
| `DonationPayment` created without `donationPurpose` defaults to `VOLUNTARY` | Unit (service) | Backward compatibility — existing donations unaffected |
| `addRow` called with `donationPurpose: 'INTEREST_CLEANSING'` persists the value | Unit (action) | New field is passed through the action layer |
| Backfill migration: all `BankInterestPayment` rows with non-null `businessId` appear in `DonationPayment` with `donationPurpose = INTEREST_CLEANSING` | Integration (migration) | Data migration correctness |
| `BankInterestPayment` rows with `businessId = null` are NOT migrated (partial data) | Integration (migration) | Skipping incomplete legacy rows |
| `DonationPayment.donationPurpose` is included in `DonationTableServer` query result | Unit (server component) | Field visible to the donations page without page-level change |

---

## Phase 2 — Backend: Derived Interest Data

### New Service: `interest-cleansing.service.ts`

```typescript
// src/server/services/bank-interest/interest-cleansing.service.ts

export type InterestCleansingMonthSummary = {
  bankInterestLiabilityId: string;
  month: number;
  year: number;
  receivedFromLedger: number;   // sum of CREDIT "Bank Interest" tx for this month
  manualOverride: number;       // BankInterestLiability.amountDue (manual top-up)
  receivedTotal: number;        // receivedFromLedger + manualOverride
  amountCleansed: number;       // sum of DonationPayment(INTEREST_CLEANSING) linked to this month's tx
  manualCleansed: number;       // subset of amountCleansed where transactionId IS NULL
  balance: number;              // receivedTotal - amountCleansed
  uncleansedTxCount: number;    // CREDIT tx with no linked DonationPayment
  status: CleansingStatus;
};

export type CleansingStatus = 'CLEANSED' | 'PARTIAL' | 'PENDING' | 'MANUAL' | 'NONE';
// NONE    — receivedTotal === 0 (no interest this month)
// PENDING — receivedTotal > 0, amountCleansed === 0
// PARTIAL — receivedTotal > 0, 0 < amountCleansed < receivedTotal
// CLEANSED — balance === 0, at least one tx-linked donation
// MANUAL   — balance === 0, all donations have transactionId = null

export const getInterestCleansingData = async (
  bankId: string,
  calendarYearId: string,
  userId: string,
): Promise<InterestCleansingMonthSummary[]>

export const getUnlinkedInterestTransactions = async (
  bankId: string,
  dateFrom: Date,
  dateTo: Date,
  userId: string,
): Promise<Array<{ id: string; date: string; description: string; amount: number }>>
```

#### `getInterestCleansingData` implementation sketch

```typescript
export const getInterestCleansingData = async (bankId, calendarYearId, userId) => {
  // 1. Fetch existing BankInterestLiability rows (manual overrides)
  const liabilities = await prisma.bankInterestLiability.findMany({
    where: { bankId, calendarId: calendarYearId },
    include: { payments: true },
    orderBy: { month: 'asc' },
  });

  // 2. Find BankAccount IDs for this bank + user
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  // 3. Fetch CalendarYear for date range
  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: { id: calendarYearId },
  });
  const dateFrom = new Date(`${calendarYear.fromYear}-01-01`);
  const dateTo = new Date(`${calendarYear.toYear}-12-31T23:59:59`);

  // 4. Fetch CREDIT "Bank Interest" transactions
  const interestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      category: { equals: 'Bank Interest', mode: 'insensitive' },
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
    },
    include: { donationPayment: true },
  });

  // 5. Load cleansing donations (manual path — no transactionId — for this calendar year)
  const manualCleansingDonations = await prisma.donationPayment.findMany({
    where: {
      donationPurpose: 'INTEREST_CLEANSING',
      transactionId: null,
      donationLedger: { calendarId: calendarYearId },
      datePaid: { gte: dateFrom, lte: dateTo },
    },
  });

  // 6. Group by month and compute summary
  return liabilities.map((liability) => {
    const monthTx = interestTx.filter(
      (tx) => tx.date.getMonth() + 1 === liability.month,
    );
    const receivedFromLedger = monthTx.reduce((s, tx) => s + tx.amount.toNumber(), 0);
    const manualOverride = liability.amountDue.toNumber();
    const receivedTotal = receivedFromLedger + manualOverride;

    const linkedCleansed = monthTx
      .filter((tx) => tx.donationPayment?.donationPurpose === 'INTEREST_CLEANSING')
      .reduce((s, tx) => s + (tx.donationPayment?.amount.toNumber() ?? 0), 0);

    const manualMonthDonations = manualCleansingDonations.filter(
      (dp) => new Date(dp.datePaid).getMonth() + 1 === liability.month,
    );
    const manualCleansed = manualMonthDonations.reduce((s, dp) => s + dp.amount.toNumber(), 0);
    const amountCleansed = linkedCleansed + manualCleansed;
    const balance = Math.max(0, receivedTotal - amountCleansed);
    const uncleansedTxCount = monthTx.filter((tx) => !tx.donationPayment).length;

    const status = computeStatus(receivedTotal, amountCleansed, balance, linkedCleansed);

    return {
      bankInterestLiabilityId: liability.id,
      month: liability.month,
      year: liability.year,
      receivedFromLedger,
      manualOverride,
      receivedTotal,
      amountCleansed,
      manualCleansed,
      balance,
      uncleansedTxCount,
      status,
    };
  });
};

function computeStatus(
  receivedTotal: number,
  amountCleansed: number,
  balance: number,
  linkedCleansed: number,
): CleansingStatus {
  if (receivedTotal === 0) return 'NONE';
  if (amountCleansed === 0) return 'PENDING';
  if (balance > 0) return 'PARTIAL';
  if (linkedCleansed === 0) return 'MANUAL';
  return 'CLEANSED';
}
```

### New tRPC Procedures

```typescript
// src/server/trpc/router/bank-interest.ts — add to bankInterestRouter
getInterestCleansingData: protectedProcedure
  .input(z.object({ bankId: z.string(), calendarYearId: z.string() }))
  .query(({ ctx, input }) =>
    getInterestCleansingData(input.bankId, input.calendarYearId, ctx.session.user.id),
  ),

getUnlinkedInterestTransactions: protectedProcedure
  .input(z.object({ bankId: z.string(), dateFrom: z.string(), dateTo: z.string() }))
  .query(({ ctx, input }) =>
    getUnlinkedInterestTransactions(
      input.bankId,
      new Date(input.dateFrom),
      new Date(input.dateTo),
      ctx.session.user.id,
    ),
  ),
```

### Phase 2 Test Cases

| Test | Type | Verifies |
|---|---|---|
| Month with 2 CREDIT "Bank Interest" tx totalling $200: `receivedFromLedger = 200` | Unit (service) | Ledger aggregation by month |
| Month with no CREDIT tx but `BankInterestLiability.amountDue = 50`: `receivedTotal = 50`, status = `PENDING` | Unit (service) | Manual override path |
| Month with $100 received and one linked DonationPayment of $100: `balance = 0`, status = `CLEANSED` | Unit (service) | Linked cleansing detection |
| Month with $100 received, one manual DonationPayment of $100 (transactionId=null): status = `MANUAL` | Unit (service) | Manual cleansing produces `MANUAL` status, not `CLEANSED` |
| Month with $100 received and $60 cleansed: `balance = 40`, status = `PARTIAL` | Unit (service) | Partial cleansing |
| Month with $0 received and $0 cleansed: status = `NONE` | Unit (service) | Zero-interest months are not flagged as pending |
| `getUnlinkedInterestTransactions` excludes tx already linked to a DonationPayment | Unit (service) | Banner count accuracy |

---

## Phase 3 — UI: Summary Cards, Derived Table, Status Badges

### Updated `_types.ts`

```typescript
// src/app/(authorized)/cashflow/bank-interest/_types.ts
export type CleansingStatus = 'CLEANSED' | 'PARTIAL' | 'PENDING' | 'MANUAL' | 'NONE';

export type BankInterestType = {
  id: string;                      // BankInterestLiability.id
  month: number;
  year: number;
  receivedFromLedger: number;      // from CREDIT transactions (new)
  manualOverride: number;          // from BankInterestLiability.amountDue (was amountDue)
  receivedTotal: number;           // derived: receivedFromLedger + manualOverride (new)
  amountCleansed: number;          // from DonationPayment(INTEREST_CLEANSING) (was amountPaid)
  balance: number;                 // derived: receivedTotal - amountCleansed (new)
  status: CleansingStatus;         // computed (new)
  uncleansedTxCount: number;       // for banner count (new)
  // REMOVED: amountDue, amountPaid, paymentHistory (replaced by above)
};

export type YearlySummary = {
  totalReceived: number;
  totalCleansed: number;
  remaining: number;
};
```

### Summary Cards (page.tsx)

```tsx
// src/app/(authorized)/cashflow/bank-interest/page.tsx
// Three metric cards above BankInterestForm, only rendered when bank + year selected
<div className="grid grid-cols-3 gap-4 mb-6">
  <SummaryCard label="Interest Received" value={totalReceived} variant="neutral" />
  <SummaryCard label="Amount Cleansed"   value={totalCleansed} variant="success" />
  <SummaryCard
    label="Remaining to Cleanse"
    value={remaining}
    variant={remaining > 0 ? 'warning' : 'success'}
  />
</div>
```

### Status Badge Component

```tsx
// Inline in BankInterestTableClient or extracted to _components/CleansingStatusBadge.tsx
const STATUS_CONFIG: Record<CleansingStatus, { label: string; className: string }> = {
  CLEANSED: { label: '✓ Cleansed',  className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  MANUAL:   { label: '📝 Manual',   className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  PARTIAL:  { label: '◑ Partial',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  PENDING:  { label: '⚠ Pending',   className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  NONE:     { label: '—',           className: 'text-muted-foreground' },
};
```

### Updated Reducer Actions

```typescript
// src/app/(authorized)/cashflow/bank-interest/reducer.ts — replace old actions
type BankInterestMessages = {
  'BANK_INTEREST/INITIAL_DATA': BankInterestState;
  'BANK_INTEREST/SET_MANUAL_OVERRIDE': {    // replaces UPDATE_INTEREST_PAYMENT
    bankInterestLiabilityId: string;
    manualOverride: number;
  };
  'BANK_INTEREST/ADD_CLEANSING_DONATION': { // replaces Payments/ADD_PAYMENT
    bankInterestLiabilityId: string;
    amountAdded: number;
    hasTransactionLink: boolean;
  };
};
```

### `UnlinkedInterestBanner` Props

```typescript
// src/app/(authorized)/cashflow/bank-interest/_components/UnlinkedInterestBanner.tsx
type UnlinkedInterestBannerProps = {
  unlinkedCount: number;  // count from getInterestCleansingData.uncleansedTxCount sum
  onCleanse: () => void;  // opens CleanseDonationDrawer
};
// Renders null when unlinkedCount === 0
```

### Phase 3 Test Cases

| Test | Type | Verifies |
|---|---|---|
| `UnlinkedInterestBanner` renders null when `unlinkedCount === 0` | Unit (component) | No phantom banner |
| Summary card "Remaining to Cleanse" applies `warning` variant (amber) when `remaining > 0` | Unit (component) | Visual nudge for outstanding obligation |
| Status badge renders `✓ Cleansed` for `CLEANSED` status | Unit (component) | Correct badge per status value |
| Status badge renders `—` for `NONE` (no interest month) without a warning style | Unit (component) | Zero-interest months are not alarming |
| `BankInterestTableClient` no longer renders an editable `amountDue` cell | Unit (component) | Manual override field removed from table |
| Clicking "Cleanse" button in a PENDING row triggers `onOpenDrawer` callback | Unit (component) | Row-level CTA wiring |

---

## Phase 4 — `CleanseDonationDrawer`

### Component Interface

```typescript
// src/app/(authorized)/cashflow/bank-interest/_components/CleanseDonationDrawer.tsx
type CleanseDonationDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  bankId: string;
  calendarYearId: string;
  dateFrom: string;   // ISO string — derived from CalendarYear
  dateTo: string;     // ISO string
};
```

### Mode Toggle

```typescript
type DrawerMode = 'linked' | 'manual';
// 'linked': requires selecting a transaction from the left panel; amount+date locked
// 'manual': no transaction panel; amount and date are user-editable
```

### Linked Mode Form Schema

```typescript
const linkedModeSchema = z.object({
  taxCategory: z.string().min(1, 'Tax category is required'),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Select a beneficiary'),
  // amount and datePaid are derived from selectedTransaction — not in form schema
});
```

### Manual Mode Form Schema

```typescript
const manualModeSchema = z.object({
  datePaid: z.date({ required_error: 'Date is required' }),
  amount: z.number({ required_error: 'Amount is required' }).positive('Must be > 0'),
  taxCategory: z.string().min(1, 'Tax category is required'),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId: z.string().min(1, 'Select a beneficiary'),
});
```

### Save Handler

```typescript
// Shared logic for both modes — calls donations/actions.ts addRow
const handleSave = async (values: LinkedFormValues | ManualFormValues) => {
  const result = await addRow({
    datePaid: mode === 'linked' ? new Date(selectedTransaction!.date) : values.datePaid,
    amount:   mode === 'linked' ? selectedTransaction!.amount : values.amount,
    taxCategory: values.taxCategory,
    beneficiaryType: values.beneficiaryType,
    beneficiaryId: values.beneficiaryId,
    calendarYearId,
    transactionId: mode === 'linked' ? selectedTransaction!.id : undefined,
    donationPurpose: 'INTEREST_CLEANSING',
  });
  // On success → dispatch BANK_INTEREST/ADD_CLEANSING_DONATION + advance to next tx (linked) or reset form (manual)
};
```

### Drawer Layout Spec

```
┌────────────────────────────────────────────────────────────────┐
│  Record Cleansing Donation                      [Close]        │
│  ─────────────────────────────────────────────────────         │
│  [ Link to transaction ]  [ Enter manually ]   ← mode toggle  │
├─────────────────────────┬──────────────────────────────────────┤
│  Unlinked transactions  │  Transaction summary (locked)        │
│  (col-2, linked mode)   │  OR                                  │
│                         │  Manual entry form (date + amount)   │
│  • 14 Jan $103.42  ←sel │  ─────────────────────────────────  │
│  • 14 Feb $98.15        │  Tax category: [ text input       ]  │
│                         │  Beneficiary type: [ select       ]  │
│                         │  Beneficiary:      [ creatable    ]  │
│                         │                                      │
│  [hidden in manual mode]│  ─────────────────────────────────  │
│                         │        [Cancel]  [Save & Next →]     │
└─────────────────────────┴──────────────────────────────────────┘
```

In **manual mode**: left panel is hidden; the form expands full-width; "Save & Next →" becomes "Save".

### Phase 4 Test Cases

| Test | Type | Verifies |
|---|---|---|
| Drawer renders in linked mode by default | Unit (component) | Default mode is linked |
| Switching to manual mode hides the transaction list panel | Unit (component) | Mode toggle layout change |
| In linked mode, "Save & Next" is disabled until a transaction is selected AND form is valid | Unit (component) | Validation gate |
| In manual mode, "Save" is disabled until amount > 0 AND date set AND beneficiary selected | Unit (component) | Manual mode validation gate |
| Successful linked save calls `addRow` with `donationPurpose='INTEREST_CLEANSING'` and the transaction id | Integration (action) | Correct action payload for linked path |
| Successful manual save calls `addRow` with `donationPurpose='INTEREST_CLEANSING'` and `transactionId=undefined` | Integration (action) | Correct action payload for manual path |
| After save in linked mode, the saved transaction is removed from the left panel and the next is auto-selected | Unit (component) | "Save & Next" workflow |
| `createPortal` is used — drawer renders in `document.body`, not nested inside the page form | Unit (component) | No nested `<form>` violation |

---

## Integration Points & Edge Cases

| Edge Case | Handling |
|---|---|
| User has no bank CSV imported for the selected year | All 12 months show `receivedFromLedger = 0`; manual override field is the only input; status = `NONE` or `PENDING` depending on override |
| Manual override is set AND a CREDIT tx exists for the same month | Both are summed: `receivedTotal = receivedFromLedger + manualOverride` |
| DonationLedger does not exist for the selected ANNUAL year | `addRow` calls `createDonationYearHandler` internally — existing behaviour unchanged |
| `transactionId` uniqueness violation (user tries to link same tx twice) | Prisma unique constraint throws; tRPC error handler surfaces as toast: "This transaction is already linked to a cleansing donation" |
| `BankInterestPayment` rows with `businessId = null` cannot be backfilled | Migration skips them; a `console.warn` is emitted in the migration script noting the count of skipped rows |
| `CleansingStatus` is `PARTIAL` and user closes drawer without completing all transactions | Drawer closes cleanly; banner count updates to reflect remaining unlinked transactions |
| Selected calendar year is not `ANNUAL` type | `getInterestCleansingData` throws; caught at tRPC boundary; toast error shown |
