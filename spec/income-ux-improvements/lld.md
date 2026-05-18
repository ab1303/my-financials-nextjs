# Income UX Improvements — Low Level Design

---

## Phase Map

| Phase | Files Changed | Description |
|-------|--------------|-------------|
| 1 | `columns.tsx`, `_components/SourceBadge.tsx` | Source color badges in the table |
| 2 | `form.tsx`, shared `TableCell` renderer | Fix decimal formatting to always show 2dp |
| 3 | `page.tsx`, `form.tsx` | Promote section heading out of monospace debug style |
| 4 | `IncomeTableClient.tsx`, `_components/SourceBreakdownWidget.tsx` | Source breakdown widget above the table |
| 5 | `IncomeTableClient.tsx` | Monthly grouping with subtotal rows |
| 6 | `_components/SourceBadge.tsx`, `_table/columns.tsx`, `src/components/react-table/TableCell.tsx` | Fix Other badge contrast + amount right-alignment |
| 7 | `IncomeTableClient.tsx` | Fix month header row layout (raw tr/td, bypass TBodyTD span wrapper) |

---

## Phase 1 — Source Color Badges

### Files

| Action | File |
|--------|------|
| CREATE | `src/app/(authorized)/cashflow/income/_components/SourceBadge.tsx` |
| MODIFY | `src/app/(authorized)/cashflow/income/_table/columns.tsx` |

### `SourceBadge.tsx`

```typescript
// Color map keyed on IncomeSource.name (case-insensitive match)
// Dark-mode safe: every entry has both light and dark Tailwind classes

export const SOURCE_COLOR_MAP: Record<string, string> = {
  employment:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  stocks:
    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  dividend:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  rental:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  business:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  interest:
    'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  other:
    'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
};

const FALLBACK =
  'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300';

type Props = { sourceName: string };

export default function SourceBadge({ sourceName }: Props) {
  const colorClass =
    SOURCE_COLOR_MAP[sourceName.toLowerCase()] ?? FALLBACK;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {sourceName}
    </span>
  );
}
```

### `columns.tsx` — updated `incomeSourceName` column

```typescript
columnHelper.accessor('incomeSourceName', {
  size: 180,
  header: () => <span>Income Source</span>,
  cell: ({ getValue }) => <SourceBadge sourceName={getValue()} />,
  footer: (props) => props.column.id,
}),
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| `SourceBadge` renders the source name text | Unit (RTL) | Badge displays `sourceName` prop |
| `SourceBadge` applies blue classes for "Employment" | Unit (RTL) | Color map look-up returns correct class |
| `SourceBadge` falls back to gray for unknown source "Crypto" | Unit (RTL) | Graceful fallback, no crash |
| `SourceBadge` is case-insensitive ("EMPLOYMENT" → blue) | Unit (RTL) | `sourceName.toLowerCase()` applied |

---

## Phase 2 — Decimal Formatting Fix

### Files

| Action | File |
|--------|------|
| MODIFY | `src/app/(authorized)/cashflow/income/form.tsx` |
| MODIFY | `src/components/react-table/TableCell.tsx` (or wherever `AMOUNT` type is rendered) |

### `form.tsx` — Total Earned `NumericFormat`

Add `decimalScale={2}` and `fixedDecimalScale`:

```typescript
<NumericFormat
  id={`${id}-total-income`}
  className='w-3/5 block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
  prefix='$'
  displayType='text'
  thousandSeparator
  decimalScale={2}
  fixedDecimalScale
  value={totalIncome}
  readOnly
/>
```

### `TableCell` — AMOUNT type render

Find the `AMOUNT` case in the shared `TableCell` component and ensure:

```typescript
case 'AMOUNT':
  return (
    <NumericFormat
      value={value as number}
      displayType='text'
      thousandSeparator
      prefix='$'
      decimalScale={2}
      fixedDecimalScale
    />
  );
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| Total Earned renders `$15.80` for value `15.8` | Unit (RTL) | `fixedDecimalScale` pads trailing zero |
| Total Earned renders `$149,210.26` with thousands separator | Unit (RTL) | `thousandSeparator` applied |
| AMOUNT table cell renders `$74.25` for `74.25` | Unit (RTL) | TableCell AMOUNT path uses 2dp |

