# Fiscal Year Default — High Level Design

## Problem & Solution

All cashflow and report pages fetch every `CalendarYear` record and default to the first item in the list. This means users must manually select the correct year on every page visit, ZAKAT calendar years appear in income/expense/donation dropdowns where they are irrelevant, and the `User.fiscalYearType` profile preference (`FISCAL` for Jul–Jun Australian financial year, `ANNUAL` for Jan–Dec calendar year) is stored but ignored.

The proposed solution adds a thin utility layer (`getDefaultCalendarYear` + `filterCalendarYearsByType`) and threads `fiscalYearType` from the authenticated session through each Server Component page. Each page will filter calendar years to the relevant types for its context and pre-select the year whose date range contains today. No schema changes are needed.

---

## Architecture Decisions

### 1. Resolve the default in the Server Component, not the Client Component

**Rationale**: Server Components already call `auth()` and `getCalendarYearsHandler()`. Adding one extra `getUserFiscalYearType()` call (a single indexed SELECT) costs negligible latency and keeps Client Components stateless with respect to defaults. Client-side tRPC calls would introduce a loading flicker and violate the project rule "never fetch data in Client Components if it can be done on the server."

### 2. Add `getUserFiscalYearType()` to the user-profile service rather than expanding the NextAuth session

**Rationale**: Adding `fiscalYearType` to the JWT/session callback would require touching the auth config and re-issuing tokens. For a read-only preference, a lightweight parallel DB query from the Server Component is simpler and avoids session inflation. The function is a single-field `findUnique` query with an indexed PK lookup.

### 3. Add an optional `types?: CalendarEnumType[]` filter to `getCalendarYearsHandler`

**Rationale**: Filtering at the Prisma query level (via `where: { type: { in: types } }`) is more efficient than fetching all records and filtering in JS. The change is backwards-compatible — passing no `types` returns all records as today. Each page passes only the types relevant to its context.

### 4. Implement `getDefaultCalendarYear()` as a pure, date-injectable utility function

**Rationale**: Pure functions are trivially testable. Injecting `today: Date` (defaulting to `new Date()`) allows deterministic unit tests without time mocking. The function generalises the ad-hoc logic that currently lives in `expense/page.tsx`, eliminating duplication across all pages.

### 5. Two categories of calendar type binding

Each page falls into one of two categories:

**A) Context-locked** — the page's domain semantics dictate the valid calendar type(s). User preference is irrelevant to which *types* are shown; it only affects which specific year is pre-selected within the allowed set.

**B) Preference-driven** — the page has no inherent calendar type requirement. The user's `fiscalYearType` drives both the type filter and the default year selection.

| Context | Category | Allowed types | Rationale |
|---|---|---|---|
| Donations (`cashflow/donations`) | Context-locked | `FISCAL` only | DGR deductions in Australia are always per fiscal year (Jul–Jun). An ANNUAL user is still subject to this legal constraint. |
| Zakat (`/zakat`) | Context-locked | `ZAKAT` only | Islamic lunar calendar is definitionally required. Already implemented; **out of scope** for this feature. |
| Income (`cashflow/income`) | Preference-driven | `FISCAL`, `ANNUAL` | Taxable income can be reported per either year type |
| Expense (`cashflow/expense`) | Preference-driven | `FISCAL`, `ANNUAL` | Same as income |
| Bank Interest (`cashflow/bank-interest`) | Preference-driven | `FISCAL`, `ANNUAL` | Interest can be tracked per calendar or fiscal year |
| Bank Assets (`assets/bank`) | Preference-driven | `FISCAL`, `ANNUAL` | Cash snapshots are date-bound, not ZAKAT-specific |
| Income Summary report | Preference-driven | `FISCAL`, `ANNUAL` | Report covers both year types |

> **Key rule**: ZAKAT calendar years must **never** appear in any context-locked or preference-driven non-zakat page. The `/settings/calendar` management page and `/zakat` pages are out of scope and should not be changed.

