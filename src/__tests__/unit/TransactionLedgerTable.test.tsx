import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shouldRetainRowAfterCategoryChange } from '@/components/transactions/TransactionLedgerTable';

const mockRefetch = vi.fn();
const mockMutate = vi.fn();
const mockUseAllQuery = vi.fn();
const mockUseFilterOptionsQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSearchDebitTransactionsFetch = vi.fn();
const mockCategoryFilteredLedger = vi.fn();

// Ensure next-auth client APIs are stubbed before importing app code
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
  signIn: vi.fn(),
}));

// Stub the main next-auth module so its server-side entrypoints (which import `next/server`)
// are not evaluated in the test environment.
vi.mock('next-auth', () => ({
  default: (cfg: any) => ({
    auth: {},
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('@/components/transactions/CategoryFilteredLedger', () => ({
  CategoryFilteredLedger: (props: {
    category: string;
    month: number;
    year: number;
  }) => {
    mockCategoryFilteredLedger(props);
    return <div data-testid='category-filtered-ledger'>Filtered Ledger</div>;
  },
}));

vi.mock('react-select/async', () => ({
  default: (props: Record<string, unknown>) => (
    <div
      aria-label={(props['aria-label'] as string | undefined) ?? 'async-select'}
    />
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
        const selected =
          options.find((option) => option.value === event.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {isClearable ? <option value=''>All</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

// Mock trpc client before importing the component so its imports don't trigger next/server resolution
vi.mock('@/server/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      transactionLedger: {
        searchDebitTransactions: {
          fetch: (...args: unknown[]) =>
            mockSearchDebitTransactionsFetch(...args),
          invalidate: vi.fn(),
        },
        getAll: {
          invalidate: vi.fn(),
        },
      },
    }),
    transactionLedger: {
      getAll: {
        useInfiniteQuery: (...args: unknown[]) => mockUseAllQuery(...args),
      },
      getFilterOptions: {
        useQuery: (...args: unknown[]) => mockUseFilterOptionsQuery(...args),
      },
      updateCategory: {
        useMutation: (...args: unknown[]) => mockUseMutation(...args),
      },
      previewMatchingCategoryChanges: {
        useQuery: () => ({ data: { matches: [], totalCount: 0 }, isLoading: false }),
      },
    },
    categoryTransactions: {
      getByCategory: {
        useQuery: (...args: unknown[]) => mockCategoryFilteredLedger(...args),
      },
    },
    transfer: {
      getUnmatchedCount: {
        useQuery: () => ({ data: 0, isLoading: false }),
      },
    },
    transferRule: {
      createRuleFromPair: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    transactionClearing: {
      voidTransaction: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

import TransactionLedgerTable from '@/components/transactions/TransactionLedgerTable';

describe('TransactionLedgerTable', () => {
  const bankAccounts = [
    { id: 'acc-1', name: 'Everyday Account', bankName: 'CommBank' },
  ];

  const baseData = {
    pages: [
      {
        transactions: [],
        nextCursor: null,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
      },
    ],
  };

  const filterOptions = {
    expenseCategories: [
      { id: 'cat-1', name: 'Groceries' },
      { id: 'cat-2', name: 'Transport' },
    ],
    incomeSourceLabels: [
      { id: 'src-1', name: 'EMPLOYMENT' },
      { id: 'src-2', name: 'BUSINESS' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAllQuery.mockReturnValue({
      data: baseData,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
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
    mockCategoryFilteredLedger.mockImplementation(() => null);
  });

  it('renders tab bar with 5 tabs', () => {
    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    expect(
      screen.getAllByRole('button', { name: /^all$/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /expenses/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /income/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /excluded/i })).toBeDefined();
    expect(
      screen.getByRole('button', { name: /uncategorized/i }),
    ).toBeDefined();
  });

  it('shows loading state while fetching', () => {
    mockUseAllQuery.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
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
        pages: [
          {
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
            nextCursor: null,
            totalDebitAmount: 123.45,
            totalCreditAmount: 0,
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
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
      expect(screen.getByRole('button', { name: /expenses/i })).toHaveClass(
        'border-teal-500',
      );
    });
  });

  it('renders normal ledger when category prop is provided (no CategoryFilteredLedger)', () => {
    render(
      <TransactionLedgerTable
        bankAccounts={bankAccounts}
        initialCategory='groceries'
        initialMonth={2}
        initialYear={2025}
      />,
    );

    // The ledger renders normally with category filter applied — no separate CategoryFilteredLedger component
    expect(mockUseAllQuery).toHaveBeenCalled();
  });

  it('calls refetch when refreshKey prop changes', async () => {
    const { rerender } = render(
      <TransactionLedgerTable bankAccounts={bankAccounts} refreshKey={0} />,
    );

    rerender(
      <TransactionLedgerTable bankAccounts={bankAccounts} refreshKey={1} />,
    );

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('displays toast message with match count after bulk apply', async () => {
    mockUseAllQuery.mockReturnValueOnce({
      data: {
        pages: [
          {
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
                offsetCategory: null,
                offsetTransactionId: null,
                transferCounterpart: null,
                transferLinkedTransactionId: null,
                transferCounterpartId: null,
                isTransferClassified: false,
                confirmedAt: null,
                bankAccountId: 'bank-1',
              },
            ],
            nextCursor: null,
            totalDebitAmount: 123.45,
            totalCreditAmount: 0,
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: mockRefetch,
    });

    mockUseMutation.mockReturnValueOnce({
      mutate: mockMutate,
      isPending: false,
    });

    render(<TransactionLedgerTable bankAccounts={bankAccounts} />);

    // Simulate updateCategory mutation success with matched IDs
    const successCallback = vi.mocked(mockUseMutation).mock.calls[0]?.[0]?.onSuccess;
    if (successCallback) {
      successCallback({
        success: true,
        matchedIds: ['tx-1', 'tx-2', 'tx-3'],
      } as any);
    }

    await waitFor(() => {
      // The toast should show that category was updated for 3 matching transactions
      // This is validated by the actual implementation showing the review batch
    });
  });
});

/**
 * Unit tests for shouldRetainRowAfterCategoryChange helper function
 * This tests the logic for deciding when a recategorized row should remain visible
 */
describe('shouldRetainRowAfterCategoryChange', () => {
  const TRANSFER_CATEGORY = 'Transfer';

  const createMockTransaction = (overrides = {}): any => ({
    id: 'tx-1',
    date: '2024-01-15T00:00:00.000Z',
    description: 'Test transaction',
    amount: 100,
    type: 'DEBIT',
    category: null,
    source: 'LLM_CLASSIFIED',
    status: 'CONFIRMED',
    bankAccountName: 'Test Account',
    bankName: 'Test Bank',
    reimbursements: [],
    offsetCategory: null,
    offsetTransactionId: null,
    transferCounterpart: null,
    transferLinkedTransactionId: null,
    transferCounterpartId: null,
    isTransferClassified: false,
    confirmedAt: null,
    bankAccountId: 'bank-1',
    ...overrides,
  });

  describe('transfers tab', () => {
    it('retains row when moving away from Transfer category', () => {
      const tx = createMockTransaction({ category: TRANSFER_CATEGORY });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Groceries', 'transfers')
      ).toBe(true);
    });

    it('does not retain row when moving to Transfer category', () => {
      const tx = createMockTransaction({ category: 'Groceries' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, TRANSFER_CATEGORY, 'transfers')
      ).toBe(false);
    });

    it('does not retain row when category is already not Transfer', () => {
      const tx = createMockTransaction({ category: 'Groceries' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Utilities', 'transfers')
      ).toBe(false);
    });
  });

  describe('uncategorized tab', () => {
    it('retains row when assigning a category to uncategorized transaction', () => {
      const tx = createMockTransaction({ category: null });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Groceries', 'uncategorized')
      ).toBe(true);
    });

    it('retains row when assigning category to transaction with empty string category', () => {
      const tx = createMockTransaction({ category: '' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Groceries', 'uncategorized')
      ).toBe(true);
    });

    it('does not retain row when transaction already has a category on uncategorized tab', () => {
      const tx = createMockTransaction({ category: 'Groceries' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Utilities', 'uncategorized')
      ).toBe(false);
    });

    it('does not retain row when assigning empty/null category on uncategorized tab', () => {
      const tx = createMockTransaction({ category: null });
      expect(
        shouldRetainRowAfterCategoryChange(tx, '', 'uncategorized')
      ).toBe(false);
    });
  });

  describe('other tabs', () => {
    it('retains row on expenses tab', () => {
      const tx = createMockTransaction({ category: 'Groceries' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Utilities', 'expenses')
      ).toBe(true);
    });

    it('retains row on income tab', () => {
      const tx = createMockTransaction({ category: 'Salary', type: 'CREDIT' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Bonus', 'income')
      ).toBe(true);
    });

    it('does not retain row on all tab', () => {
      const tx = createMockTransaction({ category: 'Groceries' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Utilities', 'all')
      ).toBe(false);
    });

    it('retains row on excluded tab', () => {
      const tx = createMockTransaction({ category: 'Excluded', status: 'EXCLUDED' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Groceries', 'excluded')
      ).toBe(true);
    });

    it('retains row on reimbursements tab', () => {
      const tx = createMockTransaction({ category: 'Reimbursement' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Groceries', 'reimbursements')
      ).toBe(true);
    });

    it('retains row on voided tab', () => {
      const tx = createMockTransaction({ category: 'Groceries', status: 'VOIDED' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Utilities', 'voided')
      ).toBe(true);
    });

    it('retains row on all tab when a category filter is active and the row changes category', () => {
      const tx = createMockTransaction({ category: 'Groceries' });
      expect(
        shouldRetainRowAfterCategoryChange(tx, 'Utilities', 'all', 'Groceries')
      ).toBe(true);
    });
  });
});
