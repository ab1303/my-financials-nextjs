import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TransactionRow from '@/components/transactions/TransactionRow';
import { REIMBURSEMENT_CATEGORY } from '@/server/services/transactions/constants';
import type { TransactionRow as LedgerTransactionRow } from '@/server/trpc/router/transaction-ledger';

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      transactionLedger: {
        searchDebitTransactions: {
          fetch: vi.fn().mockResolvedValue([]),
        },
      },
    }),
  },
}));

vi.mock('react-select', () => ({
  default: ({ value, options, 'aria-label': ariaLabel }: any) => (
    <div aria-label={ariaLabel} data-testid={ariaLabel}>
      {value?.label ?? value?.value ?? 'select'}
      {Array.isArray(options) ? options.length : 0}
    </div>
  ),
}));

vi.mock('react-select/async', () => ({
  default: ({ 'aria-label': ariaLabel }: any) => <div aria-label={ariaLabel}>async-select</div>,
}));

vi.mock('@/components/transactions/TransactionSourceIndicator', () => ({
  default: () => <span data-testid="transaction-source-indicator" />,
}));

vi.mock('@/components/transactions/ReimbursementSubRow', () => ({
  default: () => null,
}));

function renderRow(transaction: Partial<LedgerTransactionRow>) {
  const baseTransaction = {
    id: 'tx-1',
    date: '2025-01-15T00:00:00.000Z',
    description: 'Donation to charity',
    amount: 100,
    type: 'DEBIT',
    category: 'Gifts & donations',
    offsetCategory: null,
    offsetTransactionId: null,
    reimbursements: [],
    status: 'CONFIRMED',
    source: 'BANK',
    bankAccountName: 'Everyday',
    bankName: 'CommBank',
  } as LedgerTransactionRow;

  return render(
    <table>
      <tbody>
        <TransactionRow
          transaction={{ ...baseTransaction, ...transaction }}
          expenseCategories={[{ id: '1', name: 'Travel' }]}
          incomeSourceLabels={['Salary']}
          onCategoryChange={vi.fn()}
        />
      </tbody>
    </table>,
  );
}

describe('TransactionRow donation badge', () => {
  it('renders the linked badge for linked donation debits', () => {
    renderRow({ category: 'Gifts & donations', type: 'DEBIT', isDonationLinked: true });

    expect(screen.getByText('🔗 Linked')).toBeInTheDocument();
  });

  it('renders the needs recipient badge for unlinked donation debits', () => {
    renderRow({ category: 'Gifts & donations', type: 'DEBIT', isDonationLinked: false });

    expect(screen.getByText('⚠️ Needs recipient')).toBeInTheDocument();
  });

  it('does not render a badge for a non-donation debit row', () => {
    renderRow({ category: 'Office supplies', type: 'DEBIT', isDonationLinked: true });

    expect(screen.queryByText('🔗 Linked')).not.toBeInTheDocument();
    expect(screen.queryByText('⚠️ Needs recipient')).not.toBeInTheDocument();
  });

  it('does not render a badge for a credit donation row', () => {
    renderRow({ category: 'Gifts & donations', type: 'CREDIT', isDonationLinked: true });

    expect(screen.queryByText('🔗 Linked')).not.toBeInTheDocument();
    expect(screen.queryByText('⚠️ Needs recipient')).not.toBeInTheDocument();
  });
});