### 6. Smart default algorithm

```
1. Filter calendar years by allowed types for this context
2. Among the filtered list, find the record where:
     fromYear/fromMonth ≤ today ≤ toYear/toMonth
   and type === user.fiscalYearType
3. If no date-range match: fall back to the most recent record matching user.fiscalYearType
4. If still no match (user has no years of their preferred type): fall back to [0] of the filtered list
5. If list is empty: return undefined (page shows "no fiscal year found" message)
```

### 7. No breaking changes to existing Client Component props

Client Components (`IncomeForm`, `ExpenseForm`, `DonationForm`, `BankInterestForm`) receive a pre-selected default from their Server Component parent. They continue to handle user-driven year changes via react-select `onChange`. Only the Server Component pages are modified; Client Component prop types gain one optional `defaultCalendarYearId?: string` field where not already present.

---

## Data Model Changes

No Prisma schema migrations required.

Service-layer change only:

```typescript
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

---

## Component / Service Changes (high-level)

| Layer | File | Change |
|---|---|---|
| Utility | `src/utils/calendar-year-defaults.ts` | **New** — pure `getDefaultCalendarYear()` + `filterCalendarYearsByType()` |
| Service | `src/server/services/calendar-year.service.ts` | Add `types?` param + orderBy |
| Service | `src/server/services/user-profile/user-profile.service.ts` | Add `getUserFiscalYearType()` helper |
| Controller | `src/server/controllers/calendar-year.controller.ts` | Forward `types?` to service |
| Page | `cashflow/income/page.tsx` | Fetch `fiscalYearType`, call utility, pass `defaultCalendarYearId` |
| Page | `cashflow/expense/page.tsx` | Replace hardcoded logic with utility call |
| Page | `cashflow/donations/page.tsx` | Add session fetch, call utility |
| Page | `cashflow/bank-interest/page.tsx` | Fetch `fiscalYearType`, pass `initialYearType` to form |
| Page | `assets/bank/page.tsx` | Use `fiscalYearType` as default for `calendarTypeParam` |
| Page | `reports/income-summary/page.tsx` | Compute `initialCalendarYearId` server-side, pass to client |
| Client | `cashflow/bank-interest/form.tsx` | Accept `initialYearType` prop |

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | A FISCAL user landing on `/cashflow/income` sees the current AUS fiscal year pre-selected | Manual test: today is Jul–Jun → correct year selected |
| 2 | An ANNUAL user landing on `/cashflow/income` sees the current calendar year pre-selected | Set `fiscalYearType = ANNUAL` in profile → verify |
| 3 | ZAKAT years do NOT appear in income, expense, donation, bank-interest, or bank-assets dropdowns | Verify dropdown options programmatically |
| 4 | If no year matches today's date, the most recent year is selected (not empty) | Unit test with future-only years |
| 5 | Bank interest form defaults the type toggle to the user's `fiscalYearType` | Set ANNUAL → visit bank-interest → toggle shows ANNUAL pre-selected |
| 6 | All existing URL param overrides still work (visiting `?fromYear=2023&toYear=2024` respects the URL) | Manual navigation test |
| 7 | `getDefaultCalendarYear()` passes all unit tests | `pnpm test` |
| 8 | `pnpm run build` succeeds with no TypeScript or ESLint errors | CI / local build |

---

## Out of Scope / Future Phases

| Item | Reason |
|---|---|
| Adding `fiscalYearType` to the NextAuth JWT session | Larger change; separate concern; sessions would need re-issue |
| Zakat calendar year dropdown in `/zakat` page | Already scoped to ZAKAT type; no change needed |
| `/settings/calendar` calendar year management page | Admin/create flow; no default selection needed |
| Persisting "last selected year" per page | Out of scope; URL params already serve this purpose |
| Donation context allowing ANNUAL years | Product decision: donations are always by FISCAL year in AU |
| Automatic year creation for current period | Separate feature request |
