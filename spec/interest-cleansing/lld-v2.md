# Interest Cleansing — Low-Level Design v2

> **Status:** Redesign of the page layout and service layer.
> No Prisma schema migration required — the `DonationPurposeEnum` and
> `donationPurpose` column from v1 Phase 1 are sufficient.
>
> **Prerequisite:** v1 Phases 1–4 are complete and deployed.

---

## Phase Map

| Phase | Name | Files | Dependencies |
|---|---|---|---|
| 1 | Service — year-pool aggregation | `interest-cleansing.service.ts`, `bank-interest.ts` router | none |
| 2 | Interest Credits Table | `InterestCreditsTable.tsx` (renamed), `_types.ts`, `BankInterestTableServer.tsx` | Phase 1 |
| 3 | Cleansing Donations List | `CleansingDonationsList.tsx` (new), `BankInterestTableServer.tsx` | Phase 1 |
| 4 | Drawer simplification | `CleanseDonationDrawer.tsx` | Phase 2, 3 |

---

## Phase 1 — Service: Year-Pool Aggregation

### Goal
Replace the per-month `InterestCleansingMonthSummary[]` return type with
`YearlyCleansingData` that separates the two concerns: monthly credits (what
came in) and year-pool donations (what was cleansed, regardless of month).

### Files

| File | Change |
|---|---|
| `src/server/services/bank-interest/interest-cleansing.service.ts` | Replace `getInterestCleansingData` with `getYearlyCleansingData`; new return type |
| `src/server/trpc/router/bank-interest.ts` | Update `getInterestCleansingData` procedure to call `getYearlyCleansingData` |

### New Service Types

```typescript
export type MonthlyCredit = {
  bankInterestLiabilityId: string;
  month: number;
  year: number;
  receivedFromLedger: number;
  manualOverride: number;
  receivedTotal: number;
};

export type CleansingDonation = {
  id: string;
  datePaid: Date;
  amount: number;
  beneficiaryName: string;
  beneficiaryType: 'INDIVIDUAL' | 'BUSINESS';
  source: 'LINKED' | 'MANUAL';
  transactionId: string | null;
};

export type YearlySummary = {
  totalReceived: number;
  totalCleansed: number;
  balance: number;
};

export type YearlyCleansingData = {
  monthlyCredits: MonthlyCredit[];
  cleansingDonations: CleansingDonation[];
  yearlySummary: YearlySummary;
};
```

### New Service Implementation

```typescript
export const getYearlyCleansingData = async (
  bankId: string,
  calendarYearId: string,
  userId: string,
): Promise<YearlyCleansingData> => {
  // 1. Fetch monthly liability rows (manual overrides)
  const liabilities = await prisma.bankInterestLiability.findMany({
    where: { bankId, calendarId: calendarYearId },
    orderBy: { month: 'asc' },
  });

  // Auto-init: create 12 monthly rows if none exist (ANNUAL years only)
  if (!liabilities.length) {
    // ... same auto-init logic as before
  }

  // 2. Fetch bank accounts for this bank + user
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { bankId, userId },
    select: { id: true },
  });
  const bankAccountIds = bankAccounts.map((a) => a.id);

  // 3. Fetch CalendarYear for date range
  const calendarYear = await prisma.calendarYear.findUniqueOrThrow({
    where: { id: calendarYearId },
  });
  const dateFrom = new Date(calendarYear.fromYear, 0, 1);
  const dateTo   = new Date(calendarYear.fromYear, 11, 31, 23, 59, 59);

  // 4. Fetch CONFIRMED CREDIT "Bank Interest" transactions
  const interestTx = await prisma.transaction.findMany({
    where: {
      userId,
      bankAccountId: { in: bankAccountIds },
      type: 'CREDIT',
      category: { equals: 'Bank Interest', mode: 'insensitive' },
      status: 'CONFIRMED',
      date: { gte: dateFrom, lte: dateTo },
    },
  });

  // 5. Build monthly credits (no per-month cleansing — credits only)
  const monthlyCredits: MonthlyCredit[] = liabilities.map((liability) => {
    const monthTx = interestTx.filter(
      (tx) => tx.date.getMonth() + 1 === liability.month,
    );
    const receivedFromLedger = monthTx.reduce(
      (s, tx) => s + tx.amount.toNumber(), 0,
    );
    const manualOverride = liability.amountDue.toNumber();
    return {
      bankInterestLiabilityId: liability.id,
      month: liability.month,
      year: liability.year,
      receivedFromLedger,
      manualOverride,
      receivedTotal: receivedFromLedger + manualOverride,
    };
  });

  // 6. Fetch ALL cleansing donations for this calendar year (year-pool, not per-month)
  const rawDonations = await prisma.donationPayment.findMany({
    where: {
      donationPurpose: 'INTEREST_CLEANSING',
      donationLedger: { calendarId: calendarYearId },
    },
    include: {
      business:   { select: { name: true } },
      individual: { select: { firstName: true, lastName: true } },
    },
    orderBy: { datePaid: 'desc' },
  });

  const cleansingDonations: CleansingDonation[] = rawDonations.map((dp) => ({
    id: dp.id,
    datePaid: dp.datePaid,
    amount: dp.amount.toNumber(),
    beneficiaryName:
      dp.beneficiaryType === 'BUSINESS'
        ? (dp.business?.name ?? 'Unknown')
        : `${dp.individual?.firstName ?? ''} ${dp.individual?.lastName ?? ''}`.trim(),
    beneficiaryType: dp.beneficiaryType,
    source: dp.transactionId ? 'LINKED' : 'MANUAL',
    transactionId: dp.transactionId,
  }));

  // 7. Compute year summary
  const totalReceived = monthlyCredits.reduce((s, m) => s + m.receivedTotal, 0);
  const totalCleansed = cleansingDonations.reduce((s, d) => s + d.amount, 0);
  const balance       = Math.max(0, totalReceived - totalCleansed);

  return {
    monthlyCredits,
    cleansingDonations,
    yearlySummary: { totalReceived, totalCleansed, balance },
  };
};
```

