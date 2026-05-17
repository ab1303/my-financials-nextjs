# Fiscal Year Default — Low Level Design

## Phase Map

| Phase | Files Changed | Description |
|---|---|---|
| 1 | `src/utils/calendar-year-defaults.ts`, `src/utils/__tests__/calendar-year-defaults.test.ts` | Pure utility + unit tests |
| 2 | `src/server/services/calendar-year.service.ts`, `src/server/controllers/calendar-year.controller.ts`, `src/server/services/user-profile/user-profile.service.ts` | Service / controller layer extensions |
| 3 | `cashflow/income/page.tsx`, `cashflow/expense/page.tsx`, `cashflow/donations/page.tsx` | Thread defaults into cashflow pages |
| 4 | `cashflow/bank-interest/page.tsx`, `cashflow/bank-interest/form.tsx`, `assets/bank/page.tsx` | Thread defaults into bank pages |
| 5 | `reports/income-summary/page.tsx` | Thread default into report page |

---

## Phase 1 — Pure Utility

### File: `src/utils/calendar-year-defaults.ts`

```typescript
import type { CalendarEnumType } from '@prisma/client';

export type CalendarYearOption = {
  id: string;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
  type: CalendarEnumType | null;
};

/**
 * Returns true if `today` falls within the calendar year's date range.
 * Comparison is month-precision: [fromYear/fromMonth, toYear/toMonth] inclusive.
 */
export function isDateInCalendarYear(
  year: CalendarYearOption,
  today: Date,
): boolean {
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-12

  const afterStart =
    todayYear > year.fromYear ||
    (todayYear === year.fromYear && todayMonth >= year.fromMonth);

  const beforeEnd =
    todayYear < year.toYear ||
    (todayYear === year.toYear && todayMonth <= year.toMonth);

  return afterStart && beforeEnd;
}

/**
 * Filters a list of CalendarYear records to only those matching the given types.
 * Records with `type = null` are always excluded.
 */
export function filterCalendarYearsByType(
  calendarYears: CalendarYearOption[],
  types: CalendarEnumType[],
): CalendarYearOption[] {
  return calendarYears.filter(
    (cy) => cy.type !== null && types.includes(cy.type as CalendarEnumType),
  );
}

/**
 * Selects the best default CalendarYear for a given user preference and date.
 *
 * Priority:
 *   1. Year matching `fiscalYearType` whose date range contains `today`
 *   2. Most recent year matching `fiscalYearType` (by fromYear desc)
 *   3. First entry in `calendarYears` (regardless of type)
 *   4. undefined if the list is empty
 */
export function getDefaultCalendarYear(
  calendarYears: CalendarYearOption[],
  fiscalYearType: CalendarEnumType | null | undefined,
  today: Date = new Date(),
): CalendarYearOption | undefined {
  if (calendarYears.length === 0) return undefined;

  const preferredType = fiscalYearType ?? 'FISCAL';

  const preferredYears = calendarYears.filter(
    (cy) => cy.type === preferredType,
  );

  // 1. Date-range match within preferred type
  const currentMatch = preferredYears.find((cy) =>
    isDateInCalendarYear(cy, today),
  );
  if (currentMatch) return currentMatch;

  // 2. Most recent preferred type (assumes list ordered fromYear desc)
  if (preferredYears.length > 0) return preferredYears[0];

  // 3. Fallback to first in list
  return calendarYears[0];
}
```

### File: `src/utils/__tests__/calendar-year-defaults.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  getDefaultCalendarYear,
  filterCalendarYearsByType,
  isDateInCalendarYear,
  type CalendarYearOption,
} from '../calendar-year-defaults';

// Helper
const makeYear = (
  id: string,
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
  type: 'FISCAL' | 'ANNUAL' | 'ZAKAT',
): CalendarYearOption => ({
  id,
  description: `${fromYear}-${toYear}`,
  fromYear,
  fromMonth,
  toYear,
  toMonth,
  type,
});

