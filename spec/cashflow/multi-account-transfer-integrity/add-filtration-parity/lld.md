# Add Filtration Parity — Low Level Design

## Overview

Adds **bank account filter** and **Calendar Year type toggle** (Fiscal Year / Annual) to the
Expense and Income pages, bringing them to parity with the Donations and Bank Interest pages
which already have both.

This is a **UI-only slice** — no schema changes, no new tRPC procedures.
Safe to implement in parallel with `handle-orphans` and `harden-import-wizard`.

**Depends on:** Nothing — implement independently.

---

## Files to Modify

| File | Change |
|---|---|
| `src/app/(authorized)/cashflow/expense/page.tsx` | Add `bankAccountId` + `calendarType` search params, pass to queries |
| `src/app/(authorized)/cashflow/income/page.tsx` *(or equivalent)* | Same pattern as Expense |
| Expense UI client component *(locate existing)* | Add `BankAccountSelect` dropdown + `CalendarYearType` toggle |
| Income UI client component *(locate existing)* | Same as Expense |
| Expense tRPC router / service | Pass `bankAccountId` filter to `MonthlyExpenseSummary` query |
| Income tRPC router / service | Pass `bankAccountId` filter to income query |

> **Before implementing:** study the Bank Interest page (`src/app/(authorized)/cashflow/bank-interest/`)
> and the Donations page for the exact existing patterns for `BankAccountSelect` and
> `CalendarYearType` — replicate them exactly, do not invent new components.

---

## 1. URL Search Params Pattern

Both Expense and Income pages will accept the same new params:

```typescript
// Add to existing SearchParams type on each page
type SearchParams = {
  fromYear?: string;     // existing
  toYear?: string;       // existing
  calendarType?: 'FISCAL' | 'ANNUAL'; // NEW — default 'FISCAL' (preserves existing behaviour)
  bankAccountId?: string;             // NEW — default undefined (all accounts)
}
```

The `calendarType` default must be `'FISCAL'` to preserve existing user behaviour.

---

## 2. Bank Account Filter

### 2.1 Expense Page

```typescript
// src/app/(authorized)/cashflow/expense/page.tsx (Server Component)

// Extend data fetching to accept bankAccountId:
const expenses = await api.expense.getMonthlySummary.query({
  fromYear,
  toYear,
  calendarType,
  bankAccountId: searchParams.bankAccountId, // NEW
});
```

Pass `bankAccountId` through to the `MonthlyExpenseSummary` Prisma query:

```typescript
where: {
  userId: session.user.id,
  ...(bankAccountId && { bankAccountId }),
  category: { not: TRANSFER_CATEGORY }, // already fixed in fix-transfer-exclusion slice
}
```

### 2.2 Income Page

Income records are linked via `Transaction.incomeRecord`. Filter at the transaction level:

```typescript
where: {
  userId: ctx.session.user.id,
  ...(bankAccountId && {
    transaction: { bankAccountId },
  }),
}
```

---

## 3. Calendar Year Type Toggle

### 3.1 Date Range Derivation

When `calendarType = 'ANNUAL'`, derive dates as Jan 1 → Dec 31 of the selected year
instead of the fiscal year Jul 1 → Jun 30 pattern:

```typescript
function deriveDateRange(year: number, calendarType: 'FISCAL' | 'ANNUAL') {
  if (calendarType === 'ANNUAL') {
    return {
      fromDate: new Date(year, 0, 1),   // Jan 1
      toDate: new Date(year, 11, 31),   // Dec 31
    };
  }
  // FISCAL (existing behaviour):
  return {
    fromDate: new Date(year, 6, 1),     // Jul 1
    toDate: new Date(year + 1, 5, 30),  // Jun 30 next year
  };
}
```

> Verify the exact fiscal year boundary used in the existing Expense page — it may be
> configurable per user or hardcoded. Replicate the same logic; only add the ANNUAL branch.

### 3.2 UI Component

Reuse the existing `CalendarYearType` toggle component already used on the Donations page.
Do not create a new component.

```tsx
// In the Expense / Income page client wrapper component:
<CalendarYearType
  value={calendarType}
  onChange={(type) => router.push({ query: { ...currentQuery, calendarType: type } })}
/>
```

---

## 4. Acceptance Criteria

- [ ] Expense page renders a Bank Account dropdown; selecting an account filters all expense
  totals and charts to that account only
- [ ] Income page renders a Bank Account dropdown with the same behaviour
- [ ] Selecting "All accounts" (empty/default) shows combined totals — existing behaviour preserved
- [ ] Expense page renders a Calendar Year Type toggle (FISCAL / ANNUAL)
- [ ] Income page renders a Calendar Year Type toggle (FISCAL / ANNUAL)
- [ ] `calendarType = 'ANNUAL'` shows Jan–Dec year boundaries; `calendarType = 'FISCAL'` shows
  existing FY boundaries (no regression)
- [ ] Default state (no URL params) shows existing Expense and Income behaviour unchanged
- [ ] Bank account dropdown and calendar toggle are visible in dark mode (all `dark:` variants present)

---

## 5. Implementation Notes

- **No schema migration required.**
- **No new tRPC procedures** — only extend existing query inputs to accept `bankAccountId` and
  `calendarType`.
- **Study Bank Interest and Donations pages before writing any code** — reuse existing
  `BankAccountSelect` and `CalendarYearType` components exactly. Do not duplicate them.
- **Do not** run `pnpm lint --fix`, global formatters, or touch files outside the scope above.
