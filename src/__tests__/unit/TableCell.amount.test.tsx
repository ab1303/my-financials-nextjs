import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/AppSelect', () => ({
  AppSelect: () => <div data-testid='tablecell-select' />,
}));

vi.mock('@/components/DatePickerDialog', () => ({
  default: () => <div data-testid='date-picker-dialog' />,
}));

import { TableCell } from '@/components/react-table/TableCell';

describe('TableCell amount formatting', () => {
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

  it('renders $74.25 for value 74.25', () => {
    render(<TableCell {...(buildProps(74.25) as never)} />);

    expect(screen.getByText('$74.25')).toBeDefined();
  });

  it('renders $15.80 for value 15.8', () => {
    render(<TableCell {...(buildProps(15.8) as never)} />);

    expect(screen.getByText('$15.80')).toBeDefined();
  });
});
