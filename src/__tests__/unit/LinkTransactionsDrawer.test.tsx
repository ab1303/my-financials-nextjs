import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const addRowMock = vi.hoisted(() => vi.fn());
const transactionQueryMock = vi.hoisted(() => vi.fn());
const individualQueryMock = vi.hoisted(() => vi.fn());
const businessQueryMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/trpc/client', () => ({
  trpc: {
    useUtils: () => ({
      individual: { getAllIndividuals: { invalidate: vi.fn() } },
      business: { getBusinessesByType: { invalidate: vi.fn() } },
    }),
    transactionLedger: {
      getUnlinkedDonationTransactions: {
        useQuery: (...args: unknown[]) => transactionQueryMock(...args),
      },
    },
    individual: {
      getAllIndividuals: {
        useQuery: (...args: unknown[]) => individualQueryMock(...args),
      },
      create: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    business: {
      getBusinessesByType: {
        useQuery: (...args: unknown[]) => businessQueryMock(...args),
      },
      create: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));

vi.mock('@/app/(authorized)/cashflow/donations/actions', () => ({
  addRow: (...args: unknown[]) => addRowMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-select', () => ({
  default: ({
    inputId,
    options = [],
    value,
    onChange,
  }: {
    inputId?: string;
    options?: Array<{ label: string; value: string }>;
    value?: { label: string; value: string } | null;
    onChange?: (option: { label: string; value: string } | null) => void;
  }) => (
    <select
      id={inputId}
      value={value?.value ?? ''}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('react-select/creatable', () => ({
  default: ({
    inputId,
    options = [],
    value,
    onChange,
  }: {
    inputId?: string;
    options?: Array<{ label: string; value: string }>;
    value?: { label: string; value: string } | null;
    onChange?: (option: { label: string; value: string } | null) => void;
  }) => (
    <select
      id={inputId}
      value={value?.value ?? ''}
      onChange={(event) => {
        const selected = options.find((option) => option.value === event.target.value) ?? null;
        onChange?.(selected);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

import LinkTransactionsDrawer from '@/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer';
import { BeneficiaryEnumType } from '@prisma/client';

const baseTransactions = [
  {
    id: 'tx-1',
    date: '2024-07-02',
    description: 'Donation to charity A',
    amount: 100,
    category: 'Gifts & donations',
  },
  {
    id: 'tx-2',
    date: '2024-07-10',
    description: 'Donation to charity B',
    amount: 50,
    category: 'Gifts & donations',
  },
];

describe('LinkTransactionsDrawer', () => {
  const renderDrawer = () =>
    render(
      <LinkTransactionsDrawer
        isOpen
        onClose={vi.fn()}
        dateFrom="2024-07-01"
        dateTo="2025-06-30"
        calendarYearId="cal-1"
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    transactionQueryMock.mockReturnValue({
      data: baseTransactions,
      isLoading: false,
    });
    individualQueryMock.mockReturnValue({
      data: [{ id: 'ind-1', name: 'John Citizen' }],
      isLoading: false,
    });
    businessQueryMock.mockReturnValue({
      data: [{ id: 'biz-1', name: 'Charity Business' }],
      isLoading: false,
    });
    addRowMock.mockResolvedValue({ success: true, error: null });
  });

  it('lists all unlinked transactions returned by tRPC query', () => {
    renderDrawer();

    expect(screen.getByText('Donation to charity A')).toBeDefined();
    expect(screen.getByText('Donation to charity B')).toBeDefined();
  });

  it('shows empty state when no unlinked transactions', () => {
    transactionQueryMock.mockReturnValue({ data: [], isLoading: false });

    renderDrawer();

    expect(screen.getByText(/no unlinked donation transactions found/i)).toBeDefined();
  });

  it('selecting a transaction shows its category as readonly and enables form', () => {
    renderDrawer();

    fireEvent.click(screen.getByText('Donation to charity A'));

    // Category is now readonly, derived from transaction
    expect(screen.getByText('Gifts & donations')).toBeDefined();
    expect(screen.getByRole('button', { name: /save & next/i })).toBeDefined();
  });

  it('save button is disabled when no transaction is selected', () => {
    transactionQueryMock.mockReturnValueOnce({ data: [], isLoading: false });
    renderDrawer();

    expect(screen.getByRole('button', { name: /save & next/i })).toHaveAttribute('disabled');
  });

  it('submitting calls addRow with transactionId and category as taxCategory', async () => {
    renderDrawer();

    fireEvent.click(screen.getByText('Donation to charity A'));
    // taxCategory is now auto-populated from transaction.category — no user input needed
    fireEvent.change(screen.getByLabelText(/beneficiary type/i), {
      target: { value: BeneficiaryEnumType.INDIVIDUAL },
    });
    fireEvent.change(screen.getByLabelText(/^Beneficiary$/i), {
      target: { value: 'ind-1' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save & next/i })).not.toHaveAttribute('disabled');
    });

    fireEvent.click(screen.getByRole('button', { name: /save & next/i }));

    await waitFor(() => {
      expect(addRowMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          calendarYearId: 'cal-1',
          taxCategory: 'Gifts & donations',
        }),
      );
    });
  });

  it('on success, linked transaction is removed from the list', async () => {
    renderDrawer();

    fireEvent.click(screen.getByText('Donation to charity A'));
    // taxCategory comes from transaction.category automatically
    fireEvent.change(screen.getByLabelText(/^Beneficiary$/i), {
      target: { value: 'ind-1' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save & next/i })).not.toHaveAttribute('disabled');
    });

    fireEvent.click(screen.getByRole('button', { name: /save & next/i }));

    await waitFor(() => {
      expect(screen.queryByText('Donation to charity A')).toBeNull();
    });
  });
});