const FISCAL_2425 = makeYear('fy2425', 2024, 7, 2025, 6, 'FISCAL');
const FISCAL_2324 = makeYear('fy2324', 2023, 7, 2024, 6, 'FISCAL');
const ANNUAL_2024 = makeYear('ay2024', 2024, 1, 2024, 12, 'ANNUAL');
const ANNUAL_2023 = makeYear('ay2023', 2023, 1, 2023, 12, 'ANNUAL');
const ZAKAT_2024 = makeYear('zk2024', 2024, 1, 2024, 12, 'ZAKAT');
```

#### Unit test cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | `isDateInCalendarYear` returns true when today is first month of year | Unit | Boundary: `fromYear/fromMonth` inclusive |
| 2 | `isDateInCalendarYear` returns true when today is last month of year | Unit | Boundary: `toYear/toMonth` inclusive |
| 3 | `isDateInCalendarYear` returns false when today is before start | Unit | Date range exclusion |
| 4 | `isDateInCalendarYear` returns false when today is after end | Unit | Date range exclusion |
| 5 | `filterCalendarYearsByType` removes ZAKAT records | Unit | ZAKAT never appears in non-zakat dropdowns |
| 6 | `filterCalendarYearsByType` removes records with `type = null` | Unit | Null-type safety |
| 7 | `filterCalendarYearsByType` returns only FISCAL when `['FISCAL']` passed | Unit | Single-type filter |
| 8 | `getDefaultCalendarYear` returns the current FISCAL year for a FISCAL user | Unit | Primary happy path |
| 9 | `getDefaultCalendarYear` returns the current ANNUAL year for an ANNUAL user | Unit | User preference respected |
| 10 | `getDefaultCalendarYear` falls back to most recent FISCAL when no date match | Unit | Fallback priority #2 |
| 11 | `getDefaultCalendarYear` falls back to list[0] when no preferred-type years exist | Unit | Fallback priority #3 |
| 12 | `getDefaultCalendarYear` returns `undefined` for empty list | Unit | Empty-list edge case |
| 13 | `getDefaultCalendarYear` uses `FISCAL` as default when `fiscalYearType` is null | Unit | Null preference handling |

---

## Phase 2 — Service / Controller Extensions

### 2a. `src/server/services/calendar-year.service.ts`

**Change**: Add optional `types` param; add `orderBy`.

```typescript
import type { CalendarEnumType } from '@prisma/client';

// BEFORE
export const getCalendarYears = async () =>
  await prisma.calendarYear.findMany();

// AFTER
export const getCalendarYears = async (types?: CalendarEnumType[]) =>
  await prisma.calendarYear.findMany({
    where: types?.length ? { type: { in: types } } : undefined,
    orderBy: [{ fromYear: 'desc' }, { fromMonth: 'desc' }],
  });
```

### 2b. `src/server/controllers/calendar-year.controller.ts`

**Change**: Accept and forward optional `types` param.

```typescript
import type { CalendarEnumType } from '@prisma/client';

// BEFORE
export const getCalendarYearsHandler = async () => {
  const calendarYears = await getCalendarYears();
  ...
};

// AFTER
export const getCalendarYearsHandler = async (types?: CalendarEnumType[]) => {
  const calendarYears = await getCalendarYears(types);
  return calendarYears.map((year) => ({
    id: year.id,
    description: year.description,
    fromYear: year.fromYear,
    fromMonth: year.fromMonth,
    toYear: year.toYear,
    toMonth: year.toMonth,
    type: year.type,
    lockedAt: year.lockedAt ? year.lockedAt.toISOString() : null,
  }));
};
```

### 2c. `src/server/services/user-profile/user-profile.service.ts`

**Change**: Add `getUserFiscalYearType()` — a single-field lookup.

```typescript
export async function getUserFiscalYearType(
  prisma: PrismaClient,
  userId: string,
): Promise<CalendarEnumType | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fiscalYearType: true },
  });
  return user?.fiscalYearType ?? null;
}
```

#### Phase 2 test cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | `getCalendarYears(['FISCAL'])` only returns FISCAL records | Integration | DB-level type filter |
| 2 | `getCalendarYears(['FISCAL', 'ANNUAL'])` excludes ZAKAT records | Integration | Multi-type filter |
| 3 | `getCalendarYears()` with no args returns all records | Integration | Backwards compatibility |
| 4 | `getCalendarYears()` returns records ordered by `fromYear` desc | Integration | Ordering guarantee for fallback selection |

---

## Phase 3 — Cashflow Pages (Income, Expense, Donations)

### Common pattern applied to all three pages

```typescript
// 1. Parallel fetch of calendarYears + fiscalYearType
const [calendarYears, fiscalYearType] = await Promise.all([
  getCalendarYearsHandler(['FISCAL', 'ANNUAL']),  // or ['FISCAL'] for donations
  getUserFiscalYearType(prisma, session.user.id),
]);

