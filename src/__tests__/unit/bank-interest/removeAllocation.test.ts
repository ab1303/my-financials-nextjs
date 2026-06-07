import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { removeAllocation } from '@/server/services/bank-interest/interest-cleansing.service';

describe('removeAllocation bug reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock));
  });

  it('should remove the evidence and clear the interestTxId from DonationPayment if no evidence remains', async () => {
    const allocationId = 'alloc-1';
    const donationPaymentId = 'dp-1';
    
    // Setup: removeAllocation finds the evidence record
    prismaMock.donationPaymentEvidence.findUniqueOrThrow.mockResolvedValue({
      id: allocationId,
      donationPaymentId,
      evidenceTransactionId: 'tx-1',
      amountApplied: 10,
      confidence: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Setup: removeAllocation finds the evidence record
    prismaMock.donationPaymentEvidence.delete.mockResolvedValue({
      id: allocationId,
      donationPaymentId,
      evidenceTransactionId: 'tx-1',
      amountApplied: 10,
      confidence: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Mock: check if other evidence records exist for this DonationPayment
    prismaMock.donationPaymentEvidence.count.mockResolvedValue(0);

    // Mock: update the DonationPayment to clear interestTxId
    prismaMock.donationPayment.update.mockResolvedValue({
      id: donationPaymentId,
      interestTxId: null,
    } as any);

    await removeAllocation(allocationId, 'user-1');

    // Assert: evidence was deleted
    expect(prismaMock.donationPaymentEvidence.delete).toHaveBeenCalledWith({
      where: { id: allocationId },
    });

    // Assert: DonationPayment was updated (THIS IS WHAT'S MISSING IN CURRENT CODE)
    expect(prismaMock.donationPayment.update).toHaveBeenCalledWith({
      where: { id: donationPaymentId },
      data: { interestTxId: null },
    });
  });
});
