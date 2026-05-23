'use client';

import { useState, useMemo, useId } from 'react';
import { CalendarEnumType } from '@prisma/client';
import type { SingleValue } from 'react-select';
import { AppSelect } from '@/components/ui/AppSelect';
import { Label } from '@/components/ui/Label';
import type { OptionType, CalendarYearType } from '@/types';
import CalendarTypeSwatch from './CalendarTypeSwatch';

export type CalendarYearPickerProps = {
  applicableTypes: CalendarEnumType[];        // screen declares which types
  calendarYears: CalendarYearType[];          // all years; component filters internally
  selectedYearId?: string;                    // controlled: current selection
  defaultType?: CalendarEnumType;             // which type to activate on first render
  onYearChange: (yearId: string | null) => void;
  onTypeChange?: (type: CalendarEnumType) => void;
  label?: string;                             // overrides the dynamic label
  className?: string;
};

/**
 * CalendarYearPicker — Shared component for calendar type + year selection.
 * Manages type state internally; year state is controlled via props.
 */
function CalendarYearPicker({
  applicableTypes,
  calendarYears,
  selectedYearId,
  defaultType,
  onYearChange,
  onTypeChange,
  label,
  className,
}: CalendarYearPickerProps) {
  const labelId = useId();
  
  // Initialize selected type: prefer defaultType, else first applicable type
  const initialType: CalendarEnumType = (
    defaultType || applicableTypes[0] || 'FISCAL'
  ) as CalendarEnumType;
  const [selectedType, setSelectedType] = useState<CalendarEnumType>(
    initialType
  );

  // Handle type change: clear year selection and notify parent
  const handleTypeChange = (type: CalendarEnumType) => {
    setSelectedType(type);
    onYearChange(null); // Clear selected year
    onTypeChange?.(type);
  };

  // Filter years by selected type
  const filteredYears = useMemo(() => {
    return calendarYears.filter(
      (year) => year.type === selectedType || year.type === null
    );
  }, [calendarYears, selectedType]);

  // Map filtered years to OptionType[]
  const yearOptions: OptionType[] = useMemo(() => {
    return filteredYears.map((year) => ({
      id: year.id,
      label: year.description,
    }));
  }, [filteredYears]);

  // Derive selected option from selectedYearId
  const selectedOption = useMemo(() => {
    if (!selectedYearId) return null;
    return yearOptions.find((opt) => opt.id === selectedYearId) ?? null;
  }, [selectedYearId, yearOptions]);

  // Dynamic label based on selected type
  const typeLabels: Record<CalendarEnumType, string> = {
    ANNUAL: 'Annual Year',
    FISCAL: 'Fiscal Year',
    ZAKAT: 'Zakat Year',
  };

  const displayLabel = label ?? typeLabels[selectedType];

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {/* Type swatch — only rendered if multiple types */}
      <CalendarTypeSwatch
        types={applicableTypes}
        selectedType={selectedType}
        onTypeChange={handleTypeChange}
      />

      {/* Year selection label */}
      <Label htmlFor={labelId}>{displayLabel}</Label>

      {/* Year dropdown */}
      <AppSelect<OptionType>
        inputId={labelId}
        options={yearOptions}
        value={selectedOption}
        onChange={(option: SingleValue<OptionType>) => {
          onYearChange(option?.id ?? null);
        }}
        isClearable
        placeholder='Select year...'
        className='w-3/5'
        getOptionValue={(opt) => opt.id}
        getOptionLabel={(opt) => opt.label}
      />
    </div>
  );
}

export default CalendarYearPicker;
export { CalendarYearPicker };