// 2. Compute default
const defaultYear = getDefaultCalendarYear(calendarYears, fiscalYearType);
const defaultYearId = defaultYear?.id ?? '';
```

### 3a. `cashflow/income/page.tsx`

**Current**: Filters to FISCAL, falls back to first (via form's `useEffect`).
**Change**: Import `getUserFiscalYearType`, `getDefaultCalendarYear`. Fetch types `['FISCAL', 'ANNUAL']`. Compute `defaultYearId`. Pass `defaultCalendarYearId` to `IncomeForm`.

Props change to `IncomeForm`:
```typescript
type InitialDataType = {
  incomeYearData: Array<CalendarYearType>;
  totalIncome: number;
  defaultCalendarYearId?: string;  // NEW
};
```

Form `useEffect` reads `defaultCalendarYearId` as initial selection when no URL params present (replaces "select first" logic).

### 3b. `cashflow/expense/page.tsx`

**Current**: Has ad-hoc `defaultCalendarYear` date logic (hardcoded for FISCAL Jul start).
**Change**: Replace entire ad-hoc block with:
```typescript
const defaultCalendarYear =
  expenseYearData.find((yd) => yd.fromYear === fromYearParam && yd.toYear === toYearParam) ??
  getDefaultCalendarYear(expenseYearData, fiscalYearType);
```

`ExpenseForm` already receives `selectedCalendarYear` — no prop change needed.

### 3c. `cashflow/donations/page.tsx`

**Current**: No session fetch. Falls back to first in list.
**Change**: Add `session = await auth()` (guards already exist elsewhere), fetch `fiscalYearType`, compute default.

Props change: `DonationForm` receives `defaultCalendarYearId?: string` replacing the "select first in `useEffect`" fallback.

#### Phase 3 test cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | Income page passes correct `defaultCalendarYearId` matching FISCAL user's current year | Integration/E2E | Server-side default wired correctly |
| 2 | Expense page respects URL `?fromYear=2023&toYear=2024` over computed default | Integration | URL params take precedence |
| 3 | Donation page shows FISCAL year pre-selected when no URL params | Integration | FISCAL filter + default |
| 4 | ANNUAL user visiting income page sees ANNUAL year pre-selected | Integration | User preference respected |

---

## Phase 4 — Bank Pages (Bank Interest, Bank Assets)

### 4a. `cashflow/bank-interest/page.tsx` + `form.tsx`

**Current**: Page hardcodes `yd.type === 'ANNUAL'` filter. Form has a `currentYearType` toggle that defaults to `'ANNUAL'`.

**Page change**:
```typescript
// Fetch FISCAL + ANNUAL (no ZAKAT)
const [allYearlyData, fiscalYearType] = await Promise.all([
  getCalendarYearsHandler(['FISCAL', 'ANNUAL']),
  getUserFiscalYearType(prisma, session.user.id),
]);

// Pass ALL filtered years + user's preferred type to form
const initialData = {
  bankOptions,
  yearlyData: allYearlyData,
  initialYearType: fiscalYearType ?? 'FISCAL',  // NEW
};
```

**Form change** — `BankInterestForm` accepts new `initialYearType` prop:
```typescript
type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
    yearlyData: Array<CalendarYearType>;
    initialYearType: 'FISCAL' | 'ANNUAL';  // NEW
  };
  bankIdParam: string;
  yearIdParam: string;
  children?: React.ReactNode;
};
```

`useState` initial value changes from hardcoded `'ANNUAL'` to `initialData.initialYearType`.

### 4b. `assets/bank/page.tsx`

**Current**: `calendarTypeParam = getSelectedParam(params?.type) || 'FISCAL'` — always FISCAL when no URL param.

**Change**:
```typescript
const fiscalYearType = await getUserFiscalYearType(prisma, session.user.id);
const calendarTypeParam =
  getSelectedParam(params?.type) ||
  fiscalYearType ||
  'FISCAL';
