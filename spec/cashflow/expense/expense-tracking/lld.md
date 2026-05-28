# Expense Tracking — Low-Level Design

## Year & Bank Filter Patterns (do not regress)

### Year Type Selector: `CalendarYearPicker`
The Expense page uses the same shared `CalendarYearPicker` as Income — **do not replace with a plain `Select`**:

```tsx
<CalendarYearPicker
  applicableTypes={['FISCAL', 'ANNUAL']}
  calendarYears={expenseYearData}
  selectedYearId={yearIdParam || undefined}
  defaultType={defaultCalendarType}   // from getUserFiscalYearType()
  onYearChange={handleYearChange}
/>
```

- `defaultCalendarType` is fetched server-side via `getUserFiscalYearType(prisma, userId)`.
- Year URL param is `year` (stores `CalendarYear.id` as a string) — **not** `fromYear`/`toYear`.
- `getCalendarYearsHandler(['FISCAL', 'ANNUAL'])` fetches all years; `CalendarYearPicker` filters internally.
- Default year selected via `getDefaultCalendarYear(expenseYearData, fiscalYearType)`.

### Bank Account Filter
- URL param: `bank` (stores `FinancialAccount.id`).
- Bank options loaded via `listBankAccountsHandler(userId)` → returns `{ id, name, institution: { name } }[]`.
- Option label: `` `${a.name} (${a.institution.name})` ``.
- When a bank is selected, service queries: `OR: [{ bankAccountId }, { source: 'USER_MANUAL' }]` — manual entries always included.

### URL Param Pattern (`expense/form.tsx`)
```ts
const updateURLSearchParams = (key: 'year' | 'bank', value?: string) => {
  const current = new URLSearchParams(searchParams?.toString() ?? '');
  if (!value) current.delete(key);
  else current.set(key, value);
  const search = current.toString();
  router.replace(`${pathname}${search ? `?${search}` : ''}`);
};
```

---

## File Inventory

| File | Role |
|------|------|
| `src/app/(authorized)/cashflow/expense/page.tsx` | Server page — loads years, bank accounts, session; derives selected year and bank; renders `ExpenseForm` + `ExpenseTableServer` |
| `src/app/(authorized)/cashflow/expense/form.tsx` | Client component — `CalendarYearPicker` + bank `Select`; manages URL params `year` and `bank` |
| `src/app/(authorized)/cashflow/expense/ExpenseTableServer.tsx` | Server component — receives `calendarYearId`, `bankAccountId?`, date range; calls `getExpenseDataHandler` |
| `src/server/controllers/expense.controller.ts` | `totalExpensesHandler(calendarYearId, userId, bankAccountId?)` and `getExpenseDataHandler(...)` |
| `src/server/services/expense.service.ts` | Data layer — `getTotalExpenses` and `getMonthlyExpenseSummaries`; filters by date range and optional `bankAccountId` with USER_MANUAL override |
| `src/server/controllers/bank-account.controller.ts` | `listBankAccountsHandler(userId)` — source of bank dropdown options |
| `src/server/services/user-profile/user-profile.service.ts` | `getUserFiscalYearType(prisma, userId)` — user's preferred calendar type |
| `src/utils/calendar-year-defaults.ts` | `getDefaultCalendarYear(years, fiscalYearType)` — default year selection logic |
| `src/components/CalendarYearPicker/index.tsx` | Shared Fiscal/Annual type-toggle + year dropdown component |