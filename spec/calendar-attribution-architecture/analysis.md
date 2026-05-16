# Calendar Attribution Architecture — Analysis & Recommendation

## Executive Summary

**Transaction-as-source-of-truth is the correct architecture.** A single bank transaction can — and *should* — be attributed to multiple independent calendar year types simultaneously. This is not double-counting; it is correct multi-dimensional accounting where each calendar year type represents a different legal/religious obligation with its own reporting ledger.

The current schema already supports this with one structural gap: `ZakatPayment` lacks a `transactionId` FK. Adding it completes the model. No fundamental redesign is needed.

---

## Question 1: Single Transaction, Multiple Calendar Attributions

### Answer: This is a feature, not a problem.

A $500 donation on 2024-11-15 is simultaneously:

| Context | Calendar Year | Record | Purpose |
|---------|--------------|--------|---------|
| Tax deduction | FY2025 (FISCAL: Jul 1 2024 – Jun 30 2025) | `DonationPayment` → `DonationLedger` → `CalendarYear(FISCAL)` | ATO claim |
| Zakat fulfilment | 1446H (ZAKAT: Jul 7 2024 – Jun 26 2025) | `ZakatPayment` → `ZakatObligation` → `CalendarYear(ZAKAT)` | Islamic obligation |

These are **independent ledgers for independent legal/religious obligations**. The Australian Tax Office and Islamic Zakat have no bearing on each other. They overlap in time but serve completely different purposes.

### How the current schema handles this

**Correctly:** The schema already has *separate* junction records for each purpose:
- `DonationPayment` links to `DonationLedger` → `CalendarYear(FISCAL)`
- `ZakatPayment` links to `ZakatObligation` → `CalendarYear(ZAKAT)`

These are distinct rows in distinct tables. A single `Transaction` can have one `DonationPayment` (via `transactionId @unique` on `DonationPayment`) AND one `ZakatPayment` (via a future `transactionId @unique` on `ZakatPayment`) — these are separate 1:1 relationships on separate tables. No conflict.

**The key insight:** The `@unique` constraint on `DonationPayment.transactionId` prevents a transaction from being linked to *two donation records* — but says nothing about Zakat. Similarly, `@unique` on `ZakatPayment.transactionId` would prevent a transaction from being linked to *two zakat records*. Cross-purpose linking is unrestricted and correct.

### Can a Transaction be BOTH a DonationPayment AND a ZakatPayment?

**Yes, and it should be.** The real-world semantics demand it:

```
Transaction ($500 debit, 2024-11-15)
  └── DonationPayment (FY2025, tax-deductible, beneficiary: Islamic Relief)
  └── ZakatPayment (Zakat Year 1446H, fulfils part of $2,400 obligation)
```

The amount may differ between the two (partial attribution is valid — the user might count only $400 of a $500 donation toward Zakat), but the source transaction is the same.

---

## Question 2: Date Boundary Edge Cases

### The scenario

Transaction on **2024-07-02**:
- FY2025 starts Jul 1 2024 → **inside** ✅
- Zakat year 1446H starts Jul 7 2024 → **outside** ❌

### What happens today

**Nothing breaks**, because `ZakatPayment` has no link to `Transaction` at all — it's a standalone manual entry with its own `datePaid` field. The user manually enters the date and the system doesn't validate it against the Zakat year boundaries.

### What SHOULD happen

**Validation with soft warning, not hard block.**

The system should:

1. **Compute eligibility** when the user attempts to link a transaction to a Zakat year:
   ```
   eligible = transaction.date >= zakatYear.startDate
           && transaction.date <= zakatYear.endDate
   ```

2. **Warn but allow override** if the transaction date falls outside the Zakat year:
   > ⚠️ This transaction (2024-07-02) falls before the start of Zakat Year 1446H (Jul 7 2024). Are you sure you want to count it toward this year's obligation?

3. **Never hard-block**, because:
   - Lunar calendar dates are approximate (many scholars disagree on exact boundaries)
   - The user may have a valid jurisprudential reason to count a payment slightly outside the boundary
   - Zakat year boundaries are user-defined in this app, not derived from an authoritative calendar API

**For FISCAL years**: Hard validation is appropriate. The ATO publishes exact dates. A transaction on Jun 30 is in FY2025; a transaction on Jul 1 is in FY2026. No ambiguity.

### Recommended implementation

