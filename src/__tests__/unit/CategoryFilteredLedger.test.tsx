import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseQuery = vi.fn();

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    categoryTransactions: {
      getByCategory: {
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
      },
    },
  },
}));

import { CategoryFilteredLedger } from '@/components/transactions/CategoryFilteredLedger';

describe('CategoryFilteredLedger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });

    render(<CategoryFilteredLedger category='groceries' month={2} year={2025} />);

    expect(screen.getByText(/loading transactions/i)).toBeDefined();
  });

  it('renders error state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: new Error('Boom') });

    render(<CategoryFilteredLedger category='groceries' month={2} year={2025} />);

    expect(screen.getByText(/error loading transactions/i)).toBeDefined();
    expect(screen.getByText(/boom/i)).toBeDefined();
  });

  it('renders empty state', () => {
    mockUseQuery.mockReturnValue({
      data: {
        transactions: [],
        category: 'groceries',
        month: 2,
        year: 2025,
        total: 0,
        totalAmount: 0,
        averageAmount: 0,
      },
      isLoading: false,
      error: null,
    });

    render(<CategoryFilteredLedger category='groceries' month={2} year={2025} />);

    expect(screen.getByText(/no transactions for this category and month/i)).toBeDefined();
  });

  it('renders summary stats and transactions', () => {
    mockUseQuery.mockReturnValue({
      data: {
        transactions: [
          {
            id: 'tx-1',
            date: '2025-02-04',
            description: 'Supermarket',
            amount: 123.45,
            category: 'groceries',
            source: 'LLM_CLASSIFIED',
            status: 'CONFIRMED',
            bankAccountName: 'Everyday Account',
          },
          {
            id: 'tx-2',
            date: '2025-02-10',
            description: 'Fruit Shop',
            amount: 42.5,
            category: 'groceries',
            source: 'LLM_CLASSIFIED',
            status: 'CONFIRMED',
            bankAccountName: null,
          },
        ],
        category: 'groceries',
        month: 2,
        year: 2025,
        total: 2,
        totalAmount: 165.95,
        averageAmount: 82.975,
      },
      isLoading: false,
      error: null,
    });

    render(<CategoryFilteredLedger category='groceries' month={2} year={2025} />);

    expect(screen.getByRole('heading', { name: /groceries – february 2025/i })).toBeDefined();
    expect(screen.getByText('2', { selector: 'span' })).toBeDefined();
    expect(screen.getByText(/\$165.95/i)).toBeDefined();
    expect(screen.getByText(/\$82.9[78]/i)).toBeDefined();
    expect(screen.getByText('Supermarket')).toBeDefined();
    expect(screen.getByText('Fruit Shop')).toBeDefined();
  });
});
