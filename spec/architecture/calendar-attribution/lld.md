# Calendar Attribution ADR

| Status  | Date       | Decision Makers   |
| ------- | ---------- | ----------------- |
| Adopted | 2026-05-23 | Architecture Team |

---

## ADR-1: Calendar Year as Time Window (not ownership container)

**Context:**
Historically, records (donations, interest, income) were linked to a calendar year via a `calendarId` FK. This led to hardcoded logic, e.g., always assuming Jan-Dec boundaries, and errors when records didn't fit the expected type.

**Decision:**
A CalendarYear record defines a time window: `(fromYear, fromMonth)` → `(toYear, toMonth)`. It does NOT own records. All queries must derive `dateFrom`/`dateTo` from the CalendarYear fields, not filter by FK.

**Rationale:**

- Supports arbitrary date windows (not just Jan-Dec)
- Enables back-dating and historical records
- Avoids type errors from mismatched calendar types

**Anti-pattern:**

```typescript
// INCORRECT: Hardcodes January, ignores fromMonth
new Date(calendarYear.fromYear, 0, 1);
```

**Correct pattern:**

```typescript
// CORRECT: Uses fromMonth
new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
```

**Schema excerpt:**

```prisma
model CalendarYear {
  id          String           @id @default(cuid())
  description String
  fromYear    Int
  fromMonth   Int
  toYear      Int
  toMonth     Int
  type        CalendarEnumType?
  lockedAt    DateTime?
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
```

**Consequences:**

- Back-dating works by creating historical CalendarYear records
- No more hardcoded Jan-Dec logic
- Engineers must audit all date logic for compliance

---

## ADR-2: Multi-Dimensional Attribution

**Context:**
A single transaction/payment can be valid in multiple calendar years if its date falls within their windows (e.g., a donation in both Annual and Fiscal years).

**Decision:**
A transaction is attributed to every calendar year whose window contains its date. This is not double-counting; each calendar serves a distinct purpose.

**Rationale:**

- Supports tax, religious, and civic obligations
- Schema enforces uniqueness per type (e.g., DonationPayment, ZakatPayment)

**Consequences:**

- Cross-calendar views are supported naturally
- No risk of duplicate records per obligation

---

## ADR-3: Screen-Declared Calendar Types

**Context:**
Features previously allowed users to select incompatible calendar types, causing errors.

**Decision:**
Each feature page must declare which `CalendarEnumType` values are valid. The year picker UI only shows those types. If only one type is valid, no toggle is shown.

**Rationale:**

- Prevents user error
- Ensures type safety per feature

**Per-Screen Calendar Type Declarations:**
| Feature Page | Allowed Calendar Types |
|---------------------|-------------------------|
| Interest Cleansing | ANNUAL, FISCAL |
| Donations | FISCAL |
| Zakat | ZAKAT |
| Income / Expenses | FISCAL |

**Consequences:**

- Users cannot select incompatible types
- UI is simplified when only one type is valid

---

## ADR-4: Date-Range Queries as the Primary Scope

**Context:**
Queries previously filtered by `calendarId` FK, which was inflexible and prevented back-dating.

**Decision:**
All queries must use `date BETWEEN dateFrom AND dateTo` derived from the CalendarYear record. The `calendarId` FK is for audit trail only.

**Rationale:**

- Enables historical and cross-calendar views
- Decouples data from calendar ownership

**Consequences:**

- Back-dating and cross-calendar attribution work seamlessly
- Engineers must update all queries to use date windows

---

## ADR-5: URL State Standard

**Context:**
URL params for calendar selection were inconsistent (sometimes using fromYear/toYear, sometimes description strings).

**Decision:**
The canonical URL param for selected year is `?year=<calendarYearId>`. The server resolves the CalendarYear and derives date boundaries. Other patterns are deprecated.

**Rationale:**

- Consistent, type-safe routing
- Enables deep linking and bookmarking

**Consequences:**

- Requires coordinated changes across pages
- Known inconsistencies must be fixed

---

## Migration Notes

| Area / File                   | Violation / Action Needed                               |
| ----------------------------- | ------------------------------------------------------- |
| interest-cleansing.service.ts | Hardcoded Jan-Dec dates; must use CalendarYear window   |
| donations form (URL params)   | Uses ?fromYear/?toYear; must use ?year=<calendarYearId> |
| All ledger queries            | Must use date windows, not calendarId as primary filter |

---

## Reference

Other specs should cite this ADR as:

`See [Calendar Attribution ADR](../../../architecture/calendar-attribution/lld.md#adr-X)`