```typescript
// In the linking service
function validateTransactionDateForCalendar(
  transactionDate: Date,
  calendar: CalendarYear,
): { valid: boolean; warning?: string } {
  const start = new Date(calendar.fromYear, calendar.fromMonth - 1, 1);
  const end = new Date(calendar.toYear, calendar.toMonth - 1, 
    daysInMonth(calendar.toYear, calendar.toMonth), 23, 59, 59);

  if (transactionDate < start || transactionDate > end) {
    if (calendar.type === 'FISCAL') {
      return { valid: false };  // Hard block for tax years
    }
    return { 
      valid: true, 
      warning: `Transaction date falls outside ${calendar.description}` 
    };
  }
  return { valid: true };
}
```

### CalendarYear schema gap: missing exact day boundaries

**Current schema limitation:** `CalendarYear` only stores `fromYear`/`fromMonth`/`toYear`/`toMonth` — no day precision. This is fine for FISCAL (always Jul 1 – Jun 30) and ANNUAL (always Jan 1 – Dec 31), but ZAKAT years have arbitrary start/end days (e.g., Jul **7** – Jun **26**).

**Recommendation:** Add `fromDay Int?` and `toDay Int?` to `CalendarYear` (nullable, defaulting to 1 and last-day-of-month respectively). This is a non-breaking additive change.

```prisma
model CalendarYear {
  id          String           @id @default(cuid())
  description String
  fromYear    Int
  fromMonth   Int
  fromDay     Int?             // null = 1st of month (default for FISCAL/ANNUAL)
  toYear      Int
  toMonth     Int
  toDay       Int?             // null = last day of month (default for FISCAL/ANNUAL)
  type        CalendarEnumType?
  // ... relations unchanged
}
```

---

## Question 3: Schema Adequacy

### Adding `transactionId?` to `ZakatPayment` — does it fully solve attribution?

**It solves the linking problem. It does NOT solve the date boundary problem alone.**

The schema change:

```prisma
model ZakatPayment {
  // ... existing fields ...
  transactionId     String?       @unique
  transaction       Transaction?  @relation(fields: [transactionId], references: [id], onDelete: SetNull)
}

model Transaction {
  // ... existing fields ...
  donationPayment   DonationPayment?  // already exists
  zakatPayment      ZakatPayment?     // NEW back-reference
}
```

This mirrors the `DonationPayment.transactionId` pattern exactly. It is structurally correct.

### What it doesn't solve

1. **Date boundary validation** — must be implemented in service/controller layer (see Question 2)
2. **Amount divergence** — the `ZakatPayment.amount` may differ from `Transaction.amount` (partial attribution). This is valid but the UI should make it clear:
   > Transaction: $500 | Zakat payment: $400 (partial)
3. **Cross-purpose visibility** — when viewing a transaction, the user should see ALL attributions:
   > 📥 Linked to FY2025 Donations | 🕌 Linked to Zakat 1446H

### No structural issues

The relationship graph is clean:

```
Transaction (1) ──optional──> (0..1) DonationPayment ──required──> DonationLedger ──required──> CalendarYear(FISCAL)
Transaction (1) ──optional──> (0..1) ZakatPayment    ──required──> ZakatObligation ──required──> CalendarYear(ZAKAT)
```

Each `Transaction` has at most one `DonationPayment` and at most one `ZakatPayment`. These constraints are enforced by `@unique` on the FK. No many-to-many complexity. No junction tables needed.

---

## Question 4: Enrichment Pipeline Direction

### Recommendation: **Option A (Transaction-anchored) as the canonical direction, with Option B (Calendar-anchored) as the primary UX surface.**

These are not competing — they are complementary layers.

### The correct architecture (hybrid)

```
Layer 1 — Source of Truth:
  Transaction (date, amount, bank account, description)
    → The canonical financial event. Immutable once confirmed.

Layer 2 — Purpose Attribution:
  DonationPayment (tax metadata: beneficiary, taxCategory, donationLedgerId)
  ZakatPayment (obligation metadata: beneficiary, zakatObligationId)
    → These enrichment records give the raw transaction PURPOSE and assign it
       to a specific calendar year's ledger/obligation.

Layer 3 — Reporting Surface:
  DonationLedger (FISCAL year) → aggregates DonationPayments for ATO
  ZakatObligation (ZAKAT year) → aggregates ZakatPayments for Zakat tracking
    → Calendar-anchored views that pull from Layer 2.
```

### Why Option A alone is insufficient for UX

Users don't think "I have a transaction, now let me assign it to calendars." They think:
- "I'm doing my tax return — show me my FY2025 donations" (Calendar-anchored)
- "I need to check if I've paid enough Zakat this year" (Calendar-anchored)

