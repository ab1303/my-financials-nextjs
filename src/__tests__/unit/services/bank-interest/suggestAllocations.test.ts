import { beforeEach,describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { suggestAllocations } from '@/server/services/bank-interest/interest-cleansing.service';

describe('suggestAllocations service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when no candidate donations exist', async () => {
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue({
      id: 'credit-1',
      amount: { toNumber: () => 100 },
      date: new Date('2025-01-01'),
      description: 'Credit Interest',
    });
    // interestCleansing.findMany is called twice in the service (candidates, existingLinked)
    prismaMock.interestCleansing.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await suggestAllocations('credit-1', 10, 'user-1');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('scores and orders candidates by score (higher is better)', async () => {
    prismaMock.transaction.findUniqueOrThrow.mockResolvedValue({
      id: 'credit-2',
      amount: { toNumber: () => 200 },
      date: new Date('2025-06-15'),
      description: 'Interest Payment ACME',
    });

    // Candidate A: close amount and exact token in description
    const candidateA = {
      id: 'dp-a',
      amount: 200,
      datePaid: new Date('2025-06-16'),
      creditTxId: null,
      donationLedgerId: 'ledger-1',
      beneficiaryType: 'BUSINESS' as const,
      businessId: 'bus-1',
      individualId: null,
      donationPurpose: 'INTEREST_CLEANSING' as const,
      evidence: [{ transaction: { description: 'ACME Corp fee' } }],
    };

    // Candidate B: different amount and date
    const candidateB = {
      id: 'dp-b',
      amount: 50,
      datePaid: new Date('2025-03-01'),
      creditTxId: null,
      donationLedgerId: 'ledger-1',
      beneficiaryType: 'BUSINESS' as const,
      businessId: 'bus-1',
      individualId: null,
      donationPurpose: 'INTEREST_CLEANSING' as const,
      evidence: [
        { transaction: { description: 'Some other payment' } },
      ],
    };

    // interestCleansing.findMany called twice: first for candidates, then for existingLinked
    prismaMock.interestCleansing.findMany
      .mockResolvedValueOnce([candidateA, candidateB])
      .mockResolvedValueOnce([]);

    const suggestions = await suggestAllocations('credit-2', 10, 'user-1');

    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    // Top suggestion should be candidateA (closer amount + desc)
    expect(suggestions[0].donationPaymentId).toBe('dp-a');
    expect(suggestions[0].score).toBeGreaterThan(
      suggestions[suggestions.length - 1].score,
    );
  });
});
