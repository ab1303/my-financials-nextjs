# Interest Cleansing – LLD

## Phase Map
| Phase | Description |
|-------|-------------|
| 1     | Service fix: derive date window from CalendarYear, fix donation query |
| 2     | Page integration: CalendarYearPicker (ANNUAL+FISCAL), pass applicableTypes |
| 3     | Back-dating validation: test with historical CalendarYear records |

## Architecture Decisions
- > Per [ADR-1](../../../architecture/calendar-attribution/lld.md#adr-1): derive `dateFrom`/`dateTo` from CalendarYear fields, never hardcode.
- > Per [ADR-4](../../../architecture/calendar-attribution/lld.md#adr-4): query donations by `datePaid` within window, not just FK.
- > CalendarYearPicker: see [Calendar Year Picker ADR](../../../architecture/calendar-year-picker/lld.md)

## Phase 1: Service Fix

### Before (buggy)
```typescript
// WRONG — ignores fromMonth, hardcodes January start
const dateFrom = new Date(calendarYear.fromYear, 0, 1);
const dateTo = new Date(calendarYear.fromYear, 11, 31, 23, 59, 59);

const donations = await prisma.donationPayment.findMany({
  where: {
    donationPurpose: 'INTEREST_CLEANSING',
    donationLedger: { calendarId: calendarYearId }, // FK-based — wrong
  }
});
```

### After (fixed)
```typescript
// CORRECT — respects actual calendar window boundaries
const dateFrom = new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1);
const dateTo = new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59);

const donations = await prisma.donationPayment.findMany({
  where: {
    donationPurpose: 'INTEREST_CLEANSING',
    datePaid: { gte: dateFrom, lte: dateTo }, // date-range — correct
  }
});
```

#### Function Signature
```typescript
async function getInterestCleansingSummary(calendarYear: CalendarYear): Promise<InterestCleansingSummary>;
```

## Phase 2: Page Integration
- Pass `applicableTypes: ['ANNUAL', 'FISCAL']` to CalendarYearPicker
- Remove restriction to ANNUAL only
- CalendarYearPicker controls the window for all queries

## Phase 3: Back-dating Validation
- Create/select historical CalendarYear (e.g., Annual 2022, Fiscal 2021-22)
- Validate that all liabilities and donations within the window are included

## Transaction Category Matching

The `Credit Interest` income source is the canonical anchor for bank savings account interest.
When transactions are imported from CSV, the AI classifier assigns `Credit Interest` as the category for bank interest payments.

The service queries using a category-based OR clause:

```typescript
OR: [
  { category: { equals: 'Credit Interest', mode: 'insensitive' } }, // canonical anchor
  { category: { equals: 'Bank Interest', mode: 'insensitive' } },   // legacy fallback
]
```

This handles:
- All newly imported transactions classified by AI as `Credit Interest`
- Any historical data explicitly categorised as `Bank Interest`

> **Note:** The previous description-based fallback (`description CONTAINS 'interest'`) has been
> removed. A one-time data migration was run to re-categorize all existing transactions
> where `description = 'Credit Interest'` and `category = 'Other'` → `category = 'Credit Interest'`.


| Test Case | Description |
|-----------|-------------|
| 1 | Returns correct interest/donation totals for ANNUAL year |
| 2 | Returns correct interest/donation totals for FISCAL year |
| 3 | Back-dated CalendarYear includes all matching records |
| 4 | Donations outside window are excluded |
| 5 | Service fix: no hardcoded Jan-Dec, respects fromMonth/toMonth |

## File Inventory
| File | Change |
|------|--------|
| src/server/services/bank-interest/interest-cleansing.service.ts | Fix date window, fix donation query |
| src/app/(authorized)/cashflow/bank-interest/page.tsx | Pass applicableTypes, integrate CalendarYearPicker |
| src/app/(authorized)/cashflow/bank-interest/BankInterestTableServer.tsx | Fix date derivation |

## Migration Notes
- Existing BankInterestLiability records are now queried by date range, not just year/month
- Verify all records have correct year/month fields for accurate inclusion in new queries
