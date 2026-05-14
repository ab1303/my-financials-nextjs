import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';
import TransactionRow from '@/components/transactions/TransactionRow';

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
  };

  const creditTransaction: LedgerTransactionRow = {
    ...debitTransaction,
    id: 'tx-2',
    type: 'CREDIT',
    amount: 5000,
    category: 'EMPLOYMENT',
    source: 'USER_OVERRIDE',
  };

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

    expect(screen.getByRole('combobox')).toBeDefined();
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

    expect(screen.getByRole('combobox')).toBeDefined();
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

    fireEvent.change(screen.getByRole('combobox'), {
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

    expect(screen.getByText('$123.45')).toHaveClass('text-red-600');

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

    expect(screen.getByText('$5,000.00')).toHaveClass('text-green-600');
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
