import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TransactionsClient from '@/app/(authorized)/cashflow/transactions/_components/TransactionsClient';

vi.mock('@/components/transactions/ImportSessionHistory', () => ({
  default: () => null,
}));

vi.mock('@/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="csv-wizard">CSV Wizard</div> : null,
}));
vi.mock('@/app/(authorized)/cashflow/transactions/_components/ai/AIImportWizard', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="ai-wizard">AI Wizard</div> : null,
}));
vi.mock('@/components/transactions/TransactionLedgerTable', () => ({
  default: () => <div data-testid="ledger-table">Ledger</div>,
}));

const mockBankAccounts = [
  { id: 'acc-1', name: 'Everyday Account', bankName: 'Commonwealth Bank' },
  { id: 'acc-2', name: 'Savings', bankName: 'ANZ' },
];

describe('TransactionsClient', () => {
  it('renders page heading', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    expect(screen.getByText('Transactions')).toBeDefined();
  });

  it('renders two import cards', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    expect(screen.getByText('CSV Bank Statement')).toBeDefined();
    expect(screen.getByText('AI Receipt / Invoice')).toBeDefined();
  });

  it('opens CSV wizard when CSV card is clicked', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    fireEvent.click(screen.getByRole('button', { name: /CSV Bank Statement/i }));
    expect(screen.getByTestId('csv-wizard')).toBeDefined();
  });

  it('opens AI wizard when AI card is clicked', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    fireEvent.click(screen.getByRole('button', { name: /AI Receipt \/ Invoice/i }));
    expect(screen.getByTestId('ai-wizard')).toBeDefined();
  });

  it('CSV wizard is closed initially', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    expect(screen.queryByTestId('csv-wizard')).toBeNull();
  });

  it('renders TransactionLedgerTable below import cards', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    expect(screen.getByTestId('ledger-table')).toBeDefined();
  });
});

