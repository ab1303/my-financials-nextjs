# Transaction Enrichment Pipeline — Low-Level Design

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| **Phase 1** | `prisma/schema.prisma`, 2 migrations | Schema: `CalendarYear` day precision + `ZakatPayment` dual FKs (`transactionId` + `donationPaymentId`) |
| **Phase 2** | `calendar-boundary.service.ts` (new) | Calendar boundary utility + date validation (FISCAL hard / ZAKAT soft) |
| **Phase 3** | `zakat-link.service.ts` (new), `zakat.service.ts`, `transaction-ledger.ts` | Direct transaction→Zakat link service + tRPC procedure |
| **Phase 3b** | `donation-zakat-link.service.ts` (new), `transaction-ledger.ts` | Donation→Zakat link service (primary gap: cash donations + already-enriched donations) |
| **Phase 4** | `UnlinkedZakatBanner.tsx`, `UnlinkedDonationsZakatBanner.tsx`, drawers, `zakat/page.tsx`, `zakat/actions.ts`, `zakat/_schema.ts`, `zakat/_types.ts` | Zakat page enrichment UI — two banner types |
| **Phase 5** | `transaction-ledger.ts`, `TransactionRow.tsx` | Transaction Ledger cross-attribution badges (direct + indirect chain) |
| **Phase 6** | `settings/calendar/` | Calendar settings: expose `fromDay`/`toDay` for ZAKAT years |
| **Phase 7** | `donations/actions.ts`, `donations/_schema.ts`, `donations/form`, Donations drawer | "Count toward Zakat?" convenience toggle on Donations page |

---

## Phase 1 — Schema Migrations

### Migration 1: `CalendarYear` day precision

```sql
-- prisma/migrations/<ts>_calendar_year_day_precision/migration.sql
ALTER TABLE "CalendarYear" ADD COLUMN "fromDay" INTEGER;
ALTER TABLE "CalendarYear" ADD COLUMN "toDay"   INTEGER;
```

### Migration 2: `ZakatPayment` dual FKs

```sql
-- prisma/migrations/<ts>_zakat_payment_transaction_fk/migration.sql
ALTER TABLE "ZakatPayment"
  ADD COLUMN "transactionId" TEXT UNIQUE;

ALTER TABLE "ZakatPayment"
  ADD CONSTRAINT "ZakatPayment_transactionId_fkey"
  FOREIGN KEY ("transactionId")
  REFERENCES "Transaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ZakatPayment"
  ADD COLUMN "donationPaymentId" TEXT UNIQUE;

ALTER TABLE "ZakatPayment"
  ADD CONSTRAINT "ZakatPayment_donationPaymentId_fkey"
  FOREIGN KEY ("donationPaymentId")
  REFERENCES "DonationPayment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

### Updated Prisma schema (relevant diffs)

```prisma
model CalendarYear {
  id          String           @id @default(cuid())
  description String
  fromYear    Int
  fromMonth   Int
  fromDay     Int?             // null = 1st of fromMonth
  toYear      Int
  toMonth     Int
  toDay       Int?             // null = last day of toMonth
  type        CalendarEnumType?
  // ... relations unchanged
}

model ZakatPayment {
  id                String              @id @default(cuid())
  datePaid          DateTime
  amount            Decimal             @db.Money
  beneficiaryType   BeneficiaryEnumType
  business          Business?           @relation(fields: [businessId], references: [id])
  businessId        String?
  individual        Individual?         @relation(fields: [individualId], references: [id])
  individualId      String?
  zakatObligation   ZakatObligation     @relation(fields: [zakatObligationId], references: [id])
  zakatObligationId String
  transaction       Transaction?        @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId     String?             @unique
}

