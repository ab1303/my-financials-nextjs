'use client';

import { useState, useMemo, useId } from 'react';
import type { ReactNode } from 'react';
import { CalendarEnumType } from '@prisma/client';
import type { SingleValue } from 'react-select';
import { AppSelect } from '@/components/ui/AppSelect';
import { Label } from '@/components/ui/Label';
import type { OptionType, CalendarYearType } from '@/types';
import CalendarTypeSwatch from './CalendarTypeSwatch';
import { CalendarYearContext, useCalendarYearContext } from './context';
import type { CalendarYearContextValue } from './context';

// ─── Public prop interface ────────────────────────────────────────────────────

export type CalendarYearPickerProps = {
  /** Which calendar types this screen supports */
  applicableTypes: CalendarEnumType[];
  /** All available calendar years; filtered internally by selected type */
  calendarYears: CalendarYearType[];
  /** Controlled: currently selected year id */
  selectedYearId?: string;
  /** Seed the type segmented-control on first render */
  defaultType?: CalendarEnumType;
  onYearChange: (yearId: string | null) => void;
  onTypeChange?: (type: CalendarEnumType) => void;
  /** Overrides the auto-generated accessible label for the year dropdown */
  label?: string;
  className?: string;
};

type ProviderProps = Omit<CalendarYearPickerProps, 'className'> & {
  children: ReactNode;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<CalendarEnumType, string> = {
  ANNUAL: 'Annual Year',
  FISCAL: 'Fiscal Year',
  ZAKAT: 'Zakat Year',
};

// ─── Provider — owns all state logic ─────────────────────────────────────────

/**
 * Manages internal `selectedType` state and derives `yearOptions` / `selectedOption`.
 * Injects the full context value so sub-components stay purely presentational.
 */
function Provider({
  applicableTypes,
  calendarYears,
  selectedYearId,
  defaultType,
  onYearChange,
  onTypeChange,
  label,
  children,
}: ProviderProps) {
  const labelId = useId();
  const initialType = (defaultType ?? applicableTypes[0] ?? 'FISCAL') as CalendarEnumType;
  const [selectedType, setSelectedType] = useState<CalendarEnumType>(initialType);

  const handleTypeChange = (type: CalendarEnumType) => {
    setSelectedType(type);
    onYearChange(null); // clear year when type switches
    onTypeChange?.(type);
  };

  const yearOptions: OptionType[] = useMemo(
    () =>
      calendarYears
        .filter((y) => y.type === selectedType || y.type === null)
        .map((y) => ({ id: y.id, label: y.description })),
    [calendarYears, selectedType],
  );

  const selectedOption = useMemo(
    () => (selectedYearId ? (yearOptions.find((o) => o.id === selectedYearId) ?? null) : null),
    [selectedYearId, yearOptions],
  );

  const displayLabel = label ?? FIELD_LABELS[selectedType];

  const value: CalendarYearContextValue = {
    state: { selectedType, applicableTypes, yearOptions, selectedOption, displayLabel },
    actions: { onTypeChange: handleTypeChange, onYearChange },
    labelId,
  };

  return <CalendarYearContext value={value}>{children}</CalendarYearContext>;
}

// ─── Root — layout shell ──────────────────────────────────────────────────────

/** Flex row container; compose TypeControl + YearSelect (and anything else) inside. */
function Root({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      {children}
    </div>
  );
}

// ─── TypeControl — segmented type picker ─────────────────────────────────────

/** Reads types + selectedType from context; delegates rendering to CalendarTypeSwatch. */
function TypeControl({ className }: { className?: string }) {
  const { state: { selectedType, applicableTypes }, actions } = useCalendarYearContext();
  return (
    <CalendarTypeSwatch
      types={applicableTypes}
      selectedType={selectedType}
      onTypeChange={actions.onTypeChange}
      className={className}
    />
  );
}

// ─── YearSelect — year dropdown ───────────────────────────────────────────────

/** Reads year options + selected value from context; renders a compact inline AppSelect. */
function YearSelect({ className }: { className?: string }) {
  const { state: { yearOptions, selectedOption, displayLabel }, actions, labelId } =
    useCalendarYearContext();

  return (
    <>
      {/* sr-only keeps accessible labelling without cluttering the visual layout */}
      <Label htmlFor={labelId} className="sr-only">
        {displayLabel}
      </Label>
      <AppSelect<OptionType>
        instanceId={labelId}
        inputId={labelId}
        options={yearOptions}
        value={selectedOption}
        onChange={(option: SingleValue<OptionType>) => actions.onYearChange(option?.id ?? null)}
        isClearable
        placeholder="Select year…"
        className={`min-w-[200px] max-w-[260px] ${className ?? ''}`}
        getOptionValue={(opt) => opt.id}
        getOptionLabel={(opt) => opt.label}
      />
    </>
  );
}

// ─── Default assembled component — backwards-compatible shorthand ─────────────

/**
 * CalendarYearPicker — drop-in replacement for the old single component.
 * Internally composes Provider → Root → TypeControl + YearSelect.
 *
 * For custom layouts, compose the sub-components directly:
 * ```tsx
 * <CalendarYearPicker.Provider {...props}>
 *   <CalendarYearPicker.Root>
 *     <CalendarYearPicker.TypeControl />
 *     <CalendarYearPicker.YearSelect />
 *   </CalendarYearPicker.Root>
 * </CalendarYearPicker.Provider>
 * ```
 */
function CalendarYearPickerDefault(props: CalendarYearPickerProps) {
  const { applicableTypes, calendarYears, selectedYearId, defaultType,
          onYearChange, onTypeChange, label, className } = props;
  return (
    <Provider
      applicableTypes={applicableTypes}
      calendarYears={calendarYears}
      selectedYearId={selectedYearId}
      defaultType={defaultType}
      onYearChange={onYearChange}
      onTypeChange={onTypeChange}
      label={label}
    >
      <Root className={className}>
        <TypeControl />
        <YearSelect />
      </Root>
    </Provider>
  );
}

// Attach sub-components so consumers can do <CalendarYearPicker.Provider ...>
CalendarYearPickerDefault.Provider = Provider;
CalendarYearPickerDefault.Root = Root;
CalendarYearPickerDefault.TypeControl = TypeControl;
CalendarYearPickerDefault.YearSelect = YearSelect;

export default CalendarYearPickerDefault;
export { CalendarYearPickerDefault as CalendarYearPicker };
