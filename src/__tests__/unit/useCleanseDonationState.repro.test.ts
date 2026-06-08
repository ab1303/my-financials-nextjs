import { act,renderHook } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { useCleanseDonationState } from '@/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/useCleanseDonationState';
import { trpc } from '@/server/trpc/client';

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
    (trpc.bankInterest.getUnlinkedInterestTransactions.useQuery as any).mockReturnValue({ data: [], isLoading: false });
    (trpc.bankInterest.getInterestCleansingData.useQuery as any).mockReturnValue({ data: { cleansingDonations: [] }, isLoading: false });
    (trpc.bankInterest.suggestAllocations.useQuery as any).mockReturnValue({ data: [], isLoading: false });
    (trpc.bankInterest.applyAllocations.useMutation as any).mockReturnValue({ mutateAsync: vi.fn() });
    (trpc.bankInterest.removeAllocation.useMutation as any).mockReturnValue({ mutateAsync: vi.fn() });
    (trpc.useUtils as any).mockReturnValue({});
    (trpc.individual.getAllIndividuals.useQuery as any).mockReturnValue({ data: [] });
    (trpc.business.getBusinessesByType.useQuery as any).mockReturnValue({ data: [] });
  });

  it('should clear evidence when switching to an unlinked transaction', async () => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      bankId: 'b1',
      calendarYearId: 'y1',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      onDonationSaved: vi.fn(),
    };

    // Simulate existing evidence for tx1
    (trpc.bankInterest.getInterestCleansingData.useQuery as any).mockReturnValue({
      data: {
        cleansingDonations: [{
          interestTxId: 'tx1',
          evidence: [{ id: 'e1', amountApplied: 10, description: 'ev1', date: new Date() }]
        }]
      },
      isLoading: false
    });

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
