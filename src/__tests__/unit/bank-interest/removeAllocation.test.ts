import { beforeEach,describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { removeAllocation } from '@/server/services/bank-interest/interest-cleansing.service';

describe('removeAllocation bug reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock as any));
  });

  it('should remove the evidence and clear the InterestCleansing record if no evidence remains', async () => {
    const allocationId = 'alloc-1';
    const cleansingId = 'cleansing-1';
    
    // Setup: removeAllocation finds the evidence record
    prismaMock.interestCleansingEvidence.findUniqueOrThrow.mockResolvedValue({
      interestCleansingId: cleansingId,
    } as any);

    // Setup: removeAllocation deletes the evidence record
    prismaMock.interestCleansingEvidence.delete.mockResolvedValue({
      id: allocationId,
    } as any);

    // Mock: check if other evidence records exist for this Cleansing
    prismaMock.interestCleansingEvidence.count.mockResolvedValue(0);

    // Mock: delete the Cleansing if no evidence remains
    prismaMock.interestCleansing.delete.mockResolvedValue({
      id: cleansingId,
    } as any);

    await removeAllocation(allocationId, 'user-1');

    // Assert: evidence was deleted
    expect(prismaMock.interestCleansingEvidence.delete).toHaveBeenCalledWith({
      where: { id: allocationId },
    });

    // Assert: Cleansing was deleted
    expect(prismaMock.interestCleansing.delete).toHaveBeenCalledWith({
      where: { id: cleansingId },
    });
  });
});