---

## Phase 3 — Section Heading Improvement

### Files

| Action | File |
|--------|------|
| MODIFY | `src/app/(authorized)/cashflow/income/page.tsx` |

### `page.tsx` — remove orphaned monospace label

The block below in `page.tsx`:

```tsx
{selectedCalendarYear && (
  <div className='font-mono text-muted-foreground mb-3 text-sm'>
    {selectedCalendarYear.description} Income
  </div>
)}
```

Replace with a proper semantic heading:

```tsx
{selectedCalendarYear && (
  <h2 className='text-base font-semibold text-foreground mb-3'>
    {selectedCalendarYear.description} Income
  </h2>
)}
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| Page renders an `<h2>` containing the fiscal year description | Unit (RTL) | Heading tag and text content |
| `font-mono` class is no longer present on the heading | Unit (RTL) | Style regression guard |

---

## Phase 4 — Source Breakdown Widget

### Files

| Action | File |
|--------|------|
| CREATE | `src/app/(authorized)/cashflow/income/_components/SourceBreakdownWidget.tsx` |
| MODIFY | `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx` |

### Interface

```typescript
type SourceBreakdownWidgetProps = {
  entries: IncomeEntryType[];
  totalIncome: number; // passed from StateProvider or summed here
};

type SourceSummary = {
  sourceName: string;
  total: number;
  percentage: number; // 0–100
};
```

### `SourceBreakdownWidget.tsx` logic

```typescript
function computeBreakdown(entries: IncomeEntryType[]): SourceSummary[] {
  const totals: Record<string, number> = {};
  for (const e of entries) {
    totals[e.incomeSourceName] = (totals[e.incomeSourceName] ?? 0) + e.amount;
  }
  const grand = Object.values(totals).reduce((s, v) => s + v, 0);
  return Object.entries(totals)
    .map(([sourceName, total]) => ({
      sourceName,
      total,
      percentage: grand > 0 ? (total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
```

Render a horizontal segmented progress bar + labelled pills below it:

```tsx
<div className='mb-4'>
  {/* Segmented bar */}
  <div className='flex h-2 w-full overflow-hidden rounded-full bg-muted'>
    {breakdown.map((s) => (
      <div
        key={s.sourceName}
        style={{ width: `${s.percentage}%` }}
        className={SOURCE_COLOR_BAR_MAP[s.sourceName.toLowerCase()] ?? 'bg-gray-400'}
        title={`${s.sourceName}: ${s.percentage.toFixed(1)}%`}
      />
    ))}
  </div>
  {/* Legend */}
  <div className='mt-2 flex flex-wrap gap-2'>
    {breakdown.map((s) => (
      <div key={s.sourceName} className='flex items-center gap-1.5 text-xs text-muted-foreground'>
        <SourceBadge sourceName={s.sourceName} />
        <NumericFormat value={s.total} displayType='text' thousandSeparator prefix='$' decimalScale={2} fixedDecimalScale />
        <span>({s.percentage.toFixed(1)}%)</span>
      </div>
    ))}
  </div>
</div>
```

### `IncomeTableClient.tsx` — add widget above `<Table>`

```tsx
// Add above <Table> in the return:
{data.length > 0 && <SourceBreakdownWidget entries={data} />}
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| Widget renders nothing when `entries` is empty | Unit (RTL) | No empty bar rendered |
| Widget shows correct percentages for 2-source dataset | Unit (RTL) | `computeBreakdown` maths |
| Widget renders a `SourceBadge` for each source | Unit (RTL) | Legend items present |
| `computeBreakdown` handles single source (100%) | Unit | Edge case: grand = total |
| `computeBreakdown` sorts by descending total | Unit | Largest source first |

---

## Phase 5 — Monthly Grouping with Subtotals

### Files

| Action | File |
|--------|------|
| MODIFY | `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx` |

### Grouping approach

Pre-group `data[]` by year-month **before** passing to TanStack, so that row
indices remain stable for the `editedRows` Map.

```typescript
type MonthGroup = {
  key: string;           // e.g. "2025-05"
  label: string;         // e.g. "May 2025"
  subtotal: number;
  entries: Array<{ entry: IncomeEntryType; originalIndex: number }>;
};

function groupByMonth(entries: IncomeEntryType[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>();
  entries.forEach((entry, originalIndex) => {
    const d = new Date(entry.dateEarned);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    if (!map.has(key)) map.set(key, { key, label, subtotal: 0, entries: [] });
    const group = map.get(key)!;
    group.subtotal += entry.amount;
    group.entries.push({ entry, originalIndex });
  });
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}
```

### Render pattern

Replace the flat `table.getRowModel().rows.map(...)` with:

```tsx
{groupByMonth(data).map((group) => (
  <React.Fragment key={group.key}>
    {/* Group header row */}
    <Table.TBody.TR className='bg-muted/30'>
      <Table.TBody.TD colSpan={columns.length} className='py-1.5 px-3'>
        <div className='flex items-center justify-between'>
          <span className='text-sm font-semibold text-foreground'>
            {group.label}
          </span>
          <NumericFormat
            value={group.subtotal}
            displayType='text'
            thousandSeparator
            prefix='$'
            decimalScale={2}
            fixedDecimalScale
            className='text-sm font-semibold text-foreground'
          />
        </div>
      </Table.TBody.TD>
    </Table.TBody.TR>
    {/* Entry rows — use originalIndex to keep editedRows map stable */}
    {group.entries.map(({ originalIndex }) => {
      const row = table.getRowModel().rows[originalIndex];
      if (!row) return null;
      return (
        <Table.TBody.TR key={row.id}>
          {row.getVisibleCells().map((cell) => (
            <Table.TBody.TD key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </Table.TBody.TD>
          ))}
        </Table.TBody.TR>
      );
    })}
  </React.Fragment>
))}
```

### Edge cases

| Case | Handling |
|------|----------|
| New temp row (`id.startsWith('temp-')`) | `dateEarned` is `new Date()` → placed in current month group automatically |
| Empty `data[]` | `groupByMonth([])` returns `[]` → no rows rendered, existing empty-state message handles it |
| Entries spanning >12 months (unusual) | Each month gets its own group; no limit enforced |

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| `groupByMonth` returns groups sorted newest-first | Unit | Sort order |
| `groupByMonth` calculates correct subtotal per month | Unit | `subtotal` summation |
| `groupByMonth` preserves `originalIndex` for each entry | Unit | Edit compatibility |
| Month header row renders month label and formatted subtotal | Integration (RTL) | Heading text + `$x,xxx.xx` |
| Inline edit still saves after grouping change | E2E (Playwright) | `originalIndex` mapping correct |
| Temp row appears in current-month group on "+ Add Entry" | Integration (RTL) | `new Date()` → correct group key |

---

## Migration Notes

No schema or database changes. No migration required.

---

## Integration Points

| Point | Detail |
|-------|--------|
| `StateProvider` / `useIncomeEntryState()` | `data[]` is the single source of truth for both grouping and breakdown — no additional fetch |
| `router.refresh()` after save/delete | Continues to work; `data[]` is updated via `dispatch` before `router.refresh()` |
| `editedRows: Map<number, IncomeEntryType>` | `originalIndex` preserves row-index contract with TanStack; no change to mutation handlers |
| `SOURCE_COLOR_MAP` exported from `SourceBadge.tsx` | `SourceBreakdownWidget` imports and reuses the same map for the segmented bar colours |

---

## Phase 6 — Other Badge Contrast + Amount Right-Alignment

### Files

| Action | File |
|--------|------|
| MODIFY | `src/app/(authorized)/cashflow/income/_components/SourceBadge.tsx` |
| MODIFY | `src/app/(authorized)/cashflow/income/_table/columns.tsx` |
| MODIFY | `src/components/react-table/TableCell.tsx` |

### `SourceBadge.tsx` — fix `other` and `FALLBACK` dark mode

```typescript
// Change 'other' entry and FALLBACK from:
other: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
const FALLBACK = 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300';

// To (higher contrast in dark mode):
other: 'bg-gray-100 text-gray-700 dark:bg-gray-600/60 dark:text-gray-100',
const FALLBACK = 'bg-gray-100 text-gray-700 dark:bg-gray-600/60 dark:text-gray-100';
```

### `columns.tsx` — right-align amount column header

```typescript
columnHelper.accessor('amount', {
  size: 180,
  maxSize: 200,
  header: () => <span className='block text-right'>Amount Earned</span>,
  cell: TableCell,
  meta: { type: 'AMOUNT', propName: 'amount', align: 'right' },
  footer: (props) => props.column.id,
}),
```

### `TableCell.tsx` — right-align read-only AMOUNT cell

In the **non-edit** `AMOUNT` renderer, add `className='tabular-nums text-right block'`:

```typescript
AMOUNT: () => (
  <NumericFormat
    itemRef=''
    className='tabular-nums text-right block'
    prefix='$'
    displayType='text'
    thousandSeparator
    decimalScale={2}
    fixedDecimalScale
    value={value as number}
  />
),
```

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| `SourceBadge` "Other" has `dark:bg-gray-600/60` class | Unit (RTL) | Contrast fix applied |
| `SourceBadge` unknown source has `dark:bg-gray-600/60` fallback | Unit (RTL) | Fallback also fixed |
| AMOUNT cell container has `text-right` class | Unit (RTL) | Right-alignment applied |

---

## Phase 7 — Month Header Row Layout Fix

### Files

| Action | File |
|--------|------|
| MODIFY | `src/app/(authorized)/cashflow/income/IncomeTableClient.tsx` |

### Problem

`Table.TBody.TD` wraps all children in `<span className='text-sm text-foreground'>`, which turns the block `<div className='flex justify-between'>` inside a span — an invalid nesting that breaks the layout. `Table.TBody.TR` also does not accept a `className` prop, so row-level background styling silently fails.

### Fix — use raw `<tr><td>` for month header rows

Replace `Table.TBody.TR` / `Table.TBody.TD` **only on the group header row** with native `<tr>` / `<td>`:

```tsx
{/* Month group header row — raw tr/td to bypass TBodyTD <span> wrapper */}
<tr className='bg-muted/50 border-t border-b border-border'>
  <td colSpan={columns.length} className='px-6 py-2'>
    <div className='flex items-center justify-between'>
      <span className='text-sm font-semibold text-foreground'>
        {group.label}
      </span>
      <NumericFormat
        value={group.subtotal}
        displayType='text'
        thousandSeparator
        prefix='$'
        decimalScale={2}
        fixedDecimalScale
        className='text-sm font-semibold text-foreground tabular-nums'
      />
    </div>
  </td>
</tr>
```

Keep all data entry rows using `Table.TBody.TR` / `Table.TBody.TD` as-is.

### TDD Test Cases

| Test description | Test type | What it verifies |
|-----------------|-----------|-----------------|
| Month header renders a native `<tr>` with `bg-muted/50` class | Unit (RTL) | Raw tr used, not TBodyTR |
| Month header contains a flex div with label and subtotal | Unit (RTL) | Layout not broken by span wrapper |
| Month header `<td>` has correct `colSpan` equal to column count | Unit (RTL) | Full-width span |