### tRPC Router Update

```typescript
// bank-interest.ts — update existing procedure
getInterestCleansingData: protectedProcedure
  .input(z.object({ bankId: z.string(), calendarYearId: z.string() }))
  .query(({ ctx, input }) =>
    getYearlyCleansingData(
      input.bankId,
      input.calendarYearId,
      ctx.session.user.id,
    ),
  ),
```

### Updated `_types.ts`

```typescript
// Replace entire file
export type { MonthlyCredit, CleansingDonation, YearlySummary, YearlyCleansingData }
  from '@/server/services/bank-interest/interest-cleansing.service';

export type YearlySummaryState = YearlySummary; // alias for client state
```

---

## Phase 2 — Interest Credits Table

### Goal
Rename `BankInterestTableClient` → `InterestCreditsTable`. Strip it to a
simple monthly credits view with no STATUS, CLEANSED, BALANCE, or ACTION columns.
Add a pencil icon per row to allow manual override editing via `updateBankInterestDetail`.

### Files

| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/bank-interest/InterestCreditsTable.tsx` | New name; stripped columns; inline override edit |
| `src/app/(authorized)/cashflow/bank-interest/BankInterestTableClient.tsx` | Remove (replaced by `InterestCreditsTable.tsx`) |
| `src/app/(authorized)/cashflow/bank-interest/BankInterestTableServer.tsx` | Call `getYearlyCleansingData`; render two sections |
| `src/app/(authorized)/cashflow/bank-interest/_types.ts` | Replace with types from Phase 1 |
| `src/app/(authorized)/cashflow/bank-interest/reducer.ts` | Simplify — only `SET_DATA` action needed |

### Column Spec

| Column | Source | Width | Notes |
|---|---|---|---|
| MONTH | `MonthlyCredit.month` | 140 | Full month name |
| FROM LEDGER | `receivedFromLedger` | 140 | Tabular nums; `—` if 0 |
| MANUAL OVERRIDE | `manualOverride` | 140 | Muted colour; `—` if 0; pencil icon on hover |
| TOTAL | `receivedTotal` | 140 | Bold; `—` if both 0 |

No STATUS, CLEANSED, BALANCE, or ACTION columns.

Footer row: sums for FROM LEDGER, MANUAL OVERRIDE, TOTAL.

### Manual Override Edit

On pencil icon click for a row, show a small inline popover or controlled input:
- Field: "Interest Amount ($)" — number input
- Save calls `trpc.bankInterest.updateBankInterestDetail.mutate()`
- On success: `router.refresh()` to re-derive totals

```typescript
// Minimal state — no full drawer needed
const [editingLiabilityId, setEditingLiabilityId] = useState<string | null>(null);
const [editingAmount, setEditingAmount] = useState<number>(0);
```

### `BankInterestTableServer.tsx` Changes

```typescript
// Fetch new data shape
const data: YearlyCleansingData = await getYearlyCleansingData(bankId, calendarYearId, userId);

return (
  <BankInterestStateProvider data={data.monthlyCredits}>
    <UnlinkedInterestBanner ... />

    {/* Section 1 */}
    <InterestCreditsTable
      credits={data.monthlyCredits}
      bankId={bankId}
      calendarYearId={calendarYearId}
    />

    {/* Section 2 */}
    <CleansingDonationsList
      donations={data.cleansingDonations}
      yearlySummary={data.yearlySummary}
      bankId={bankId}
      calendarYearId={calendarYearId}
      dateFrom={dateFrom}
      dateTo={dateTo}
    />
  </BankInterestStateProvider>
);
```

---

## Phase 3 — Cleansing Donations List

### Goal
New Client Component that renders the year-pool list of cleansing donations.
Includes the `+` Add button (same styling as Donations page) and an empty state.

### Files

| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/bank-interest/_components/CleansingDonationsList.tsx` | **New** |