The calendar page is where the user has mental context about what they're doing. The transaction is just evidence.

### Why Option B alone is insufficient for data integrity

Without transaction linking, users re-enter amounts manually on each calendar page. This creates:
- Duplicate data entry (error-prone)
- Drift between bank statement and ledger amounts
- No audit trail back to the bank statement

### The hybrid works because each layer serves a clear role

| Layer | Owns | Serves |
|-------|------|--------|
| Transaction | `date`, `amount`, `description`, `bankAccountId` | Data integrity, audit trail |
| DonationPayment / ZakatPayment | Purpose, beneficiary, calendar attribution | Domain semantics |
| DonationLedger / ZakatObligation | Calendar year aggregation | Reporting |

**Already implemented for donations.** The donation-transaction-linking spec (see `spec/donation-transaction-linking/hld.md`) implements exactly this hybrid: the Donations page (calendar-anchored) shows a banner for unlinked transactions, and the user enriches from that context. The same pattern should apply to Zakat.

---

## Question 5: The Correct Mental Model for the User

### The user's journey

An Australian Muslim making charitable donations experiences THREE financial events from ONE bank transaction:

1. **"I paid money"** → Transaction record (bank CSV import)
2. **"It was a tax-deductible donation"** → DonationPayment (enrichment on Donations page)
3. **"It also counts toward my Zakat"** → ZakatPayment (enrichment on Zakat page)

### The simplest correct mental model

> **"One payment, two purposes."**

The user should understand:
- The bank statement is the single source of truth for *what happened* (date, amount)
- Each special-purpose page (Donations, Zakat) lets them record *why it matters* for that specific obligation
- Linking a transaction to a purpose page means "this bank payment fulfils this obligation"

### Where does the user START?

**Two entry points, neither is "the" start:**

1. **CSV Import → Transaction Ledger → see unlinked items → navigate to Donations/Zakat page to enrich**
   - Natural flow for periodic bank statement processing
   - The Transaction Ledger shows badges: "⚠️ Needs recipient" (donations), "🕌 Needs Zakat link" (future)

2. **Donations/Zakat page → see banner "3 unlinked transactions" → open drawer → enrich**
   - Natural flow when the user is focused on a specific obligation (tax time, Zakat calculation)
   - This is the pattern already built for donations

**Recommendation:** Support both entry points. The Transaction Ledger is the discovery surface; the calendar-anchored pages are the enrichment surfaces.

### Navigating dual attribution

The user should NOT have to think about dual attribution explicitly. Each page handles its own concern:

- **Donations page (FY2025):** "You have 3 unlinked donation transactions" → enrich with beneficiary + tax category
- **Zakat page (1446H):** "You have 2 unlinked Zakat-eligible transactions" → enrich with Zakat obligation link

The only place dual attribution becomes visible is on the **Transaction Ledger**, where a transaction might show:

```
2024-11-15  |  Islamic Relief  |  $500  |  🔗 Donation (FY2025)  |  🕌 Zakat (1446H)
```

This is informational, not actionable — the user manages each attribution on its respective page.

---

## Question 6: Reporting Integrity — Is It Double-Counting?

### Answer: No. It is correct independent reporting.

Consider real-world analogies:

| Scenario | Amount appears in | Double-counting? |
|----------|-------------------|-----------------|
| $500 salary appears in both "gross income" and "taxable income" reports | Two reports | No — different lenses on the same event |
| $500 donation appears on both your ATO tax return and your mosque's Zakat ledger | Two reports | No — different obligations served by the same payment |
| $500 donation appears TWICE on the FY2025 ATO donations schedule | Same report | **YES** — this is actual double-counting |

The `@unique` constraint on `DonationPayment.transactionId` prevents the actual double-counting case (same transaction → two donation records for the same FY). The cross-purpose case (same transaction → one donation record + one zakat record) is correct by definition.

### How to surface this clearly in the UI

**On the Transaction Ledger:**
```
$500.00 debit  |  Islamic Relief  |  Attributed to: Donation (FY2025) + Zakat (1446H)
```

**On the Donations page (FY2025):**
```
Total tax-deductible donations: $3,200.00
  └── $500 also counts toward Zakat 1446H  (informational footnote, not affecting total)
```

**On the Zakat page (1446H):**
```
Obligation: $2,400.00  |  Paid: $1,800.00  |  Remaining: $600.00
  └── $500 of paid amount is also a tax-deductible donation  (informational footnote)
```

The footnotes are optional but aid transparency. The totals on each page are independently correct.

