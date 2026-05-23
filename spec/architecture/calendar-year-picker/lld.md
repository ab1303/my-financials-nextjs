# Calendar Year Picker — LLD

## Phase Map
| Phase | Description |
|-------|-------------|
| 1     | Create CalendarYearPicker + CalendarTypeSwatch components |
| 2     | Migrate bank-interest to use CalendarYearPicker |
| 3     | Migrate donations to use CalendarYearPicker; standardise URL param |

## TypeScript Interfaces
```typescript
export type CalendarYearPickerProps = {
  applicableTypes: CalendarEnumType[];
  calendarYears: CalendarYearType[];
  selectedYearId?: string;
  defaultType?: CalendarEnumType;
  onYearChange: (yearId: string | null) => void;
  onTypeChange?: (type: CalendarEnumType) => void;
  label?: string;
  className?: string;
};

export type CalendarTypeSwatchProps = {
  types: CalendarEnumType[];
  selectedType: CalendarEnumType;
  onTypeChange: (type: CalendarEnumType) => void;
  className?: string;
};
```

## CalendarTypeSwatch Skeleton
- Renders pill buttons for each type in `types`
- Selected pill has primary background
- Labels: "Annual", "Fiscal", "Zakat" (not enum)
- Calls `onTypeChange(type)` on click
- Only renders if `types.length > 1`

## URL State Handling
- On year select: `router.replace({ query: { year: <id> } })`
- On type switch: clears `year` param
- Server resolves CalendarYear by ID, derives dateFrom/dateTo

## Per-Screen Configuration
| Page              | applicableTypes         | Toggle? |
|-------------------|------------------------|---------|
| bank-interest     | ['ANNUAL', 'FISCAL']   | Yes     |
| donations        | ['FISCAL']             | No      |
| zakat            | ['ZAKAT']              | No      |
| income           | ['FISCAL']             | No      |
| expenses         | ['FISCAL']             | No      |

## Service Fix (bank-interest)
**Before:**
```typescript
new Date(calendarYear.fromYear, 0, 1)
new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59)
```
**After:**
```typescript
new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1)
new Date(calendarYear.toYear, calendarYear.toMonth, 0, 23, 59, 59)
```

## TDD Test Cases
| Test | Description |
|------|-------------|
| 1    | Toggle only shows declared types |
| 2    | Switching type clears selected year |
| 3    | Selecting year sets ?year param |
| 4    | Service derives correct dateFrom/dateTo from selected year |

## File Inventory
| File | Action | Description |
|------|--------|-------------|
| src/components/CalendarYearPicker/index.tsx | CREATE | Main picker component |
| src/components/CalendarYearPicker/CalendarTypeSwatch.tsx | CREATE | Type toggle subcomponent |
| src/app/(authorized)/cashflow/bank-interest/form.tsx | MODIFY | Replace inlined toggle/select |
| src/app/(authorized)/cashflow/bank-interest/page.tsx | MODIFY | Pass applicableTypes prop |
| src/app/(authorized)/cashflow/donations/form.tsx | MODIFY | Replace select, migrate URL param |
| src/server/services/bank-interest/interest-cleansing.service.ts | MODIFY | Fix date boundary logic |

## Migration Note
- Donations page migrates from `?fromYear`/`?toYear` to `?year=<id>` (URL breaking change)
- Migration path: update links, document param change, ensure server resolves by ID
