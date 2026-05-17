import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionReviewTable from '@/components/csv-import/TransactionReviewTable';
import type {
  ClassifiedMonth,
  TransactionReviewTableProps,
} from '@/components/csv-import/TransactionReviewTable';
import type { ClassifiedTransaction } from '@/server/services/ai-import/_types';

describe('TransactionReviewTable', () => {
  const mockCategories = [
    { id: '1', name: 'Groceries' },
    { id: '2', name: 'Entertainment' },
    { id: '3', name: 'Home' },
    { id: '4', name: 'Health & Medical' },
    { id: '5', name: 'Vehicle & Transport' },
    { id: '6', name: 'Eating out & takeaway' },
  ];

  const mockTransaction1: ClassifiedTransaction = {
    id: 'tx1',
    description: 'WOOLWORTHS 1294 HORNSBY NS',
    amount: 85.5,
    date: '2025-07-01',
    llmCategory: 'Groceries',
    confirmedCategory: 'Groceries',
    overridden: false,
  };

  const mockTransaction2: ClassifiedTransaction = {
    id: 'tx2',
    description: 'NETFLIX SUBSCRIPTION',
    amount: 15.99,
    date: '2025-07-02',
    llmCategory: 'Entertainment',
    confirmedCategory: 'Entertainment',
    overridden: false,
  };

  const mockMonth: ClassifiedMonth = {
    month: '2025-07',
    transactions: [mockTransaction1, mockTransaction2],
    totalUsage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
  };

  const mockProps: TransactionReviewTableProps = {
    months: [mockMonth],
    categories: mockCategories,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render category dropdown with llmCategory as initial value', () => {
    render(<TransactionReviewTable {...mockProps} />);

    const selects = screen.getAllByRole('combobox');
    // Default sort is desc by date: tx2 (Entertainment, 2025-07-02) is first,
    // tx1 (Groceries, 2025-07-01) is second
    const values = selects.map((s) => (s as HTMLSelectElement).value);
    expect(values).toContain('Groceries');
    expect(values).toContain('Entertainment');
  });

  it('should update state when category dropdown is changed', async () => {
    render(<TransactionReviewTable {...mockProps} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'Entertainment' } });

    // The row should show the new selection
    expect(selects[0]).toHaveValue('Entertainment');
  });

  it('should highlight row in amber when category is changed', async () => {
    const { container } = render(<TransactionReviewTable {...mockProps} />);

    const rows = container.querySelectorAll('tr');
    const firstDataRow = rows[1]; // Skip header row

    // Initially no amber highlight
    expect(firstDataRow).not.toHaveClass('bg-amber-50');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'Home' } });

    // After change, row should have amber background
    await waitFor(() => {
      expect(firstDataRow).toHaveClass('bg-amber-50');
    });
  });



  it('should render warning flag for unknown merchant', () => {
    const unknownMerchantTx: ClassifiedTransaction = {
      id: 'tx3',
      description: 'XYZ ABC DEF',
      amount: 50.0,
      date: '2025-07-03',
      llmCategory: 'Home',
      confirmedCategory: 'Home',
      overridden: false,
    };

    const monthWithUnknown: ClassifiedMonth = {
      month: '2025-07',
      transactions: [unknownMerchantTx],
      totalUsage: {
        promptTokens: 50,
        completionTokens: 25,
        totalTokens: 75,
      },
    };

    const { container } = render(
      <TransactionReviewTable
        {...mockProps}
        months={[monthWithUnknown]}
      />,
    );

    // Look for warning icon via CSS (lucide SVGs don't have role="img")
    const warnings = container.querySelectorAll('svg.text-amber-500');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('should not render warning flag for known brand', () => {
    const knownMerchantTx: ClassifiedTransaction = {
      id: 'tx4',
      description: 'WOOLWORTHS 1294 HORNSBY NS',
      amount: 85.5,
      date: '2025-07-01',
      llmCategory: 'Groceries',
      confirmedCategory: 'Groceries',
      overridden: false,
    };

    const monthWithKnown: ClassifiedMonth = {
      month: '2025-07',
      transactions: [knownMerchantTx],
      totalUsage: {
        promptTokens: 50,
        completionTokens: 25,
        totalTokens: 75,
      },
    };

    const { container } = render(
      <TransactionReviewTable
        {...mockProps}
        months={[monthWithKnown]}
      />,
    );

    // Known merchant should not have warning icon
    const warnings = container.querySelectorAll('svg.text-amber-500');
    expect(warnings.length).toBe(0);
  });







  it('should have Accept All button that resets changes', async () => {
    render(<TransactionReviewTable {...mockProps} />);

    // First change a category (selects[0] is tx2=Entertainment in desc date sort)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'Home' } });
    expect(selects[0]).toHaveValue('Home');

    // Click Accept All (appears when overrides > 0)
    const acceptAllButton = screen.getByRole('button', { name: /Accept All/i });
    fireEvent.click(acceptAllButton);

    // Should reset to LLM category for tx2 which is 'Entertainment'
    expect(selects[0]).toHaveValue('Entertainment');
  });

  it('should render per-month collapsible sections', () => {
    render(<TransactionReviewTable {...mockProps} />);

    // Look for month header
    expect(screen.getAllByText(/2025-07/i).length).toBeGreaterThan(0);
  });

  it('should show count of overrides applied', async () => {
    const { rerender } = render(<TransactionReviewTable {...mockProps} />);

    // Change a category to trigger override (change tx2 from Entertainment to Home)
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'Home' } });

    rerender(
      <TransactionReviewTable {...mockProps} months={[mockMonth]} />,
    );

    // Component renders "1 changes applied" (plural)
    const overrideText = screen.getByText(/1 changes applied/i);
    expect(overrideText).toBeInTheDocument();
  });
});