### The one real risk: Amount mismatch

If a $500 transaction is linked as a $500 DonationPayment but only a $400 ZakatPayment (because $100 was non-Zakat-eligible), the user needs to understand why totals differ. The UI should show:

```
Transaction: $500.00
├── Donation (FY2025): $500.00  (full amount)
└── Zakat (1446H): $400.00  (partial — $100 admin fee excluded)
```

This is handled naturally because `DonationPayment.amount` and `ZakatPayment.amount` are independent fields that can differ from `Transaction.amount`.

---

## Source of Truth Summary

| Concern | Source of truth | Model |
|---------|----------------|-------|
| "What happened at the bank" | `Transaction.date`, `Transaction.amount` | Immutable once confirmed |
| "This payment is a tax-deductible donation" | `DonationPayment` | Links Transaction → DonationLedger → CalendarYear(FISCAL) |
| "This payment fulfils a Zakat obligation" | `ZakatPayment` | Links Transaction → ZakatObligation → CalendarYear(ZAKAT) |
| "How much did I donate in FY2025" | `DonationLedger` aggregate | SUM of DonationPayment.amount WHERE calendar = FY2025 |
| "How much Zakat have I paid for 1446H" | `ZakatObligation` aggregate | SUM of ZakatPayment.amount WHERE zakatObligation.calendar = 1446H |
| "Which calendar year does this date fall in" | Date math against `CalendarYear` boundaries | Computed, not stored on Transaction |

---

## Required Schema Changes

### 1. Add `transactionId` to `ZakatPayment` (mirrors `DonationPayment` pattern)

```prisma
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
+ transactionId   String?             @unique
+ transaction     Transaction?        @relation(fields: [transactionId], references: [id], onDelete: SetNull)
}

model Transaction {
  // ... existing fields ...
  donationPayment   DonationPayment?   // already exists
+ zakatPayment      ZakatPayment?      // NEW back-reference
}
```

### 2. Add day precision to `CalendarYear` (for ZAKAT boundary validation)

```prisma
model CalendarYear {
  id          String           @id @default(cuid())
  description String
  fromYear    Int
  fromMonth   Int
+ fromDay     Int?             // null defaults to 1
  toYear      Int
  toMonth     Int
+ toDay       Int?             // null defaults to last day of month
  type        CalendarEnumType?
  // ... relations unchanged
}
```

### 3. No other schema changes needed

The existing `DonationPayment.transactionId @unique` and the proposed `ZakatPayment.transactionId @unique` correctly model the constraint that one transaction can serve at most one purpose per ledger type, while allowing it to serve multiple purposes across ledger types.

---

## Recommended Implementation Sequence

| Phase | Work | Depends on |
|-------|------|-----------|
| 1 | Add `fromDay`/`toDay` to `CalendarYear` schema + migration | — |
| 2 | Add `transactionId` to `ZakatPayment` schema + migration | — |
| 3 | Build `zakat-link.service.ts` (mirrors `donation-link.service.ts`) | Phase 2 |
| 4 | Add date boundary validation service (soft warn for ZAKAT, hard block for FISCAL) | Phase 1 |
| 5 | Build Zakat page unlinked transactions banner + linking drawer (mirrors Donations pattern) | Phase 2, 3 |
| 6 | Add cross-purpose attribution badges to Transaction Ledger | Phase 2 |
| 7 | Add informational footnotes on Donations/Zakat pages showing cross-attribution | Phase 2 |

---

## Tradeoffs Acknowledged

1. **Partial amount attribution complexity** — allowing `ZakatPayment.amount != Transaction.amount` is correct but requires clear UI to prevent confusion. Accepted: the alternative (forcing amounts to match) would be functionally wrong.

2. **Soft validation for Zakat dates** — not enforcing strict date boundaries means a user could assign a transaction to the wrong Zakat year. Accepted: lunar calendar ambiguity makes strict enforcement inappropriate. The warning message mitigates this.

3. **Two enrichment surfaces** — the user enriches donations on the Donations page and Zakat on the Zakat page. This means two separate interactions for a dual-purpose transaction. Accepted: combining them into one flow would mix concerns (tax vs religious obligation) and confuse the user. The mental model "each page handles its own purpose" is simpler.

4. **No `calendarYearId` on Transaction** — the Transaction remains date-only with no direct calendar link. Calendar attribution is always computed via the enrichment records. Accepted: adding `calendarYearId` to Transaction would create a false implication that a transaction belongs to exactly one calendar year, which contradicts the core architectural insight of this analysis.
