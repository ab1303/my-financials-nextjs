# Interest Cleansing — High-Level Design v2

> **Status:** Redesign. Supersedes the month-attribution model in `hld.md`.
> The v1 implementation (Phases 1–4) is complete and live. This v2 redesigns
> the page layout and service layer based on the insight that cleansing
> donations are a **year-level pool obligation**, not a per-month obligation.

---

## The Core Insight (v1 → v2)

v1 tracked cleansing donations per month: a donation paid in April was attributed
to April's interest. This model is wrong in two ways:

1. **Religiously**: The riba obligation is cumulative — "I must give away all
   the interest I received this year." There is no month-level sub-obligation.
2. **Practically**: A single bank transfer or cash payment often covers multiple
   months of interest. Forcing month attribution means either splitting one real
   payment into artificial entries or mis-attributing it.

**v2 model:** Interest is still *received* monthly (the bank credits it monthly),
but *cleansing* is tracked as a pool against the full year.

---

## Architecture Decisions

### 1. Year-pool cleansing (replaces month-level attribution)

**Decision:** `DonationPayment(INTEREST_CLEANSING)` records are associated with
a `CalendarYear` (via the existing `donationLedger.calendarId`), not with a
specific `BankInterestLiability` month row.

**Rationale:** The balance is `yearTotalReceived − yearTotalCleansed`. There is
no sub-balance per month, and no need to designate which month a payment cleanses.

### 2. No schema migration required

**Decision:** The existing `DonationPayment` schema already links to a
`DonationLedger` which has `calendarId`. No new columns are needed. The change
is purely in the service query logic and the page UI.

**Rationale:** v1 matched manual donations to months by `datePaid.month`. v2
simply stops doing that match — all cleansing donations for the year's ledger
are summed together. The data model is already correct; only the aggregation
changes.

### 3. Two-section page layout

**Decision:** The page has two distinct, visually separated sections:

- **Interest Credits** — a simplified monthly table showing what was received.
  Read-only for months with ledger data; editable manual override for months
  without CSV coverage.
- **Cleansing Donations** — a dated list of all donations made this year to
  cleanse interest, with `+` Add button.

