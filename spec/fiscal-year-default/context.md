# Fiscal Year Default — Context

## Problem

Every cashflow and report page fetches all `CalendarYear` records and shows them in a dropdown with no smart default. ZAKAT years appear in income/expense/donation dropdowns and pollute them. The `User.fiscalYearType` preference (`FISCAL` | `ANNUAL`) is stored on the profile but is never read outside the settings page — it could be used to pre-select the correct year and hide irrelevant year types.

---

## File Inventory

### Files to CREATE

| File | Role |
|---|---|
| `src/utils/calendar-year-defaults.ts` | Pure utility — `getDefaultCalendarYear()` and `filterCalendarYearsByType()` |
| `src/utils/__tests__/calendar-year-defaults.test.ts` | Vitest unit tests for the utilities |

### Files to MODIFY

| File | Change |
|---|---|
| `src/server/services/calendar-year.service.ts` | Add optional `types?: CalendarEnumType[]` filter param to `getCalendarYears()` |
| `src/server/controllers/calendar-year.controller.ts` | Pass `types` param through from `getCalendarYearsHandler()` |
| `src/server/services/user-profile/user-profile.service.ts` | Add lightweight `getUserFiscalYearType(prisma, userId)` helper |
| `src/app/(authorized)/cashflow/income/page.tsx` | Fetch `fiscalYearType`, use utility for smart default, filter to FISCAL+ANNUAL |
| `src/app/(authorized)/cashflow/expense/page.tsx` | Replace hardcoded date logic with `getDefaultCalendarYear()`; use `fiscalYearType` |
| `src/app/(authorized)/cashflow/donations/page.tsx` | Fetch session, add date-aware default using utility |
| `src/app/(authorized)/cashflow/bank-interest/page.tsx` | Use `fiscalYearType` to set default calendar type; filter to FISCAL+ANNUAL |
| `src/app/(authorized)/assets/bank/page.tsx` | Seed `calendarTypeParam` default from `fiscalYearType` instead of hardcoded `'FISCAL'` |
| `src/app/(authorized)/reports/income-summary/page.tsx` | Compute `initialCalendarYearId` server-side using utility; pass down |

---

## Schema Details

### `User` model (relevant fields)

```prisma
model User {
  id             String            @id @default(cuid())
  // ...
  fiscalYearType CalendarEnumType? @default(FISCAL)
  // ...
}
```

### `CalendarYear` model

```prisma
model CalendarYear {
  id                      String                  @id @default(cuid())
  description             String
  fromYear                Int
  fromMonth               Int
  toYear                  Int
  toMonth                 Int
  type                    CalendarEnumType?
  lockedAt                DateTime?
  zakatObligations        ZakatObligation[]
  bankInterestLiabilities BankInterestLiability[]
  incomeLedgers           IncomeLedger[]
  expenseLedgers          ExpenseLedger[]
  donationLedgers         DonationLedger[]
}
```

### `CalendarEnumType` enum

```prisma
enum CalendarEnumType {
  ZAKAT
  ANNUAL
  FISCAL
}
```

### Relationships that depend on CalendarYear

```
IncomeLedger      — calendarId FK (onDelete: Restrict)
ExpenseLedger     — calendarId FK (onDelete: Restrict)
DonationLedger    — calendarId FK (onDelete: Restrict)
BankInterestLiability — calendarId FK
ZakatObligation   — calendarId FK
```

---

## Existing Patterns to Reuse

### Server Component data-fetching pattern

All cashflow pages already call `getCalendarYearsHandler()` directly in the async Server Component. They also call `auth()` from `@/server/auth` to get the user session. Pattern:

```typescript
// income/page.tsx (existing)
const session = await auth();
const calendarYears = await getCalendarYearsHandler();
const incomeYearData = calendarYears.filter((yd) => yd.type === 'FISCAL');
```

### Controller / Service pattern

```typescript
// src/server/controllers/calendar-year.controller.ts
export const getCalendarYearsHandler = async () => {
  const calendarYears = await getCalendarYears();
  return calendarYears.map((year) => ({ ...year, lockedAt: year.lockedAt?.toISOString() ?? null }));
};

// src/server/services/calendar-year.service.ts
export const getCalendarYears = async () => await prisma.calendarYear.findMany();
```

### User profile service pattern

```typescript
// src/server/services/user-profile/user-profile.service.ts
export async function getProfile(prisma: PrismaClient, userId: string): Promise<UserProfileData>
// already returns fiscalYearType
```

### Expense page partial defaulting (existing — to be replaced by utility)

```typescript
// expense/page.tsx — current ad-hoc logic
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;
const defaultCalendarYear = expenseYearData.find((yd) => {
  if (currentMonth >= yd.fromMonth) {
    return yd.fromYear === currentYear && yd.toYear === currentYear + 1;
  } else {
    return yd.fromYear === currentYear - 1 && yd.toYear === currentYear;
  }
});
```
This logic is hardcoded for Australian FISCAL year (Jul start). `getDefaultCalendarYear()` will generalise it.

### `CalendarYearType` frontend type

```typescript
// used across all form components — from @/types or local
type CalendarYearType = {
  id: string;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  type: CalendarEnumType | null;
  lockedAt?: string | null;
};
```

---

## Current Filtering Behaviour by Page

| Page | Types shown | Default selection | Reads `fiscalYearType`? |
|---|---|---|---|
| `cashflow/income` | FISCAL only | First in list | ❌ |
| `cashflow/expense` | FISCAL only | Date-aware but hardcoded | ❌ |
| `cashflow/donations` | FISCAL only | First in list | ❌ |
| `cashflow/bank-interest` | ANNUAL only (hardcoded) | First in list + toggle | ❌ |
| `assets/bank` | URL param, defaults FISCAL | First in filtered list | ❌ |
| `reports/income-summary` | FISCAL only | First in list | ❌ |

---

## Data Flow: Current vs Proposed

### Current

```
Server Component (page.tsx)
  → getCalendarYearsHandler()          ← returns ALL types unfiltered
  → filter hard-coded by page
  → pass array to Client Component
       → Client useEffect selects first (or falls back to URL param)
```

### Proposed

```
Server Component (page.tsx)
  → getCalendarYearsHandler({ types })  ← filtered by relevant types
  → getUserFiscalYearType(prisma, userId) ← one extra SELECT
  → getDefaultCalendarYear(filtered, fiscalYearType, today)
  → pass { filtered, defaultId } to Client Component
       → Client initialises react-select with defaultId
```

---

## Known Constraints

- `session.user` (NextAuth) does **not** include `fiscalYearType` — needs a separate DB query via `getUserFiscalYearType()`.
- The `calendarYear` tRPC router only handles `lockYear`/`unlockYear` mutations. Calendar year reads are done via the controller/service, not tRPC. Phase 2 extends the controller, not the router.
- The bank-interest form has an existing ANNUAL/FISCAL toggle (`currentYearType` state). The feature should pre-seed the `initialYearType` prop so the toggle defaults to the user's preference.
- `CalendarYear.type` is nullable (`CalendarEnumType?`). Records with `type = null` should be excluded from all dropdowns.
- No schema migrations are required — this is a pure application-layer change.
