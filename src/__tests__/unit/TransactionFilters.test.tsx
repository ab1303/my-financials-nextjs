import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TransactionFilters from '@/components/transactions/TransactionFilters';

describe('TransactionFilters', () => {
  const props = {
    bankAccounts: [
      { id: 'acc-1', name: 'Everyday Account' },
      { id: 'acc-2', name: 'Savings' },
    ],
    bankAccountId: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    search: '',
    amountMin: '',
    amountMax: '',
    onBankChange: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onSearchChange: vi.fn(),
    onAmountMinChange: vi.fn(),
    onAmountMaxChange: vi.fn(),
    onReset: vi.fn(),
    resetKey: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 7, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders preset buttons', () => {
    render(<TransactionFilters {...props} />);

    expect(screen.getByRole('button', { name: /this month/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /last month/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /this quarter/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /this fy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /last fy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /custom/i })).toBeDefined();
  });

  it('calls onDateFromChange and onDateToChange when This Month is clicked', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /this month/i }));

    expect(props.onDateFromChange).toHaveBeenCalledWith('2024-08-01');
    expect(props.onDateToChange).toHaveBeenCalledWith('2024-08-15');
  });

  it('shows date inputs when Custom is selected', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /custom/i }));

    expect(screen.getByLabelText(/date from/i)).toBeDefined();
    expect(screen.getByLabelText(/date to/i)).toBeDefined();
  });

  it('hides date inputs for preset selections', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /this quarter/i }));

    expect(screen.queryByLabelText(/date from/i)).toBeNull();
    expect(screen.queryByLabelText(/date to/i)).toBeNull();
  });

  it('resets to This FY when resetKey changes', () => {
    const { rerender } = render(<TransactionFilters {...props} resetKey={0} />);

    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    expect(screen.getByRole('button', { name: /custom/i })).toHaveAttribute('aria-pressed', 'true');

    rerender(<TransactionFilters {...props} resetKey={1} />);

    expect(screen.getByRole('button', { name: /this fy/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls amount callbacks when amount inputs change', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.change(screen.getByLabelText(/min amount/i), {
      target: { value: '500' },
    });

    fireEvent.change(screen.getByLabelText(/max amount/i), {
      target: { value: '1000' },
    });

    expect(props.onAmountMinChange).toHaveBeenCalledWith('500');
    expect(props.onAmountMaxChange).toHaveBeenCalledWith('1000');
  });
});
