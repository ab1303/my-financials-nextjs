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
    <div
      className={`inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5 ${className || ''}`}
      role="group"
      aria-label="Calendar type"
    >
      {types.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onTypeChange(type)}
          aria-pressed={selectedType === type}
          className={`px-2.5 py-0.5 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary touch-manipulation ${
            selectedType === type
              ? 'bg-background text-foreground shadow-sm dark:bg-accent'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid={`type-swatch-${type}`}
        >
          {typeLabels[type]}
        </button>
      ))}
    </div>
  );
}
