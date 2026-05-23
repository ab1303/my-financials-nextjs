'use client';

import { CalendarEnumType } from '@prisma/client';

export type CalendarTypeSwatchProps = {
  types: CalendarEnumType[];
  selectedType: CalendarEnumType;
  onTypeChange: (type: CalendarEnumType) => void;
  className?: string;
};

/**
 * CalendarTypeSwatch — Renders pill/swatch buttons for calendar type selection.
 * Only renders when types.length > 1 (if single type, returns null).
 */
export default function CalendarTypeSwatch({
  types,
  selectedType,
  onTypeChange,
  className,
}: CalendarTypeSwatchProps) {
  // Only render when multiple types available
  if (types.length <= 1) {
    return null;
  }

  // Map enum values to human-readable labels
  const typeLabels: Record<CalendarEnumType, string> = {
    ANNUAL: 'Annual',
    FISCAL: 'Fiscal',
    ZAKAT: 'Zakat',
  };

  return (
    <div className={`flex gap-2 ${className || ''}`}>
      {types.map((type) => (
        <button
          key={type}
          onClick={() => onTypeChange(type)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
            selectedType === type
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          data-testid={`type-swatch-${type}`}
        >
          {typeLabels[type]}
        </button>
      ))}
    </div>
  );
}
