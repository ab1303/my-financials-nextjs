import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TransactionLedgerTable from '@/components/transactions/TransactionLedgerTable';

const mockRefetch = vi.fn();
const mockMutate = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    transactionLedger: {
      getAll: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
      updateCategory: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
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
    expenseCategories: [
      { id: 'cat-1', name: 'Groceries' },
      { id: 'cat-2', name: 'Transport' },
    ],
    incomeSourceLabels: ['EMPLOYMENT', 'BUSINESS'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: baseData,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders tab bar with 4 tabs', () => {
    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByRole('button', { name: /all/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /expenses/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /income/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /excluded/i })).toBeDefined();
  });

  it('shows loading state while fetching', () => {
    mockUseQuery.mockReturnValueOnce({
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
    mockUseQuery.mockReturnValueOnce({
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
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(screen.getByText('Supermarket')).toBeDefined();
    expect(screen.getByText('Groceries')).toBeDefined();
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