### Component Props

```typescript
type CleansingDonationsListProps = {
  donations: CleansingDonation[];
  yearlySummary: YearlySummary;
  bankId: string;
  calendarYearId: string;
  dateFrom: string;
  dateTo: string;
};
```

### Column Spec

| Column | Source | Notes |
|---|---|---|
| DATE | `datePaid` | Formatted as "15 Mar 2025" |
| AMOUNT | `amount` | Tabular nums; right-aligned |
| BENEFICIARY | `beneficiaryName` | Text |
| SOURCE | `source` | Badge: `LINKED` (blue) or `MANUAL` (slate) |

No delete button in v2 (deferred per out-of-scope).

### Empty State

```
[Plus icon]
No cleansing donations recorded
Click + to record your first cleansing donation for this year
```

### `+` Button

```tsx
// Same className as Donations page:
className='inline-flex items-center justify-center w-10 h-10 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed
           bg-primary/10 text-primary hover:bg-primary/20 focus:ring-primary
           transition-colors'
```

Button opens `CleanseDonationDrawer` (simplified in Phase 4).

---

## Phase 4 — Drawer Simplification

### Goal
Remove all month-level context from `CleanseDonationDrawer`. The drawer now
creates a year-level `DonationPayment(INTEREST_CLEANSING)` only.

### Files

| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/bank-interest/_components/CleanseDonationDrawer.tsx` | Remove `liabilityId`, `receivedTotal` props; remove "Interest Received" field; remove per-month logic |

### Revised Props

```typescript
type CleanseDonationDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  bankId: string;
  calendarYearId: string;
  dateFrom: string;  // for filtering unlinked transactions in Linked mode
  dateTo: string;
  onDonationSaved: (amountAdded: number, source: 'LINKED' | 'MANUAL') => void;
};
```

### Mode A — Linked Transaction

- Shows unlinked interest CREDIT transactions for the date range
- User selects a transaction → amount + date pre-filled (read-only)
- User enters beneficiary + tax category
- On save: `addRow({ ..., donationPurpose: 'INTEREST_CLEANSING', transactionId: selected.id, calendarYearId })`

### Mode B — Manual Entry

- Fields: Date Paid, Amount ($), Beneficiary, Tax Category
- No "Interest Received" field (removed — that was for setting monthly override, now done via pencil icon in table)
- On save: `addRow({ ..., donationPurpose: 'INTEREST_CLEANSING', transactionId: null, calendarYearId })`

### Removed

- `liabilityId` prop — no longer needed
- `receivedTotal` prop — no longer needed
- "Interest Received" field in manual mode — moved to per-row pencil edit in Interest Credits table
- `updateBankInterestDetail` call inside drawer — removed
- Default-to-manual logic for NONE rows — removed (drawer is always opened from `+` button)

---

## Migration Notes (v1 → v2)

| v1 entity | v2 replacement |
|---|---|
| `BankInterestTableClient.tsx` | `InterestCreditsTable.tsx` |
| `BankInterestType` (8 fields) | `MonthlyCredit` (6 fields) — no status/cleansed |
| `CleansingStatus` per row | Year-level balance on summary cards only |
| `drawerRow: DrawerRow | null` in client | Moved to `CleansingDonationsList` |
| Per-row `Record` / `Cleanse` buttons | Removed; `+` button in donations section |
| `ADD_CLEANSING_DONATION` reducer action | Removed; `router.refresh()` on drawer close |
| `SET_MANUAL_OVERRIDE` reducer action | Inline edit in `InterestCreditsTable` |

---

## Test Cases

| ID | Description | Expected |
|---|---|---|
| TC-01 | Two donations (Mar + Jun) for the same year → both appear in list | ✅ Both visible; `totalCleansed` = sum of both |
| TC-02 | Lump sum $125 entered in April to cover Jan+Feb+Mar interest | ✅ One row in list; full $125 counted |
| TC-03 | Monthly credit table shows $50 for Jan, $0 for all others | ✅ 12 rows; only Jan has value |
| TC-04 | `+` button opens drawer without selecting any month row | ✅ Drawer opens; both modes available |
| TC-05 | Manual override pencil edit for March sets `amountDue = 40` | ✅ March row shows $40 in MANUAL OVERRIDE; TOTAL updates |
| TC-06 | `totalReceived = $125`, `totalCleansed = $125` → Remaining card is green $0.00 | ✅ Green styling |
| TC-07 | `totalReceived = $125`, `totalCleansed = $85` → Remaining card is amber $40.00 | ✅ Amber styling |
| TC-08 | Linked donation: transaction for $35 in Feb → selected in drawer → donation saved | ✅ Appears in list with SOURCE = "Linked" |
