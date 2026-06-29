import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { useCleanseDonationState } from '@/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/useCleanseDonationState';
import { trpc } from '@/server/trpc/client';

type MockWithReturn = {
  mockReturnValue: (value: unknown) => void;
};

const asMock = (value: unknown): MockWithReturn => value as MockWithReturn;

// Mock trpc
vi.mock('@/server/trpc/client', () => ({
  trpc: {
    bankInterest: {
      getUnlinkedInterestTransactions: { useQuery: vi.fn() },
      getInterestCleansingData: { useQuery: vi.fn() },
      suggestAllocations: { useQuery: vi.fn() },
      applyAllocations: { useMutation: vi.fn() },
      removeAllocation: { useMutation: vi.fn() },
    },
    individual: { getAllIndividuals: { useQuery: vi.fn() } },
    business: { getBusinessesByType: { useQuery: vi.fn() } },
    useUtils: vi.fn(),
  },
}));

describe('useCleanseDonationState evidence loading bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(
      trpc.bankInterest.getUnlinkedInterestTransactions.useQuery,
    ).mockReturnValue({ data: [], isLoading: false });
    asMock(trpc.bankInterest.getInterestCleansingData.useQuery).mockReturnValue(
      { data: { cleansingDonations: [] }, isLoading: false },
    );
    asMock(trpc.bankInterest.suggestAllocations.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
    });
    asMock(trpc.bankInterest.applyAllocations.useMutation).mockReturnValue({
      mutateAsync: vi.fn(),
    });
    asMock(trpc.bankInterest.removeAllocation.useMutation).mockReturnValue({
      mutateAsync: vi.fn(),
    });
    asMock(trpc.useUtils).mockReturnValue({});
    asMock(trpc.individual.getAllIndividuals.useQuery).mockReturnValue({
      data: [],
    });
    asMock(trpc.business.getBusinessesByType.useQuery).mockReturnValue({
      data: [],
    });
  });

  it('should clear evidence when switching to an unlinked transaction', async () => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      institutionId: 'b1',
      calendarYearId: 'y1',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      onDonationSaved: vi.fn(),
    };

    // Simulate existing evidence for tx1
    asMock(trpc.bankInterest.getInterestCleansingData.useQuery).mockReturnValue(
      {
        data: {
          cleansingDonations: [
            {
              interestTxId: 'tx1',
              evidence: [
                {
                  id: 'e1',
                  amountApplied: 10,
                  description: 'ev1',
                  date: new Date(),
                },
              ],
            },
          ],
        },
        isLoading: false,
      },
    );

    const { result } = renderHook(() => useCleanseDonationState(props));

    // Select tx1
    act(() => {
      result.current.handleSelectTransaction('tx1');
    });

    // Evidence should be loaded
    expect(result.current.selectedEvidence.length).toBe(1);

    // Switch to unlinked tx2
    act(() => {
      result.current.handleSelectTransaction('tx2');
    });

    // Evidence should be cleared
    expect(result.current.selectedEvidence.length).toBe(0);
  });
});
