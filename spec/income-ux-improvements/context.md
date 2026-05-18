# Income UX Improvements — Context

## Problem Summary

The `/cashflow/income` CRUD page renders income entries as a flat chronological
list with no monthly grouping, no visual source differentiation, and no inline
composition summary. Users must mentally scan and tally 14+ rows to understand
their income make-up for a fiscal year. Source breakdown insight requires
navigating to a separate report page (`/reports/income-summary`), breaking the
"manage and understand" flow.

---

## File Inventory

### Files to MODIFY

| File | Change |
|------|--------|
| `src/app/(authorized)/cashflow/income/_table/columns.tsx` | Replace plain text `incomeSourceName` cell with `SourceBadge` component |
| `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx` | Add monthly group headers + subtotals; add source breakdown widget above table; Phase 8: replace grouped-table rendering with `MonthAccordionPanel` list |
| `src/app/(authorized)/cashflow/income/form.tsx` | Fix section heading (monospace → `<h2>`); fix `NumericFormat` to always render 2dp |
| `src/app/(authorized)/cashflow/income/page.tsx` | Minor: ensure section label is removed from `IncomeTableServer` wrapper |

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/app/(authorized)/cashflow/income/_components/SourceBadge.tsx` | Color-coded pill for income source name |
| `src/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget.tsx` | Compact widget showing % per source above the table |
| `src/app/(authorized)/cashflow/income/_components/MonthAccordionPanel.tsx` | Collapsible month row: summary header + expandable entries + scoped Add Entry |

---

## Prisma Schema (verbatim)

```prisma
model IncomeSource {
  id            String         @id @default(cuid())
  name          String         @unique
  description   String?        @db.Text
  isActive      Boolean        @default(true)
  createdAt     DateTime       @default(now())
  incomeRecords IncomeRecord[]
}

model IncomeLedger {
  id         String         @id @default(cuid())
  calendar   CalendarYear   @relation(fields: [calendarId], references: [id])
  calendarId String
  userId     String
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  records    IncomeRecord[]
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@unique([calendarId, userId])
}

model IncomeRecord {
  id              String       @id @default(cuid())
  dateEarned      DateTime
  amount          Decimal      @db.Money
  incomeSource    IncomeSource @relation(fields: [incomeSourceId], references: [id])
  incomeSourceId  String
  incomeLedger    IncomeLedger @relation(fields: [incomeLedgerId], references: [id], onDelete: Cascade)
  incomeLedgerId  String
  transaction     Transaction? @relation(fields: [transactionId], references: [id], onDelete: SetNull)
  transactionId   String?      @unique
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([incomeLedgerId, dateEarned])
}
```

### Key type (client-side)

```typescript
// src/app/(authorized)/cashflow/income/_types.ts
export type IncomeEntryType = {
  id: string;
  dateEarned: Date;
  amount: number;          // Decimal serialised as number
  incomeSourceId: string;
  incomeSourceName: string; // denormalised from IncomeSource.name
  incomeLedgerId: string;
};
```

---

## Existing Patterns to Reuse

| Pattern | Location |
|---------|----------|
| TanStack Table inline edit | `IncomeTableClient.tsx` + `_table/columns.tsx` |
| `StateProvider` / `useIncomeEntryState()` for `data[]` | `StateProvider.tsx` |
| `NumericFormat` for monetary display | `form.tsx`, `IncomeSummaryClient.tsx` |
| `AppSelect` (react-select, unstyled + classNames) | `form.tsx` |
| Sonner `toast` | `IncomeTableClient.tsx` |
| Color-coded source badges pattern | `src/app/(authorized)/reports/income-summary/SourceBreakdownRow.tsx` |

---

## Data Flow

### Current

```
page.tsx (Server)
  → totalIncomeHandler()          ← DB
  → getCalendarYearsHandler()     ← DB
  → IncomeForm (Client)
      ├─ Fiscal Year select
      ├─ Total Earned (read-only field, disconnected from table)
      └─ IncomeTableServer (Server)
           → getIncomeEntriesHandler()   ← DB
           → IncomeTableClient (Client)
                → flat TanStack Table rows (no grouping, plain text source)
```

### Proposed (Phases 1–7)

```
page.tsx (Server)          [unchanged]
  → IncomeForm (Client)
      ├─ Fiscal Year select
      ├─ Total Earned badge (styled, near breakdown widget)
      └─ IncomeTableServer (Server)
           → IncomeTableClient (Client)
                ├─ SourceBreakdownWidget  ← derived from data[] (no new fetch)
                └─ Grouped table
                     ├─ Month header row  (e.g. "May 2025  —  $20,369")
                     │    └─ IncomeRecord rows with SourceBadge
                     └─ Month header row  (e.g. "Apr 2025  —  $9,860.25")
                          └─ ...
```

### Proposed (Phase 8 — Collapsible Monthly Summary)

```
page.tsx (Server)          [unchanged]
  → IncomeForm (Client)
      ├─ Fiscal Year select + Annual Total KPI
      └─ IncomeTableServer (Server)
           → IncomeTableClient (Client)
                ├─ SourceBreakdownWidget  (collapsed by default, toggleable)
                └─ Accordion list  ← replaces grouped flat table
                     ├─ MonthAccordionPanel  "May 2025  $20,369  3 entries  ▶"
                     │    └─ [expanded] TanStack inline-edit table (May entries)
                     │         └─ [+ Add Entry to May 2025]
                     ├─ MonthAccordionPanel  "Apr 2025  $18,500  2 entries  ▼"
                     │    └─ [expanded] TanStack inline-edit table (Apr entries)
                     │         └─ [+ Add Entry to Apr 2025]
                     └─ ...
                [+ Add Entry]  ← global fallback opens current-month panel
```

---

## Constraints & Gotchas

- **No schema changes** — purely a rendering/UX layer change.
- **Inline edit compatibility** — monthly grouping must NOT break the existing
  TanStack Table inline-edit flow (row index used in `editedRows` Map). Safe
  approach: pre-group data before passing to TanStack, OR render group headers
  outside TanStack as sticky `<tr>` separators.
- **Source colors must work in dark mode** — always pair Tailwind color with
  `dark:` variant.
- **`IncomeSource.name` is free text** — color map must handle unknown sources
  gracefully (fallback to neutral badge).
- **`amount` decimal precision** — `NumericFormat` must use `decimalScale={2}
  fixedDecimalScale` everywhere on the income page (currently missing in
  `form.tsx` Total Earned display and in the table `AMOUNT` cell).
