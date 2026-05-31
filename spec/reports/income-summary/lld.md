# Income Summary Report — Low-Level Design (LLD)

## Data Flow
1. **Server Component (`page.tsx`)**: Authenticates user, fetches fiscal years, resolves default year, passes props to client.
2. **Client Component (`IncomeSummaryClient.tsx`)**: Renders fiscal year selector, KPI cards, fetches monthly summary via REST API, updates URL, renders table.
3. **API Route (`/api/income/monthly-summary`)**: Accepts `calendarYearId` and `userId` (⚠️ see security issue), queries confirmed credit transactions, groups by month and source.
4. **Service Layer (`income.service.ts`)**: Aggregates data, returns monthly summary and totals.

## Key TypeScript Interfaces
```typescript
interface MonthlyIncomeSummary {
  month: number;         // 1–12
  monthName: string;     // "July", "August", etc.
  totalAmount: number;
  sources: Array<{
    sourceName: string;
    amount: number;
    transactionCount: number;
  }>;
}
```

## API Contract
**GET** `/api/income/monthly-summary?calendarYearId=...&userId=...`
- **Params:**
  - `calendarYearId` (string, required)
  - `userId` (string, required, ⚠️ should be derived from session)
- **Response:**
```typescript
{
  monthly: MonthlyIncomeSummary[];
  totalIncome: number;
  averageMonthlyIncome: number;
  monthsRecorded: number;
}
```

## Known Gaps / Issues
| Issue                                      | Impact         | Notes                                      |
|---------------------------------------------|---------------|---------------------------------------------|
| ⚠️ userId in query param (security)         | High          | Allows access to other users' data          |
| No toast on fetch error                     | Medium        | Only logs to console                       |
| No empty state message                      | Low           | UI unclear when no data for selected year   |

## TDD Test Cases
| Test                                              | Type      | Verifies                                   |
|---------------------------------------------------|-----------|--------------------------------------------|
| Returns correct monthly summary for fiscal year   | API       | Data grouped by month/source, correct sums |
| Prevents access to other users' data              | Security  | API ignores/overrides userId param         |
| Shows empty state when no data for year           | UI        | Table and KPIs handle empty response       |

## As-Built File Inventory
| File                                                        | Status | Description                                                      |
|-------------------------------------------------------------|--------|------------------------------------------------------------------|
| src/app/(authorized)/reports/income-summary/page.tsx         | ✅     | Server Component: auth, fetch fiscal years, resolve default year |
| src/app/(authorized)/reports/income-summary/IncomeSummaryClient.tsx | ✅     | Client: year selector, KPIs, fetches API, renders table          |
| src/app/(authorized)/reports/income-summary/MonthlySummaryTable.tsx | ✅     | Table of monthly totals with source breakdown                    |
| src/app/(authorized)/reports/income-summary/SourceBreakdownRow.tsx  | ✅     | Per-source row within MonthlySummaryTable                        |
| src/app/api/income/monthly-summary/route.ts                  | ✅     | GET handler: queries transactions, groups by month/category      |
| src/server/services/income.service.ts                        | ✅     | getMonthlySummary, getTotalIncome                                |
| src/server/controllers/calendar-year.controller.ts           | ✅     | getCalendarYearsHandler for fiscal years                         |