model Transaction {
  // ... existing fields ...
  donationPayment  DonationPayment?
  zakatPayment     ZakatPayment?        // NEW back-reference
  // ...
}
```

### Phase 1 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| New `ZakatPayment` can be created with a valid `transactionId` | Integration | FK constraint allows valid link |
| Creating two `ZakatPayments` with the same `transactionId` throws unique constraint error | Integration | `@unique` prevents same-purpose duplication |
| Deleting a `Transaction` sets `ZakatPayment.transactionId = null` (not deletes payment) | Integration | `onDelete: SetNull` cascade |
| Existing `ZakatPayment` rows still load after migration (transactionId = null) | Regression | Non-breaking additive migration |
| `CalendarYear` with `fromDay = null` and `toDay = null` saves and loads correctly | Integration | Nullable columns work for FISCAL years |

---

## Phase 2 — Calendar Boundary Service

### File: `src/server/services/transactions/calendar-boundary.service.ts`

```typescript
import type { CalendarYear } from '@prisma/client';

export interface CalendarDateRange {
  from: Date;
  to: Date;
}

export interface DateValidationResult {
  valid: boolean;
  hardBlocked: boolean;   // true = block the operation
  warning?: string;       // present when valid but outside soft boundary
}

/**
 * Returns the exact start and end Date for a CalendarYear record.
 * fromDay defaults to 1; toDay defaults to last day of toMonth.
 */
export function getCalendarDateRange(calendar: CalendarYear): CalendarDateRange {
  const fromDay = calendar.fromDay ?? 1;
  const toDay = calendar.toDay ?? lastDayOfMonth(calendar.toYear, calendar.toMonth);

  return {
    from: new Date(calendar.fromYear, calendar.fromMonth - 1, fromDay, 0, 0, 0, 0),
    to:   new Date(calendar.toYear,   calendar.toMonth   - 1, toDay,  23, 59, 59, 999),
  };
}

/**
 * Validates whether a transaction date is eligible for attribution
 * to the given calendar year.
 *
 * FISCAL: hard block if outside range.
 * ZAKAT:  soft warning if outside range (lunar ambiguity).
 * ANNUAL: hard block (same as FISCAL).
 */
export function validateTransactionDateForCalendar(
  transactionDate: Date,
  calendar: CalendarYear,
): DateValidationResult {
  const { from, to } = getCalendarDateRange(calendar);
  const inRange = transactionDate >= from && transactionDate <= to;

  if (inRange) {
    return { valid: true, hardBlocked: false };
  }

  if (calendar.type === 'ZAKAT') {
    return {
      valid: true,
      hardBlocked: false,
      warning: `Transaction date (${transactionDate.toISOString().slice(0, 10)}) falls outside ${calendar.description}. Lunar calendar boundaries are approximate — proceed if correct.`,
    };
  }

  // FISCAL or ANNUAL: hard block
  return {
    valid: false,
    hardBlocked: true,
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month is 1-based; Date(year, month, 0) = last day
}
```

### Phase 2 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| `getCalendarDateRange` with `fromDay = null`, `toDay = null` returns 1st and last day of month | Unit | Null defaults resolve correctly |
| `getCalendarDateRange` with `fromDay = 7`, `toDay = 26` returns Jul 7 and Jun 26 | Unit | Explicit day values applied |
| `validateTransactionDateForCalendar` for FISCAL: date inside range returns `{ valid: true, hardBlocked: false }` | Unit | In-range FISCAL passes |
| `validateTransactionDateForCalendar` for FISCAL: date outside range returns `{ valid: false, hardBlocked: true }` | Unit | Out-of-range FISCAL blocks |
| `validateTransactionDateForCalendar` for ZAKAT: date 3 days before start returns `{ valid: true, hardBlocked: false, warning: "..." }` | Unit | Out-of-range ZAKAT warns but allows |
| `lastDayOfMonth` returns 28 for Feb in a non-leap year, 29 in a leap year | Unit | Edge case month boundaries |

---

## Phase 3 — Zakat Link Service & tRPC Procedure

### File: `src/server/services/transactions/zakat-link.service.ts`

```typescript
import { prisma } from '@/server/db/client';

export interface UnlinkedZakatTransaction {
  id:          string;
  date:        string; // YYYY-MM-DD
  description: string;
  amount:      number;
}

const DONATION_CATEGORY = 'Gifts & donations';

/**
 * Returns DEBIT CONFIRMED transactions with category "Gifts & donations"
 * that have no linked ZakatPayment, within the given date range.
 */
export async function getUnlinkedZakatTransactions(
  userId:   string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<UnlinkedZakatTransaction[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type:     'DEBIT',
      status:   'CONFIRMED',
      category: { equals: DONATION_CATEGORY, mode: 'insensitive' },
      date:     { gte: dateFrom, lte: dateTo },
      zakatPayment: null,          // ← no linked ZakatPayment
    },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, description: true, amount: true },
  });

  return rows.map((tx) => ({
    id:          tx.id,
    date:        tx.date.toISOString().slice(0, 10),
    description: tx.description,
    amount:      Number(tx.amount),
  }));
}

