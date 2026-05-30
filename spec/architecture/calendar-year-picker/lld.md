# Calendar Year Picker — LLD (Compound Component Architecture)

## Overview
`CalendarYearPicker` is now a **compound component** using the Vercel Compound Component pattern. State, context, and UI are separated for flexibility and testability. The default export remains backwards-compatible for all consumers.

## File Structure
```
src/components/CalendarYearPicker/
  index.tsx          — Compound component: Provider, Root, TypeControl, YearSelect + default assembled export
  context.ts         — CalendarYearContext, CalendarYearContextValue, useCalendarYearContext
  CalendarTypeSwatch.tsx  — Standalone segmented control primitive (used by TypeControl; also directly testable)
```

## Context Interface (`context.ts`)
```typescript
export interface CalendarYearState {
  selectedType: CalendarEnumType;
  applicableTypes: CalendarEnumType[];
  yearOptions: OptionType[];
  selectedOption: OptionType | null;
  displayLabel: string;  // e.g. "Fiscal Year", "Annual Year"
}

export interface CalendarYearActions {
  onTypeChange: (type: CalendarEnumType) => void;
  onYearChange: (yearId: string | null) => void;
}

export interface CalendarYearContextValue {
  state: CalendarYearState;
  actions: CalendarYearActions;
  labelId: string;  // stable id for <label htmlFor> + <select id> accessibility
}
```

## Compound Sub-Components
| Sub-component | Role |
|---|---|
| `Provider` | Owns all state logic: `selectedType` useState, `yearOptions` useMemo, `selectedOption` useMemo. Injects CalendarYearContextValue. |
| `Root` | Layout shell: `<div className="flex items-center gap-2">`. Composes children. |
| `TypeControl` | Reads `selectedType` + `applicableTypes` from context. Delegates rendering to `CalendarTypeSwatch`. Returns null if `applicableTypes.length <= 1`. |
| `YearSelect` | Reads `yearOptions`, `selectedOption`, `displayLabel` from context. Renders `AppSelect` with `sr-only` Label for accessibility. Width: `min-w-[200px] max-w-[260px]` (confirmed from code). |

## CalendarTypeSwatch (Segmented Control)
- Compact segmented control, not large capsule pills
- Container: `inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5`
- Selected button: `bg-background text-foreground shadow-sm dark:bg-accent`
- Unselected button: `text-muted-foreground hover:text-foreground`
- Button size: `px-2.5 py-0.5 text-xs font-medium rounded`
- Accessibility: `role="group" aria-label="Calendar type"`, `aria-pressed` on each button

## Default Assembled Component (Backwards-Compatible)
```typescript
function CalendarYearPickerDefault(props: CalendarYearPickerProps) {
  return (
    <Provider {...props}>
      <Root>
        <TypeControl />
        <YearSelect />
      </Root>
    </Provider>
  );
}
// Compound sub-components attached:
CalendarYearPickerDefault.Provider = Provider;
CalendarYearPickerDefault.Root = Root;
CalendarYearPickerDefault.TypeControl = TypeControl;
CalendarYearPickerDefault.YearSelect = YearSelect;
```
All existing consumers (Income, Expense, Bank Interest, Donations, Analytics) continue to use `<CalendarYearPicker applicableTypes={...} .../>` unchanged.

## Public Props Interface (Unchanged)
```typescript
export type CalendarYearPickerProps = {
  applicableTypes: CalendarEnumType[];
  calendarYears: CalendarYearType[];
  selectedYearId?: string;
  defaultType?: CalendarEnumType;
  onYearChange: (yearId: string | null) => void;
  onTypeChange?: (type: CalendarEnumType) => void;
  label?: string;         // overrides auto-generated accessible label
  className?: string;
};
```

## Inline Filter Bar Pattern (Cashflow Pages)
All cashflow pages now use year + bank on the **same flex row**:
```tsx
<div className="flex flex-wrap items-end gap-4">
  <CalendarYearPicker applicableTypes={...} ... />
  <div className="flex flex-col space-y-1.5 flex-1 min-w-[280px]">
    <Label>Bank Account</Label>
    <AppSelect className="w-full" ... />
  </div>
</div>
```
- `CalendarYearPicker` stays its natural compact width (segmented control + year dropdown inline)
- Bank Account wrapper uses `flex-1 min-w-[280px]` → grows to fill remaining horizontal space
- On narrow screens: `flex-wrap` causes bank account to wrap below year picker

## Pages Using This Component
| Page | applicableTypes | Bank Account? |
|---|---|---|
| `/cashflow/analytics` | `['FISCAL', 'ANNUAL']` | Yes — same row, `flex-1` |
| `/cashflow/income` | `['FISCAL', 'ANNUAL']` | Yes — same row, `flex-1` |
| `/cashflow/expense` | `['FISCAL', 'ANNUAL']` | Yes — same row, `flex-1` |
| `/cashflow/bank-interest` | `['ANNUAL', 'FISCAL']` | Yes — same row, `flex-1` |
| `/cashflow/donations` | `['FISCAL', 'ANNUAL']` | No |

## Test Coverage
Tests in `src/__tests__/unit/CalendarYearPicker.test.tsx` cover 14 cases:
- CalendarTypeSwatch standalone: renders types, hides when single type, highlights selected, fires callback
- CalendarYearPicker: type switching clears year, filters year options by type, dynamic labels, custom label, controlled selectedYearId, initializes with defaultType

## Status
```
✅ IMPLEMENTED — 2026-05-29
```

---

## Migration from Original Design
- Refactored from monolithic to **compound component** (Provider, Root, TypeControl, YearSelect)
- Capsule pill toggle replaced with **compact segmented control** (`CalendarTypeSwatch`)
- Layout changed from vertical stack to **inline row** for filter bars
- All public props and default usage remain backwards-compatible
