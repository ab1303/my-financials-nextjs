import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';
import TransactionRow from '@/components/transactions/TransactionRow';

const mockUseSearchDebitTransactionsQuery = vi.fn();

vi.mock('react-select', () => ({
  default: ({
    inputId,
    placeholder,
    options = [],
    value,
    onChange,
    isDisabled,
    ...props
  }: {
    inputId?: string;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
    value?: { label: string; value: string } | null;
    onChange?: (option: { label: string; value: string } | null) => void;
    isDisabled?: boolean;
  } & Record<string, unknown>) => (
    <select
      id={inputId}
      aria-label={(props['aria-label'] as string | undefined) ?? placeholder ?? 'select'}
      value={value?.value ?? ''}
      disabled={isDisabled}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    transactionLedger: {
      searchDebitTransactions: {
        useQuery: (...args: unknown[]) => mockUseSearchDebitTransactionsQuery(...args),
      },
    },
  },
}));

describe('TransactionRow', () => {
  const expenseCategories = [
    { id: 'cat-1', name: 'Groceries' },
    { id: 'cat-2', name: 'Transport' },
  ];

  const incomeSourceLabels = ['EMPLOYMENT', 'BUSINESS'];

  const debitTransaction: LedgerTransactionRow = {
    id: 'tx-1',
    date: '2024-01-15T00:00:00.000Z',
    description: 'Supermarket',
    amount: 123.45,
    type: 'DEBIT',
    category: 'Groceries',
    source: 'LLM_CLASSIFIED',
    status: 'CONFIRMED',
    bankAccountName: 'Everyday Account',
    bankName: 'Commonwealth Bank',
    reimbursements: [],
  };

  const creditTransaction: LedgerTransactionRow = {
    ...debitTransaction,
    id: 'tx-2',
    type: 'CREDIT',
    amount: 5000,
    category: 'EMPLOYMENT',
    source: 'USER_OVERRIDE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchDebitTransactionsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    });
  });

  it('renders date, description, and amount for a DEBIT transaction', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={debitTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('2024-01-15')).toBeDefined();
    expect(screen.getByText('Supermarket')).toBeDefined();
    expect(screen.getByText('$123.45')).toBeDefined();
  });

  it('shows expense category select for DEBIT type', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={debitTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole('combobox', { name: /category for supermarket/i })).toBeDefined();
    expect(screen.getByText('Groceries')).toBeDefined();
  });

  it('shows income source select for CREDIT type', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={creditTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole('combobox', { name: /category for supermarket/i })).toBeDefined();
    expect(screen.getByText('EMPLOYMENT')).toBeDefined();
  });

  it('calls onCategoryChange when select changes', () => {
    const onCategoryChange = vi.fn();

    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={debitTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={onCategoryChange}
          />
        </tbody>
      </table>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /category for supermarket/i }), {
      target: { value: 'Transport' },
    });

    expect(onCategoryChange).toHaveBeenCalledWith('tx-1', 'Transport');
  });

  it('renders amount in red for DEBIT and green for CREDIT', () => {
    const { rerender } = render(
      <table>
        <tbody>
          <TransactionRow
            transaction={debitTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('$123.45').closest('td')).toHaveClass('text-red-600');

    rerender(
      <table>
        <tbody>
          <TransactionRow
            transaction={creditTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('$5,000.00').closest('td')).toHaveClass('text-green-600');
  });

  it('renders CONFIRMED badge in green', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={debitTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText('CONFIRMED')).toHaveClass('bg-green-100');
  });
});
