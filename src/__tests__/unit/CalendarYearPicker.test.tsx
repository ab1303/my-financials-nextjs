import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { CalendarEnumType } from '@prisma/client';
import type { CalendarYearType } from '@/types';

// Mock the AppSelect component
vi.mock('@/components/ui/AppSelect', () => ({
  AppSelect: ({ options, value, onChange, placeholder, isClearable, inputId, ...props }: any) => (
    <div data-testid='app-select'>
      <select
        data-testid='select-input'
        id={inputId}
        value={value?.id || ''}
        onChange={(e) => {
          const selected = options.find((opt: any) => opt.id === e.target.value);
          onChange(selected || null);
        }}
        {...props}
      >
        <option value=''>{placeholder}</option>
        {options.map((opt: any) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

// Mock the Label component
vi.mock('@/components/ui/Label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

import CalendarYearPicker from '@/components/CalendarYearPicker';
import CalendarTypeSwatch from '@/components/CalendarYearPicker/CalendarTypeSwatch';

describe('CalendarYearPicker', () => {
  const mockCalendarYears: CalendarYearType[] = [
    {
      id: 'annual-2024',
      type: CalendarEnumType.ANNUAL,
      description: 'Calendar Year 2024',
      fromYear: 2024,
      fromMonth: 1,
      toYear: 2024,
      toMonth: 12,
      lockedAt: null,
    },
    {
      id: 'annual-2025',
      type: CalendarEnumType.ANNUAL,
      description: 'Calendar Year 2025',
      fromYear: 2025,
      fromMonth: 1,
      toYear: 2025,
      toMonth: 12,
      lockedAt: null,
    },
    {
      id: 'fiscal-2024',
      type: CalendarEnumType.FISCAL,
      description: 'Fiscal Year 2024',
      fromYear: 2024,
      fromMonth: 7,
      toYear: 2025,
      toMonth: 6,
      lockedAt: null,
    },
    {
      id: 'fiscal-2025',
      type: CalendarEnumType.FISCAL,
      description: 'Fiscal Year 2025',
      fromYear: 2025,
      fromMonth: 7,
      toYear: 2026,
      toMonth: 6,
      lockedAt: null,
    },
    {
      id: 'zakat-2024',
      type: CalendarEnumType.ZAKAT,
      description: 'Zakat Year 2024',
      fromYear: 2024,
      fromMonth: 1,
      toYear: 2024,
      toMonth: 12,
      lockedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CalendarTypeSwatch', () => {
    it('Test 1: renders only declared types', () => {
      const types = [CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL];
      const handleTypeChange = vi.fn();

      render(
        <CalendarTypeSwatch
          types={types}
          selectedType={CalendarEnumType.ANNUAL}
          onTypeChange={handleTypeChange}
        />
      );

      expect(screen.getByTestId('type-swatch-ANNUAL')).toBeInTheDocument();
      expect(screen.getByTestId('type-swatch-FISCAL')).toBeInTheDocument();
      expect(screen.queryByTestId('type-swatch-ZAKAT')).not.toBeInTheDocument();
    });

    it('Test 2: does not render when types.length === 1', () => {
      const types = [CalendarEnumType.ANNUAL];
      const handleTypeChange = vi.fn();

      const { container } = render(
        <CalendarTypeSwatch
          types={types}
          selectedType={CalendarEnumType.ANNUAL}
          onTypeChange={handleTypeChange}
        />
      );

      // When types.length === 1, component returns null, so container should be empty
      expect(container.firstChild).toBeNull();
    });

    it('highlights selected type with primary styles', () => {
      const types = [CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL];
      const handleTypeChange = vi.fn();

      render(
        <CalendarTypeSwatch
          types={types}
          selectedType={CalendarEnumType.ANNUAL}
          onTypeChange={handleTypeChange}
        />
      );

      const annualButton = screen.getByTestId('type-swatch-ANNUAL');
      expect(annualButton).toHaveClass('bg-primary');
      expect(annualButton).toHaveClass('text-primary-foreground');
    });

    it('renders unselected types with muted styles', () => {
      const types = [CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL];
      const handleTypeChange = vi.fn();

      render(
        <CalendarTypeSwatch
          types={types}
          selectedType={CalendarEnumType.ANNUAL}
          onTypeChange={handleTypeChange}
        />
      );

      const fiscalButton = screen.getByTestId('type-swatch-FISCAL');
      expect(fiscalButton).toHaveClass('bg-muted');
      expect(fiscalButton).toHaveClass('text-muted-foreground');
    });

    it('calls onTypeChange when type button is clicked', async () => {
      const user = userEvent.setup();
      const types = [CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL];
      const handleTypeChange = vi.fn();

      render(
        <CalendarTypeSwatch
          types={types}
          selectedType={CalendarEnumType.ANNUAL}
          onTypeChange={handleTypeChange}
        />
      );

      const fiscalButton = screen.getByTestId('type-swatch-FISCAL');
      await user.click(fiscalButton);

      expect(handleTypeChange).toHaveBeenCalledWith(CalendarEnumType.FISCAL);
    });
  });

  describe('CalendarYearPicker', () => {
    it('Test 3: switching type calls onTypeChange and clears year (onYearChange(null))', async () => {
      const user = userEvent.setup();
      const handleYearChange = vi.fn();
      const handleTypeChange = vi.fn();

      const { rerender } = render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL]}
          calendarYears={mockCalendarYears}
          selectedYearId='annual-2024'
          defaultType={CalendarEnumType.ANNUAL}
          onYearChange={handleYearChange}
          onTypeChange={handleTypeChange}
        />
      );

      // Click fiscal type button
      const fiscalButton = screen.getByTestId('type-swatch-FISCAL');
      await user.click(fiscalButton);

      // Verify onTypeChange was called
      expect(handleTypeChange).toHaveBeenCalledWith(CalendarEnumType.FISCAL);

      // Verify onYearChange was called with null to clear selection
      expect(handleYearChange).toHaveBeenCalledWith(null);
    });

    it('Test 4: filters year options to selected type only', () => {
      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL]}
          calendarYears={mockCalendarYears}
          selectedYearId='annual-2024'
          defaultType={CalendarEnumType.ANNUAL}
          onYearChange={vi.fn()}
        />
      );

      const selectInput = screen.getByTestId('select-input') as HTMLSelectElement;
      const options = Array.from(selectInput.options);

      // Should only show ANNUAL years when ANNUAL is selected
      const optionLabels = options.map((opt) => opt.textContent).filter((text) => text !== 'Select year...');

      expect(optionLabels).toContain('Calendar Year 2024');
      expect(optionLabels).toContain('Calendar Year 2025');
      expect(optionLabels).not.toContain('Fiscal Year 2024');
    });

    it('switches year options when type changes', async () => {
      const user = userEvent.setup();

      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL]}
          calendarYears={mockCalendarYears}
          defaultType={CalendarEnumType.ANNUAL}
          onYearChange={vi.fn()}
        />
      );

      let selectInput = screen.getByTestId('select-input') as HTMLSelectElement;
      let optionLabels = Array.from(selectInput.options)
        .map((opt) => opt.textContent)
        .filter((text) => text !== 'Select year...');

      // Initially showing ANNUAL years
      expect(optionLabels).toContain('Calendar Year 2024');

      // Click fiscal type
      const fiscalButton = screen.getByTestId('type-swatch-FISCAL');
      await user.click(fiscalButton);

      // Re-query to get updated options
      selectInput = screen.getByTestId('select-input') as HTMLSelectElement;
      optionLabels = Array.from(selectInput.options)
        .map((opt) => opt.textContent)
        .filter((text) => text !== 'Select year...');

      // Should now show FISCAL years
      expect(optionLabels).toContain('Fiscal Year 2024');
      expect(optionLabels).toContain('Fiscal Year 2025');
      expect(optionLabels).not.toContain('Calendar Year 2024');
    });

    it('displays dynamic label based on selected type', () => {
      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL]}
          calendarYears={mockCalendarYears}
          defaultType={CalendarEnumType.ANNUAL}
          onYearChange={vi.fn()}
        />
      );

      expect(screen.getByText('Annual Year')).toBeInTheDocument();
    });

    it('uses custom label when provided', () => {
      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL]}
          calendarYears={mockCalendarYears}
          onYearChange={vi.fn()}
          label='Custom Year Label'
        />
      );

      expect(screen.getByText('Custom Year Label')).toBeInTheDocument();
    });

    it('calls onYearChange when year is selected', async () => {
      const user = userEvent.setup();
      const handleYearChange = vi.fn();

      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL]}
          calendarYears={mockCalendarYears}
          defaultType={CalendarEnumType.ANNUAL}
          onYearChange={handleYearChange}
        />
      );

      const selectInput = screen.getByTestId('select-input') as HTMLSelectElement;
      await user.selectOptions(selectInput, 'annual-2024');

      expect(handleYearChange).toHaveBeenCalledWith('annual-2024');
    });

    it('hides type swatch when only one type is applicable', () => {
      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL]}
          calendarYears={mockCalendarYears}
          onYearChange={vi.fn()}
        />
      );

      // When only one type, swatch should not render
      const swatches = screen.queryAllByTestId(/type-swatch/);
      expect(swatches).toHaveLength(0);
    });

    it('respects controlled selectedYearId prop', () => {
      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL]}
          calendarYears={mockCalendarYears}
          selectedYearId='annual-2025'
          defaultType={CalendarEnumType.ANNUAL}
          onYearChange={vi.fn()}
        />
      );

      const selectInput = screen.getByTestId('select-input') as HTMLSelectElement;
      expect(selectInput.value).toBe('annual-2025');
    });

    it('initializes with defaultType when provided', () => {
      render(
        <CalendarYearPicker
          applicableTypes={[CalendarEnumType.ANNUAL, CalendarEnumType.FISCAL]}
          calendarYears={mockCalendarYears}
          defaultType={CalendarEnumType.FISCAL}
          onYearChange={vi.fn()}
        />
      );

      expect(screen.getByText('Fiscal Year')).toBeInTheDocument();

      const selectInput = screen.getByTestId('select-input') as HTMLSelectElement;
      const optionLabels = Array.from(selectInput.options)
        .map((opt) => opt.textContent)
        .filter((text) => text !== 'Select year...');

      // Should show FISCAL years
      expect(optionLabels).toContain('Fiscal Year 2024');
    });
  });
});
