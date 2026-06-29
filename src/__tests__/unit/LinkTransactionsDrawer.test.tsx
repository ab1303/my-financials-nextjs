import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    calendarYear: {
      getAll: {
        useQuery: () => ({ data: [{ id: 'cal-1' }], isLoading: false }),
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

vi.mock('react-select/creatable', () => ({
  default: ({ inputId, options = [], value, onChange }: any) => (
    <select
      id={inputId}
      value={value?.value ?? ''}
      onChange={(event) => {
        const selected =
          options.find((option: any) => option.value === event.target.value) ??
          null;
        onChange?.(selected);
      }}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/ui/AppSelect', () => ({
  AppSelect: ({ inputId, options = [], value, onChange }: any) => (
    <select
      id={inputId}
      value={value?.value ?? ''}
      onChange={(event) => {
        const selected =
          options.find((option: any) => option.value === event.target.value) ??
          null;
        onChange?.(selected);
      }}
    >
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

import { BeneficiaryEnumType } from '@prisma/client';

import LinkTransactionsDrawer from '@/app/(authorized)/cashflow/donations/_components/LinkTransactionsDrawer';

describe('LinkTransactionsDrawer', () => {
  const transactions = [
    {
      id: 'tx-1',
      date: '2024-07-02',
      description: 'Donation to charity A',
      amount: 100,
      category: 'Gifts & donations',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    transactionQueryMock.mockReturnValue({
      data: transactions,
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

  it('links a transaction as a donation', async () => {
    render(
      <LinkTransactionsDrawer
        isOpen
        onClose={vi.fn()}
        dateFrom='2024-07-01'
        dateTo='2025-06-30'
        calendarYearId='cal-1'
      />,
    );

    fireEvent.click(screen.getByText('Donation to charity A'));
    fireEvent.change(screen.getByLabelText(/beneficiary type/i), {
      target: { value: BeneficiaryEnumType.INDIVIDUAL },
    });
    fireEvent.change(screen.getByLabelText(/^Beneficiary$/i), {
      target: { value: 'ind-1' },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /link donation/i }),
      ).not.toHaveAttribute('disabled');
    });

    fireEvent.click(screen.getByRole('button', { name: /link donation/i }));

    await waitFor(() => {
      expect(addRowMock).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          calendarYearId: 'cal-1',
          beneficiaryId: 'ind-1',
        }),
      );
    });
  });
});
