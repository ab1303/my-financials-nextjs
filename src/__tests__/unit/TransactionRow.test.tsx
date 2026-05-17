import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';
import TransactionRow from '@/components/transactions/TransactionRow';

const mockSearchDebitTransactionsFetch = vi.fn();

vi.mock('react-select/async', () => ({
  default: (props: Record<string, unknown>) => (
    <div aria-label={(props['aria-label'] as string | undefined) ?? 'async-select'} />
  ),
}));

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
    useUtils: () => ({
      transactionLedger: {
        searchDebitTransactions: {
          fetch: (...args: unknown[]) => mockSearchDebitTransactionsFetch(...args),
        },
      },
    }),
  },
}));

vi.mock('@/components/transactions/UnlinkTransferButton', () => ({
  UnlinkTransferButton: ({ transactionId }: { transactionId: string }) => (
    <button type="button" aria-label="Unlink transfer">
      unlink-{transactionId}
    </button>
  ),
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
    transferLinkedTransactionId: null,
    transferCounterpartId: null,
    isTransferClassified: false,
  };

  const creditTransaction: LedgerTransactionRow = {
    ...debitTransaction,
    id: 'tx-2',
    type: 'CREDIT',
    amount: 5000,
    category: 'EMPLOYMENT',
    source: 'USER_OVERRIDE',
  };

  const reimbursementTransaction: LedgerTransactionRow = {
    ...creditTransaction,
    id: 'tx-3',
    category: 'Reimbursement',
    status: 'EXCLUDED',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchDebitTransactionsFetch.mockResolvedValue([]);
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
    expect(screen.getByLabelText(/ai classified/i)).toBeDefined();
    expect(screen.queryByText('LLM_CLASSIFIED')).toBeNull();
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
    expect(screen.getByLabelText(/set by you/i)).toBeDefined();
    expect(screen.queryByText('USER_OVERRIDE')).toBeNull();
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

  it('lets the user exit the link picker with reset', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={reimbursementTransaction}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByRole('button', { name: /link to original expense/i }));

    expect(screen.getByRole('button', { name: /reset/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
    expect(screen.getByRole('button', { name: /link to original expense/i })).toBeDefined();
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

  it('renders UnlinkTransferButton when transferLinkedTransactionId is non-null', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={{ ...debitTransaction, transferLinkedTransactionId: 'tx-linked' }}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByRole('button', { name: /unlink transfer/i })).toBeDefined();
  });

  it('does not render unlink button when transferLinkedTransactionId is null', () => {
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

    expect(screen.queryByRole('button', { name: /unlink transfer/i })).toBeNull();
  });

  it('does not render Link button when transaction is already linked', () => {
    render(
      <table>
        <tbody>
          <TransactionRow
            transaction={{ ...debitTransaction, transferCounterpartId: 'tx-counterpart' }}
            expenseCategories={expenseCategories}
            incomeSourceLabels={incomeSourceLabels}
            onCategoryChange={vi.fn()}
            onLinkTransfer={vi.fn()}
          />
        </tbody>
      </table>,
    );

    expect(screen.queryByRole('button', { name: 'Link' })).toBeNull();
  });
});
