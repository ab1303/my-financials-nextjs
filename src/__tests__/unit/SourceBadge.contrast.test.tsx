import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/AppSelect', () => ({
  AppSelect: () => <div data-testid='tablecell-select' />,
}));

vi.mock('@/components/DatePickerDialog', () => ({
  default: () => <div data-testid='date-picker-dialog' />,
}));

import SourceBadge, { SOURCE_COLOR_MAP } from '@/app/(authorized)/cashflow/income/_components/SourceBadge';
import { TableCell } from '@/components/react-table/TableCell';

describe('SourceBadge contrast fixes', () => {
  it('"Other" badge has dark:bg-gray-600/60 class for sufficient contrast', () => {
    render(<SourceBadge sourceName='Other' />);

    expect(screen.getByText('Other')).toHaveClass(
      'dark:bg-gray-600/60',
      'dark:text-gray-100',
    );
    expect(SOURCE_COLOR_MAP.other).toContain('dark:bg-gray-600/60');
    expect(SOURCE_COLOR_MAP.other).toContain('dark:text-gray-100');
  });

  it('Unknown source fallback has dark:bg-gray-600/60 class', () => {
    render(<SourceBadge sourceName='UnknownSource' />);

    expect(screen.getByText('UnknownSource')).toHaveClass(
      'dark:bg-gray-600/60',
      'dark:text-gray-100',
    );
  });
});

describe('TableCell AMOUNT right-alignment', () => {
  const buildProps = (value: number) => ({
    getValue: () => value,
    row: { index: 0 },
    column: {
      columnDef: {
        meta: {
          type: 'AMOUNT',
          propName: 'amount',
        },
      },
    },
    table: {
      options: {
        meta: {
          editedRows: new Map(),
          setEditedRows: vi.fn(),
        },
      },
    },
  });

  it('AMOUNT read-only cell has text-right in className', () => {
    const { container } = render(<TableCell {...(buildProps(74.25) as never)} />);

    // Find the NumericFormat component's rendered element (span or similar)
    const numericFormatElement = container.querySelector('.tabular-nums');
    expect(numericFormatElement).toHaveClass('text-right', 'block');
  });
});
