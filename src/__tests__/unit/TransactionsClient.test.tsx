import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TransactionsClient from '@/app/(authorized)/cashflow/transactions/_components/TransactionsClient';

// Mock the wizard components
vi.mock('@/app/(authorized)/cashflow/transactions/_components/csv/CSVImportWizard', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="csv-wizard">CSV Wizard</div> : null,
}));
vi.mock('@/app/(authorized)/cashflow/transactions/_components/ai/AIImportWizard', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="ai-wizard">AI Wizard</div> : null,
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
    const csvCard = screen.getByText('CSV Bank Statement').closest('div');
    fireEvent.click(csvCard!);
    expect(screen.getByTestId('csv-wizard')).toBeDefined();
  });

  it('opens AI wizard when AI card is clicked', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    const aiCard = screen.getByText('AI Receipt / Invoice').closest('div');
    fireEvent.click(aiCard!);
    expect(screen.getByTestId('ai-wizard')).toBeDefined();
  });

  it('CSV wizard is closed initially', () => {
    render(<TransactionsClient bankAccounts={mockBankAccounts} />);
    expect(screen.queryByTestId('csv-wizard')).toBeNull();
  });
});