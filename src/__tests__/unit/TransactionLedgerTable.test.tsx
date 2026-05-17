import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransactionLedgerTable from '@/components/transactions/TransactionLedgerTable';

const mockRefetch = vi.fn();
const mockMutate = vi.fn();
const mockUseAllQuery = vi.fn();
const mockUseFilterOptionsQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSearchDebitTransactionsFetch = vi.fn();

vi.mock('react-select/async', () => ({
  default: (props: Record<string, unknown>) => (
    <div aria-label={(props['aria-label'] as string | undefined) ?? 'async-select'} />
  ),
}));

vi.mock('react-select', () => ({
  default: ({
    inputId,
    name,
    options = [],
    value,
    onChange,
    placeholder,
    isClearable,
  }: {
    inputId?: string;
    name?: string;
    options?: Array<{ label: string; value: string }>;
    value?: { label: string; value: string } | null;
    onChange?: (option: { label: string; value: string } | null) => void;
    placeholder?: string;
    isClearable?: boolean;
  }) => (
    <select
      id={inputId}
      name={name}
      aria-label={placeholder ?? name}
      value={value?.value ?? ''}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {isClearable ? <option value="">All</option> : null}
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
    useUtils: () => ({
      transactionLedger: {
        searchDebitTransactions: {
          fetch: (...args: unknown[]) => mockSearchDebitTransactionsFetch(...args),
        },
      },
    }),
    transactionLedger: {
      getAll: {
        useQuery: (...args: unknown[]) => mockUseAllQuery(...args),
      },
      getFilterOptions: {
        useQuery: (...args: unknown[]) => mockUseFilterOptionsQuery(...args),
      },
      updateCategory: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
    },
    transfer: {
      getUnmatchedCount: {
        useQuery: () => ({ data: 0, isLoading: false }),
      },
    },
    transactionClearing: {
      voidTransaction: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

describe('TransactionLedgerTable', () => {
  const bankAccounts = [{ id: 'acc-1', name: 'Everyday Account', bankName: 'CommBank' }];

  const baseData = {
    transactions: [],
    total: 0,
    page: 1,
    totalPages: 1,
  };

  const filterOptions = {
    expenseCategories: [
      { id: 'cat-1', name: 'Groceries' },
      { id: 'cat-2', name: 'Transport' },
    ],
    incomeSourceLabels: ['EMPLOYMENT', 'BUSINESS'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAllQuery.mockReturnValue({
      data: baseData,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
    mockUseFilterOptionsQuery.mockReturnValue({
      data: filterOptions,
      isLoading: false,
      isFetching: false,
    });
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    mockSearchDebitTransactionsFetch.mockResolvedValue([]);
  });

  it('renders tab bar with 5 tabs', () => {
    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByRole('button', { name: /all/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /expenses/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /income/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /excluded/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /uncategorized/i })).toBeDefined();
  });

  it('shows loading state while fetching', () => {
    mockUseAllQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isFetching: true,
      refetch: mockRefetch,
    });

    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByText(/loading transactions/i)).toBeDefined();
  });

  it('shows empty state when no transactions', () => {
    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByText(/no transactions found/i)).toBeDefined();
  });

  it('renders transaction rows when data is available', () => {
    mockUseAllQuery.mockReturnValueOnce({
      data: {
        ...baseData,
        total: 1,
        transactions: [
          {
            id: 'tx-1',
            date: '2024-01-15T00:00:00.000Z',
            description: 'Supermarket',
            amount: 123.45,
            type: 'DEBIT',
            category: 'Groceries',
            source: 'LLM_CLASSIFIED',
            status: 'CONFIRMED',
            bankAccountName: 'Everyday Account',
            bankName: 'CommBank',
            reimbursements: [],
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByText('Supermarket')).toBeDefined();
    expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/ai classified/i)).toBeDefined();
    expect(screen.queryByText('LLM_CLASSIFIED')).toBeNull();
  });

  it('renders searchable bank and category filters', () => {
    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByLabelText(/bank account/i)).toBeDefined();
    expect(screen.getByLabelText(/category/i)).toBeDefined();
  });

  it('changes active tab when tab is clicked', async () => {
    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    fireEvent.click(screen.getByRole('button', { name: /expenses/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /expenses/i })).toHaveClass('border-teal-500');
    });
  });

  it('calls refetch when refreshKey prop changes', async () => {
    const { rerender } = render(
      <TransactionLedgerTable bankAccounts={bankAccounts} refreshKey={0} />,
    );

    rerender(<TransactionLedgerTable bankAccounts={bankAccounts} refreshKey={1} />);

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