**Rationale:** Separating these two concerns removes the visual lie of v1 (where
rows showed both "what came in" and "what was cleansed" in the same row,
implying a 1:1 relationship that doesn't exist).

### 4. Status is year-level, not row-level

**Decision:** The three summary cards (Interest Received / Amount Cleansed /
Remaining to Cleanse) are the primary status indicators. The `Remaining` card
uses amber styling when balance > $0. There are no per-row status badges on
the interest credits table.

**Rationale:** Per-row status badges implied "this row is fully cleansed" which
was semantically incorrect. The obligation is to the year total, not each month.

### 5. Manual override editing stays per-month

**Decision:** Each month row in the Interest Credits table has an inline edit
button (pencil icon) that opens a small popover/modal to set `BankInterestLiability.amountDue`
for that month. This is separate from the cleansing flow.

**Rationale:** Manual override remains a per-month concept because it represents
"I received $X in February but have no CSV to prove it." This is month-specific
data, unlike cleansing which is year-pooled.

### 6. `+` button opens the cleansing drawer (no month context)

**Decision:** The `+` button in the Cleansing Donations section opens
`CleanseDonationDrawer` without any monthly row context. The drawer receives
only `bankId`, `calendarYearId`, `dateFrom`, `dateTo`.

**Rationale:** The drawer no longer needs to know which month it is cleansing.
It simply creates a `DonationPayment(INTEREST_CLEANSING)` for the year.

---

## New Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Bank + Year selectors (unchanged)                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────┬──────────────────────────┐
│ INTEREST     │ AMOUNT CLEANSED  │ REMAINING TO CLEANSE     │
│ RECEIVED     │                  │  (amber when > $0)       │
│ $125.00      │ $85.00           │ $40.00                   │
└──────────────┴──────────────────┴──────────────────────────┘

── Interest Credits ─────────────────────────────────────────
  MONTH      │ FROM LEDGER │ MANUAL OVERRIDE │ TOTAL
  ───────────┼─────────────┼─────────────────┼──────────────
  January    │ $50.00      │ —               │ $50.00  [✏]
  February   │ $35.00      │ —               │ $35.00
  March      │ $40.00      │ —               │ $40.00
  ...        │             │                 │
  ─────────────────────────────────────────────────
  TOTAL      │ $125.00     │ $0.00           │ $125.00

── Cleansing Donations ───────────────────────── [+ Add]  ───
  DATE        │ AMOUNT  │ BENEFICIARY  │ SOURCE       │ [🗑]
  ────────────┼─────────┼──────────────┼──────────────┼──────
  15 Mar 2025 │ $85.00  │ NZF          │ Manual       │ [🗑]
  2  Jun 2025 │ $40.00  │ Al-Imdaad    │ Linked Tx    │ [🗑]
```

---

## Data Model (unchanged)

No Prisma schema changes. The v1 migration (`add_donation_purpose_enum`) is
sufficient. The year link already exists via `DonationPayment.donationLedger.calendarId`.

```
CalendarYear (ANNUAL)
  └── DonationLedger
        └── DonationPayment(INTEREST_CLEANSING)[]  ← year pool, any date
              ├── transactionId?  (set for linked-tx mode)
              └── datePaid        (when the donation was made)

Business (BANK)
  └── BankAccount[]
        └── Transaction(CREDIT, category="Bank Interest")[]  ← monthly credits
  └── BankInterestLiability[]  ← one row per month, amountDue = manual override
```

---

## Service Interface

```typescript
// NEW return type — replaces InterestCleansingMonthSummary[]
type YearlyCleansingData = {
  monthlyCredits: MonthlyCredit[];       // what was received each month
  cleansingDonations: CleansingDonation[]; // all donations for the year (pool)
  yearlySummary: YearlySummary;
};

type MonthlyCredit = {
  bankInterestLiabilityId: string;
  month: number;
  year: number;
  receivedFromLedger: number;   // sum of CREDIT transactions for this month
  manualOverride: number;       // BankInterestLiability.amountDue
  receivedTotal: number;        // sum of above two
};

type CleansingDonation = {
  id: string;                   // DonationPayment.id
  datePaid: Date;
  amount: number;
  beneficiaryName: string;      // resolved from businessId or individualId
  beneficiaryType: 'INDIVIDUAL' | 'BUSINESS';
  source: 'LINKED' | 'MANUAL'; // LINKED = transactionId set, MANUAL = null
  transactionId: string | null;
};

type YearlySummary = {
  totalReceived: number;   // sum of all monthlyCredits.receivedTotal
  totalCleansed: number;   // sum of all cleansingDonations.amount
  balance: number;         // totalReceived - totalCleansed (floor 0)
};
```

---

## Component Map

| Component | Status | Change |
|---|---|---|
| `BankInterestTableServer.tsx` | Modify | Calls `getYearlyCleansingData`; renders both sections |
| `InterestCreditsTable.tsx` | Rename/Modify | Was `BankInterestTableClient`; stripped to Month+Received only; inline edit for manual override |
| `CleansingDonationsList.tsx` | **New** | Year-pool list with `+` button; calls drawer |
| `CleanseDonationDrawer.tsx` | Modify | Remove `liabilityId` + `receivedTotal` props; remove month context; year-level only |
| `UnlinkedInterestBanner.tsx` | Keep | Shows count of unlinked interest CREDIT transactions |
| `PaymentHistoryModal.tsx` | **Remove** | Superseded by `CleansingDonationsList` |
| `page.tsx` | Keep | Summary cards unchanged |

---

## Success Criteria

| # | Criterion |
|---|---|
| 1 | A donation paid in April correctly reduces the year balance regardless of which month's interest it was for |
| 2 | Two separate donations for the same year (different dates, different beneficiaries) both appear in the Cleansing Donations list and both count toward `totalCleansed` |
| 3 | A lump-sum donation covering 3 months of interest can be entered as a single record without month attribution |
| 4 | The Interest Credits table shows only "what came in" — no STATUS, CLEANSED, or BALANCE per row |
| 5 | The `+` button in Cleansing Donations section opens the drawer without requiring a monthly row to be selected |
| 6 | Manual override edit (pencil icon per month) calls `updateBankInterestDetail` and refreshes the credits table |
| 7 | Remaining card is amber when `balance > 0`, green when `balance === 0` |
| 8 | `pnpm run build` passes with zero TypeScript errors |

---

## Out of Scope

| Item | Reason |
|---|---|
| Deleting cleansing donations | Deferred; requires soft-delete or confirmation modal |
| Editing cleansing donation amount/date after creation | Deferred; create new + delete old pattern is acceptable for now |
| Partial attribution ("this $50 covers Jan + Feb") | Not needed; year-pool model makes this unnecessary |
| `BankInterestPayment` model removal | Deferred; separate cleanup migration after all legacy procedures removed |