```

#### Phase 4 test cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | Bank interest form initialises toggle to ANNUAL for an ANNUAL user | Integration | `initialYearType` prop consumed correctly |
| 2 | Bank interest form initialises toggle to FISCAL for a FISCAL user | Integration | User preference respected |
| 3 | Bank assets page uses `fiscalYearType` as default type when no URL param | Integration | Default type seeded from profile |
| 4 | ZAKAT years do not appear in bank-interest dropdown | Integration | `['FISCAL','ANNUAL']` filter applied |

---

## Phase 5 — Income Summary Report

### `reports/income-summary/page.tsx`

**Current**: Passes `initialCalendarYearId={params.calendarYearId}` (URL param only). Client auto-selects first when empty.

**Change**: Compute `initialCalendarYearId` server-side using the utility:

```typescript
const [allCalendarYears, fiscalYearType] = await Promise.all([
  getCalendarYearsHandler(['FISCAL', 'ANNUAL']),
  getUserFiscalYearType(prisma, session.user.id),
]);

const defaultYear = getDefaultCalendarYear(allCalendarYears, fiscalYearType);

const initialCalendarYearId =
  params.calendarYearId ??         // URL param takes precedence
  defaultYear?.id ??               // smart default
  undefined;
```

**`IncomeSummaryClient` change**: Remove the `useEffect` that auto-selects `yearOptions[0]` (it becomes redundant once `initialCalendarYearId` is always populated by the server).

#### Phase 5 test cases

| # | Test description | Type | What it verifies |
|---|---|---|---|
| 1 | Income summary page passes `initialCalendarYearId` matching user's current fiscal year | Integration | Server-side default propagated |
| 2 | URL param `?calendarYearId=xxx` overrides computed default | Integration | URL precedence preserved |
| 3 | Client `useEffect` for auto-selecting first year is removed / no longer triggers | Unit | No double-selection flicker |

---

## Integration Points & Edge Cases

| Edge Case | Handling |
|---|---|
| User has no `CalendarYear` records at all | `getDefaultCalendarYear` returns `undefined`; pages show existing "no fiscal year found" empty state |
| `fiscalYearType = null` in DB | Utility defaults to `'FISCAL'`; no null-pointer risk |
| `CalendarYear.type = null` | `filterCalendarYearsByType` excludes null-type records |
| User with `ANNUAL` preference visits a **context-locked** page (donations) | `getCalendarYearsHandler(['FISCAL'])` is called unconditionally — user preference is ignored for the type filter; `getDefaultCalendarYear` receives only FISCAL years and returns the most recent FISCAL year |
| User with `ANNUAL` preference visits a **preference-driven** page (income) | `getCalendarYearsHandler(['FISCAL', 'ANNUAL'])` is called; `getDefaultCalendarYear` returns the ANNUAL year matching today |
| Multiple fiscal years active for same period | `isDateInCalendarYear` returns the first match; list is ordered `fromYear DESC` so most recent is tried first |
| `params.fromYear` / `params.toYear` present in URL | URL-based `find()` runs before calling `getDefaultCalendarYear`; result takes precedence |
| `pnpm run build` type errors | All new function params are typed; `CalendarEnumType` imported from `@prisma/client` |
| Zakat years appear in a non-zakat dropdown | Prevented at DB layer — context-locked and preference-driven pages never pass `'ZAKAT'` to `getCalendarYearsHandler` |

---

## Migration Notes

No database migrations are required for this feature. All changes are application-layer only:
- No new columns or tables
- No enum value additions
- No data backfills

The only Prisma-adjacent change is adding `orderBy` to `findMany()` in the calendar-year service, which is purely additive.
