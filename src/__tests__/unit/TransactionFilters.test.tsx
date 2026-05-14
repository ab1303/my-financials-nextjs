import { describe, expect, it, vi } from 'vitest';
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
    onBankChange: vi.fn(),
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    onSearchChange: vi.fn(),
    onReset: vi.fn(),
  };

  it('renders bank account select with All Accounts option', () => {
    render(<TransactionFilters {...props} />);

    expect(screen.getByText('All Accounts')).toBeDefined();
    expect(screen.getByText('Everyday Account')).toBeDefined();
    expect(screen.getByText('Savings')).toBeDefined();
  });

  it('calls onBankChange when bank select changes', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.change(screen.getByLabelText(/bank account/i), {
      target: { value: 'acc-1' },
    });

    expect(props.onBankChange).toHaveBeenCalledWith('acc-1');
  });

  it('calls onSearchChange when search input changes', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.change(screen.getByLabelText(/search/i), {
      target: { value: 'coffee' },
    });

    expect(props.onSearchChange).toHaveBeenCalledWith('coffee');
  });

  it('calls onDateFromChange when date from input changes', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.change(screen.getByLabelText(/date from/i), {
      target: { value: '2024-01-01' },
    });

    expect(props.onDateFromChange).toHaveBeenCalledWith('2024-01-01');
  });

  it('calls onReset when Reset button is clicked', () => {
    render(<TransactionFilters {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(props.onReset).toHaveBeenCalled();
  });
});