/**
 * Returns the count of unlinked Zakat-eligible transactions for a
 * calendar year date range.
 */
export async function countUnlinkedZakatTransactions(
  userId:   string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<number> {
  return prisma.transaction.count({
    where: {
      userId,
      type:     'DEBIT',
      status:   'CONFIRMED',
      category: { equals: DONATION_CATEGORY, mode: 'insensitive' },
      date:     { gte: dateFrom, lte: dateTo },
      zakatPayment: null,
    },
  });
}
```

### `zakat.service.ts` change — accept `transactionId?` and `donationPaymentId?`

```typescript
// Modified signature for addZakatPaymentDetail
export async function addZakatPaymentDetail(
  zakatObligationId: string,
  input: {
    datePaid:          Date;
    amount:            number;
    beneficiaryType:   BeneficiaryEnumType;
    beneficiaryId:     string;
    transactionId?:    string;   // direct bank tx path
    donationPaymentId?: string;  // via-donation path (primary gap)
    // Caller must ensure only one of the two is set
  },
) {
  if (input.transactionId && input.donationPaymentId) {
    throw new Error('ZakatPayment cannot have both transactionId and donationPaymentId');
  }
  return prisma.zakatPayment.create({
    data: {
      datePaid:         input.datePaid,
      amount:           input.amount,
      beneficiaryType:  input.beneficiaryType,
      ...(input.beneficiaryType === 'INDIVIDUAL'
        ? { individualId: input.beneficiaryId }
        : { businessId:   input.beneficiaryId }),
      zakatObligationId,
      ...(input.transactionId    ? { transactionId:    input.transactionId }    : {}),
      ...(input.donationPaymentId ? { donationPaymentId: input.donationPaymentId } : {}),
    },
  });
}
```

### tRPC procedure added to `transaction-ledger.ts`

```typescript
getUnlinkedZakatTransactions: protectedProcedure
  .input(z.object({
    dateFrom: z.string(), // ISO YYYY-MM-DD
    dateTo:   z.string(),
  }))
  .query(async ({ ctx, input }) => {
    const userId  = ctx.session.user.id;
    const dateFrom = new Date(`${input.dateFrom}T00:00:00`);
    const dateTo   = new Date(`${input.dateTo}T23:59:59`);
    return getUnlinkedZakatTransactions(userId, dateFrom, dateTo);
  }),
```

### `getAll` procedure change — include `zakatPayment` (both paths)

```typescript
// In the `include` block of ctx.prisma.transaction.findMany:
donationPayment: { select: { id: true, zakatPayment: { select: { id: true } } } },  // UPDATED — include nested zakatPayment
zakatPayment:    { select: { id: true } },   // NEW — direct path

// In the output mapping (isZakatLinked checks BOTH paths):
isZakatLinked:
  tx.category.toLowerCase() === 'gifts & donations' && tx.type === TransactionTypeEnum.DEBIT
    ? tx.zakatPayment !== null || tx.donationPayment?.zakatPayment !== null
    : undefined,
```

### `TransactionRow` interface change

```typescript
export interface TransactionRow {
  // ... existing fields ...
  isDonationLinked?: boolean;
  isZakatLinked?:    boolean;   // NEW
}
```

### Phase 3 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| `getUnlinkedZakatTransactions` returns only CONFIRMED DEBIT "Gifts & donations" transactions with no ZakatPayment | Integration | Correct filter: type + status + category + null ZakatPayment |
| `getUnlinkedZakatTransactions` excludes transactions already linked to a ZakatPayment | Integration | `zakatPayment: null` filter works |
| `getUnlinkedZakatTransactions` excludes transactions outside the date range | Integration | Date boundary respected |
| `countUnlinkedZakatTransactions` returns 0 when all transactions are linked | Integration | Count query |
| `addZakatPaymentDetail` with `transactionId` saves the FK and is retrievable | Integration | FK write path |
| Creating a `ZakatPayment` with both `transactionId` and `donationPaymentId` is rejected | App-layer validation | Mutual exclusion enforced |
| If a `DonationPayment` exists for a transaction, the `donationPaymentId` path is used | Integration | Preferred path logic |
| tRPC `getUnlinkedZakatTransactions` returns 401 for unauthenticated requests | Unit | Auth guard |

---

## Phase 4 — Zakat Page Enrichment UI

### New: `src/app/(authorized)/zakat/_components/UnlinkedZakatBanner.tsx`

```typescript
import { countUnlinkedZakatTransactions } from '@/server/services/transactions/zakat-link.service';
import { getCalendarDateRange } from '@/server/services/transactions/calendar-boundary.service';
import { auth } from '@/server/auth';
import LinkZakatDrawerTrigger from './LinkZakatDrawerTrigger';
import type { CalendarYear } from '@prisma/client';

interface UnlinkedZakatBannerProps {
  calendar:     CalendarYear;
  dateFrom:     string; // ISO YYYY-MM-DD (pre-computed for tRPC passthrough)
  dateTo:       string;
}

export default async function UnlinkedZakatBanner({ calendar, dateFrom, dateTo }: UnlinkedZakatBannerProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { from, to } = getCalendarDateRange(calendar);
  const count = await countUnlinkedZakatTransactions(session.user.id, from, to);
  if (count === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-teal-300 bg-teal-50 px-4 py-3 dark:border-teal-700 dark:bg-teal-950">
      <p className="text-sm text-teal-800 dark:text-teal-200">
        🕌 <strong>{count}</strong> &quot;Gifts &amp; donations&quot; transaction
        {count !== 1 ? 's' : ''} from your bank import can be attributed to this Zakat year.
      </p>
      <LinkZakatDrawerTrigger
        dateFrom={dateFrom}
        dateTo={dateTo}
        calendarYearId={calendar.id}
      />
    </div>
  );
}
```

### New: `src/app/(authorized)/zakat/_components/LinkZakatDrawerTrigger.tsx`

```typescript
'use client';
// Mirrors LinkTransactionsDrawerTrigger.tsx in donations feature.
// Manages open/closed state; renders the drawer.
interface LinkZakatDrawerTriggerProps {
  dateFrom:       string;
  dateTo:         string;
  calendarYearId: string;
}
```

### New: `src/app/(authorized)/zakat/_components/LinkZakatDrawer.tsx`

```typescript
'use client';
// Two-panel slide-over:
//   Left panel:  list of UnlinkedZakatTransaction (date, amount, description)
//                Clicking a row populates the right panel.
//   Right panel: form — beneficiaryType, beneficiary (BeneficiarySelectionCell),
//                date (locked from tx), amount (pre-filled, editable for partial),
//                soft-warn if tx date outside Zakat year bounds.
//                "Save & Next" advances to next unlinked tx.
//                On close → Zakat table refreshes via router.refresh().

interface LinkZakatDrawerProps {
  dateFrom:       string;
  dateTo:         string;
  calendarYearId: string;
  onClose:        () => void;
}
```

### `zakat/actions.ts` — accept `transactionId?`

```typescript
// CreateZakatPaymentInput gains transactionId?
export async function addRow(input: CreateZakatPaymentInput) {
  const validatedInput = CreateZakatPaymentSchema.parse(input);
  const zakat = await getZakat(validatedInput.calendarYearId);
  const newPayment = await addZakatPaymentDetail(zakat.id, {
    datePaid:       validatedInput.datePaid,
    amount:         validatedInput.amount,
    beneficiaryType: validatedInput.beneficiaryType,
    beneficiaryId:  validatedInput.beneficiaryId,
    transactionId:  validatedInput.transactionId,   // NEW — passed through
  });
  // ...
}
```

### `zakat/_schema.ts` — add `transactionId` field

```typescript
export const CreateZakatPaymentSchema = z.object({
  calendarYearId:  z.string().min(1),
  datePaid:        z.coerce.date(),
  amount:          z.number().positive(),
  beneficiaryType: z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId:   z.string().min(1),
  transactionId:   z.string().optional(),   // NEW
});
```

### `zakat/_types.ts` — add `transactionId?`

```typescript
export type ZakatPaymentType = {
  id:              string;
  datePaid:        Date;
  amount:          number;
  beneficiaryId:   string;
  beneficiaryType: BeneficiaryEnumType;
  transactionId?:  string;   // NEW
};
```

### `zakat/page.tsx` — inject banner

```typescript
// After selecting a Zakat year, compute dateFrom/dateTo from calendar,
// then render:
<UnlinkedZakatBanner
  calendar={selectedCalendar}
  dateFrom={dateFrom}
  dateTo={dateTo}
/>
<ZakatTableServer calendarYearId={selectedCalendar.id} />
```

### Phase 4 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| `UnlinkedZakatBanner` renders nothing when count is 0 | Unit (React) | No false-positive banner |
| `UnlinkedZakatBanner` renders correct count and CTA when transactions exist | Unit (React) | Banner content |
| Clicking "Link Transactions" opens the drawer | E2E (Playwright) | DrawerTrigger → Drawer |
| Selecting an unlinked transaction populates the form with locked date and pre-filled amount | E2E | Drawer right panel |
| Submitting the form calls `addRow` with correct `transactionId` | E2E | Action invocation |
| After save, transaction no longer appears in the unlinked list | E2E | `zakatPayment: null` filter re-query |
| "Save & Next" advances to the next unlinked transaction | E2E | Navigation logic |
| Soft warning appears in drawer when transaction date falls outside Zakat year | E2E | `validateTransactionDateForCalendar` integration |
| Hard block error shown if transaction date outside FISCAL year (edge case test) | Unit | Validation guard |

---

## Phase 5 — Transaction Ledger Cross-Attribution Badges

### `TransactionRow.tsx` changes

The component already computes `isDonationLinked`. Add parallel logic for Zakat:

```typescript
// In the cell render for category="Gifts & donations" DEBIT rows:
{isDonationLinked !== undefined && (
  <span title={isDonationLinked ? 'Linked to Donations' : 'Not linked to Donations'}>
    {isDonationLinked ? '🔗' : '🔗⚠️'}
  </span>
)}
{isZakatLinked !== undefined && (
  <span title={isZakatLinked ? 'Linked to Zakat' : 'Not linked to Zakat'}>
    {isZakatLinked ? '🕌' : '🕌⚠️'}
  </span>
)}
```

### Phase 5 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| Transaction row with both donation and Zakat links shows both badges | Unit (React) | Dual badge render |
| Transaction row with donation link only shows 🔗 badge, no 🕌 badge | Unit (React) | Independent badge rendering |
| Transaction row with category != "Gifts & donations" shows no attribution badges | Unit (React) | Badge only for relevant category |
| `transactionLedgerRouter.getAll` includes `isZakatLinked` in output | Unit (tRPC) | Router output shape |
| `isZakatLinked = true` when Zakat is linked via `donationPayment.zakatPayment` (indirect chain) | Unit (tRPC) | Two-path badge logic |

---

## Phase 6 — Calendar Settings: Day Precision for ZAKAT Years

### Settings UI change

On the calendar settings page, when `type === 'ZAKAT'`, render additional fields:

```typescript
// Conditional fields (only shown for ZAKAT calendar type)
interface ZakatDayFields {
  fromDay?: number;  // 1–31
  toDay?:   number;  // 1–31
}
```

- `fromDay`: number input, label "Start day of month", range 1–31, optional (default = 1st)
- `toDay`: number input, label "End day of month", range 1–31, optional (default = last day)
- Hint text: "Leave blank for the 1st / last day of the stated month"

### Phase 6 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| Saving a ZAKAT CalendarYear with `fromDay = 7`, `toDay = 26` persists correctly | Integration | DB write for new fields |
| FISCAL CalendarYear form does not show day precision fields | Unit (React) | Conditional render |
| `getCalendarDateRange` called on updated ZAKAT year uses new `fromDay`/`toDay` | Unit | Service reads DB fields |

---

## Migration Notes

### Run order

```bash
# Stop dev server first (Windows EPERM risk with running Prisma)
# 1. Apply schema changes
pnpm prisma migrate dev --name calendar_year_day_precision
pnpm prisma migrate dev --name zakat_payment_transaction_fk

# 2. Regenerate client
pnpm prisma generate

# 3. Restart dev server
pnpm run dev
```

### Rollback

Both migrations are additive (new nullable columns). Rolling back requires:
```sql
ALTER TABLE "CalendarYear" DROP COLUMN "fromDay";
ALTER TABLE "CalendarYear" DROP COLUMN "toDay";
ALTER TABLE "ZakatPayment" DROP CONSTRAINT "ZakatPayment_transactionId_fkey";
ALTER TABLE "ZakatPayment" DROP COLUMN "transactionId";
```

No data loss risk — columns are nullable with no existing data.

---

## Phase 3b — Donation→Zakat Link Service (Primary Gap)

### File: `src/server/services/transactions/donation-zakat-link.service.ts`

This service addresses the **primary stated gap**: donations (with or without a bank transaction) that should count toward a Zakat obligation but have no path to do so.

```typescript
import { prisma } from '@/server/db/client';

export interface UnlinkedDonationForZakat {
  id:              string;   // DonationPayment.id
  datePaid:        string;   // YYYY-MM-DD
  amount:          number;
  beneficiaryType: string;
  beneficiaryName: string;
  taxCategory:     string;
  transactionId:   string | null;  // present if bank-imported
}

/**
 * Returns DonationPayments within the given date range that have no linked
 * ZakatPayment. Works for both bank-imported (transactionId present) and
 * manually entered (transactionId null) donations.
 */
export async function getUnlinkedDonationsForZakat(
  userId:   string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<UnlinkedDonationForZakat[]> {
  // DonationLedger is scoped to CalendarYear (not userId directly).
  // We scope via Individual/Business ownership (same pattern as zakat.service.ts).
  const rows = await prisma.donationPayment.findMany({
    where: {
      datePaid:     { gte: dateFrom, lte: dateTo },
      zakatPayment: null,    // ← no ZakatPayment linked via donationPaymentId
      OR: [
        { individual: { userId } },
        { business:   { userId } },
        // Also include donations with no beneficiary assigned yet — scope via transaction
        { transaction: { userId } },
      ],
    },
    orderBy: { datePaid: 'desc' },
    select: {
      id: true,
      datePaid: true,
      amount: true,
      beneficiaryType: true,
      taxCategory: true,
      transactionId: true,
      individual: { select: { name: true } },
      business:   { select: { name: true } },
    },
  });

  return rows.map((dp) => ({
    id:              dp.id,
    datePaid:        dp.datePaid.toISOString().slice(0, 10),
    amount:          Number(dp.amount),
    beneficiaryType: dp.beneficiaryType,
    beneficiaryName: dp.individual?.name ?? dp.business?.name ?? '—',
    taxCategory:     dp.taxCategory,
    transactionId:   dp.transactionId,
  }));
}

export async function countUnlinkedDonationsForZakat(
  userId:   string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<number> {
  return prisma.donationPayment.count({
    where: {
      datePaid:     { gte: dateFrom, lte: dateTo },
      zakatPayment: null,
      OR: [
        { individual: { userId } },
        { business:   { userId } },
        { transaction: { userId } },
      ],
    },
  });
}
```

### New: `src/app/(authorized)/zakat/_components/UnlinkedDonationsZakatBanner.tsx`

```typescript
import { countUnlinkedDonationsForZakat } from '@/server/services/transactions/donation-zakat-link.service';
import { getCalendarDateRange } from '@/server/services/transactions/calendar-boundary.service';
import { auth } from '@/server/auth';
import LinkDonationsToZakatDrawerTrigger from './LinkDonationsToZakatDrawerTrigger';
import type { CalendarYear } from '@prisma/client';

export default async function UnlinkedDonationsZakatBanner({ calendar, dateFrom, dateTo }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { from, to } = getCalendarDateRange(calendar);
  const count = await countUnlinkedDonationsForZakat(session.user.id, from, to);
  if (count === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950">
      <p className="text-sm text-emerald-800 dark:text-emerald-200">
        🤲 <strong>{count}</strong> donation payment{count !== 1 ? 's' : ''} from this period
        can count toward your Zakat obligation.
      </p>
      <LinkDonationsToZakatDrawerTrigger dateFrom={dateFrom} dateTo={dateTo} calendarYearId={calendar.id} />
    </div>
  );
}
```

### New: `src/app/(authorized)/zakat/_components/LinkDonationsToZakatDrawer.tsx`

```typescript
'use client';
// Two-panel slide-over — donation path:
//   Left panel:  list of UnlinkedDonationForZakat
//                (date, amount, beneficiary, taxCategory, bank tx badge if linked)
//                Clicking populates right panel.
//   Right panel: form — amount (pre-filled from DonationPayment, editable for partial),
//                zakatObligationId (locked to year), beneficiary already resolved
//                from DonationPayment (read-only display).
//                Soft-warn if datePaid falls outside Zakat year bounds.
//                "Save & Next" → next unlinked donation.
//                On close → Zakat table refreshes.

interface LinkDonationsToZakatDrawerProps {
  dateFrom:       string;
  dateTo:         string;
  calendarYearId: string;
  onClose:        () => void;
}
```

### `zakat/_schema.ts` — add `donationPaymentId?` and mutual exclusion

```typescript
export const CreateZakatPaymentSchema = z.object({
  calendarYearId:    z.string().min(1),
  datePaid:          z.coerce.date(),
  amount:            z.number().positive(),
  beneficiaryType:   z.nativeEnum(BeneficiaryEnumType),
  beneficiaryId:     z.string().min(1),
  transactionId:     z.string().optional(),
  donationPaymentId: z.string().optional(),
}).refine(
  (data) => !(data.transactionId && data.donationPaymentId),
  { message: 'Cannot set both transactionId and donationPaymentId', path: ['donationPaymentId'] },
);
```

### Phase 3b test cases

| Test description | Test type | What it verifies |
|---|---|---|
| `getUnlinkedDonationsForZakat` returns DonationPayments with `zakatPayment = null` in date range | Integration | Core filter |
| `getUnlinkedDonationsForZakat` excludes DonationPayments already linked to a ZakatPayment | Integration | `zakatPayment: null` filter |
| `getUnlinkedDonationsForZakat` includes manual donations (no transactionId) | Integration | Cash donation path works |
| `getUnlinkedDonationsForZakat` scopes correctly to userId (not other users' donations) | Integration | User scoping |
| `countUnlinkedDonationsForZakat` returns 0 when all donations are linked | Integration | Count |
| `CreateZakatPaymentSchema` rejects input with both `transactionId` and `donationPaymentId` | Unit | Mutual exclusion |
| `addZakatPaymentDetail` with `donationPaymentId` creates ZakatPayment with correct FK | Integration | Via-donation write path |
| `UnlinkedDonationsZakatBanner` uses emerald colour (distinct from amber tx banner) | Unit (React) | Visual distinction between two banners |

---

## Phase 7 — "Count toward Zakat?" Convenience Toggle on Donations Page

This is the **primary user-facing entry point** identified in the original requirement: a user recording a donation should be able to immediately declare it as a Zakat payment without navigating away.

### UX pattern

When a user is **adding or editing** a `DonationPayment` on the Donations page:

```
[ ] Count this toward Zakat obligation          ← collapsed toggle (off by default)
    └─ Zakat Year: [FY 1446H ▼]
       Amount toward Zakat: $500.00  (pre-filled, editable for partial)
```

- Toggle is **off by default** (most donations are not Zakat)
- Toggling on shows a Zakat year selector (only `CalendarEnumType.ZAKAT` years shown)
- Amount defaults to `DonationPayment.amount`; user can reduce for partial attribution
- On save: server action creates both the `DonationPayment` and a linked `ZakatPayment` in a single transaction

### Files modified

| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/donations/_schema.ts` | Add `zakatYearId?: string` and `zakatAmount?: number` optional fields |
| `src/app/(authorized)/cashflow/donations/actions.ts` | In `addRow`/`editRow`: if `zakatYearId` provided, call `addZakatPaymentDetail` with `donationPaymentId` in same DB transaction |
| `src/app/(authorized)/cashflow/donations/form.tsx` or drawer | Add collapsible "Count toward Zakat?" section with year selector + amount input |

### Server action change (donations/actions.ts)

```typescript
// In addRow — after DonationPayment is created:
if (validatedInput.zakatYearId) {
  const zakat = await getZakat(validatedInput.zakatYearId);
  await addZakatPaymentDetail(zakat.id, {
    datePaid:          newDonationPayment.datePaid,
    amount:            validatedInput.zakatAmount ?? validatedInput.amount,
    beneficiaryType:   validatedInput.beneficiaryType,
    beneficiaryId:     validatedInput.beneficiaryId,
    donationPaymentId: newDonationPayment.id,   // ← links via donation path
  });
}
```

### Phase 7 test cases

| Test description | Test type | What it verifies |
|---|---|---|
| Saving a DonationPayment with `zakatYearId` creates a linked ZakatPayment in the same DB operation | Integration | Atomic create |
| The created ZakatPayment has `donationPaymentId` set (not `transactionId`) | Integration | Correct FK path |
| Saving a DonationPayment without `zakatYearId` creates no ZakatPayment | Integration | Toggle-off default |
| `zakatAmount` defaults to `DonationPayment.amount` when not explicitly set | Unit | Default attribution |
| Partial `zakatAmount` (< DonationPayment.amount) is accepted | Integration | Partial attribution |
| "Count toward Zakat?" section only shows ZAKAT-type calendar years in dropdown | Unit (React) | Type filtering |
| After saving with Zakat toggle on, Zakat page shows new payment for that year | E2E | End-to-end flow |

---

## Integration Points & Edge Cases

| Scenario | Handling |
|---|---|
| User links a transaction to Zakat, then deletes the transaction | `onDelete: SetNull` — `ZakatPayment.transactionId` becomes null; payment record survives |
| User links a donation to Zakat, then deletes the donation | `onDelete: SetNull` — `ZakatPayment.donationPaymentId` becomes null; payment record survives |
| User tries to link the same transaction to two ZakatPayments | DB unique constraint error → toast: "This transaction is already linked to a Zakat payment" |
| User tries to link the same donation to two ZakatPayments | DB unique constraint error → toast: "This donation is already linked to a Zakat payment" |
| User provides both `transactionId` and `donationPaymentId` | App-layer rejection before DB hit: Zod refine + service guard |
| ZakatPayment has `amount` different from linked DonationPayment.amount | Allowed — partial attribution. Drawer/toggle pre-fills donation amount but field is editable |
| Selected donation date falls outside Zakat year bounds | Soft warning in drawer; user can proceed (lunar calendar ambiguity) |
| A cash DonationPayment (no transactionId) is linked to Zakat | Correct — `donationPaymentId` path works without any Transaction FK |
| Transaction is linked to DonationPayment AND that donation is linked to ZakatPayment | Transaction Ledger shows 🕌 badge via `donationPayment.zakatPayment != null` (indirect chain) |
| User on Donations page saves with "Count toward Zakat?" on — Zakat year has no ZakatObligation | `getZakat` creates the obligation lazily (existing `createZakatYearHandler` pattern) |
| User uses Phase 7 toggle then also tries to link via Zakat page drawer | Second link attempt fails with unique constraint on `donationPaymentId` — surface as toast |
| Zakat year created without `fromDay`/`toDay` (existing records) | `getCalendarDateRange` defaults to 1st / last-day-of-month — existing behaviour preserved |
