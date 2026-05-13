import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/csv-import/TransactionReviewTable', () => ({
  default: ({ months }: any) => <div data-testid='debit-table'>Debits: {months.length} months</div>,
}));

import CSVTransactionReviewTable from '@/app/(authorized)/cashflow/transactions/_components/csv/CSVTransactionReviewTable';

const mockDebitMonths = [{
  month: '2024-01',
  transactions: [{
    id: '1', description: 'Woolworths', amount: 50,
    date: '2024-01-15', llmCategory: 'Groceries',
    confirmedCategory: 'Groceries', overridden: false,
  }],
  totalUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
}];

const mockCreditMonths = [{
  month: '2024-01',
  transactions: [{
    id: 'c1', description: 'SALARY', amount: 5000,
    date: '2024-01-01', llmCategory: 'EMPLOYMENT',
    confirmedCategory: 'EMPLOYMENT', overridden: false, type: 'CREDIT' as const,
  }],
  totalUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
}];

describe('CSVTransactionReviewTable', () => {
  const defaultProps = {
    debitMonths: mockDebitMonths,
    creditMonths: mockCreditMonths,
    categories: [{ id: 'c1', name: 'Groceries' }],
    incomeSourceLabels: ['EMPLOYMENT', 'STOCKS', 'Transfer', 'Excluded'],
    llmModel: 'gpt-4o-mini',
    onConfirm: vi.fn(),
    isConfirming: false,
  };

  it('renders both tabs', () => {
    render(<CSVTransactionReviewTable {...defaultProps} />);
    expect(screen.getByText(/Expenses/)).toBeDefined();
    expect(screen.getByText(/Income \/ Credits/)).toBeDefined();
  });

  it('shows debits tab by default', () => {
    render(<CSVTransactionReviewTable {...defaultProps} />);
    expect(screen.getByTestId('debit-table')).toBeDefined();
  });

  it('switches to credits tab', () => {
    render(<CSVTransactionReviewTable {...defaultProps} />);
    fireEvent.click(screen.getByText(/Income \/ Credits/));
    expect(screen.getByText('SALARY')).toBeDefined();
  });

  it('shows confirm button', () => {
    render(<CSVTransactionReviewTable {...defaultProps} />);
    expect(screen.getByText('Confirm & Import All')).toBeDefined();
  });

  it('disables confirm button when isConfirming', () => {
    render(<CSVTransactionReviewTable {...defaultProps} isConfirming={true} />);
    const btn = screen.getByText('Saving…');
    expect(btn.closest('button')?.disabled).toBe(true);
  });
});
