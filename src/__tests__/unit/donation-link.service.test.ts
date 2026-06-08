import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';

vi.mock('@/server/db/client', () => ({
  prisma: prismaMock,
}));

import {
  countUnlinkedDonationTransactions,
  getUnlinkedDonationTransactions,
} from '@/server/services/transactions/donation-link.service';

describe('donation-link.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.donationPaymentEvidence.findMany.mockResolvedValue([]);
    prismaMock.donationPayment.findMany.mockResolvedValue([]);
  });

  it('getUnlinkedDonationTransactions returns only DEBIT CONFIRMED "Gifts & donations" transactions with no linked DonationPayment', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx_1',
        date: new Date('2025-01-15T00:00:00.000Z'),
        description: 'Donation to charity',
        amount: 125.5,
        category: 'Gifts & donations',
      },
    ] as any);

    const result = await getUnlinkedDonationTransactions(
      'user_1',
      new Date('2024-07-01T00:00:00.000Z'),
      new Date('2025-06-30T23:59:59.000Z'),
    );

    expect(result).toEqual([
      {
        id: 'tx_1',
        date: '2025-01-15',
        description: 'Donation to charity',
        amount: 125.5,
        category: 'Gifts & donations',
      },
    ]);

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user_1',
          type: 'DEBIT',
          status: 'CONFIRMED',
          category: { equals: 'Gifts & donations', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('getUnlinkedDonationTransactions excludes transactions already linked to a DonationPayment', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: 'tx_1', date: new Date(), description: 'd', amount: 1, category: 'c' },
    ] as any);
    prismaMock.donationPaymentEvidence.findMany.mockResolvedValue([
      { evidenceTransactionId: 'tx_1' },
    ] as any);

    const result = await getUnlinkedDonationTransactions(
      'user_1',
      new Date('2024-07-01T00:00:00.000Z'),
      new Date('2025-06-30T23:59:59.000Z'),
    );

    expect(result).toEqual([]);
  });

  it('getUnlinkedDonationTransactions excludes transactions outside the given date range', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([] as any);

    await getUnlinkedDonationTransactions(
      'user_1',
      new Date('2024-07-01T00:00:00.000Z'),
      new Date('2025-06-30T23:59:59.000Z'),
    );

    const call = prismaMock.transaction.findMany.mock.calls[0]?.[0];

    expect((call?.where as any)?.date?.gte).toEqual(new Date('2024-07-01T00:00:00.000Z'));
    expect((call?.where as any)?.date?.lte).toEqual(new Date('2025-06-30T23:59:59.000Z'));
  });

  it('countUnlinkedDonationTransactions returns 0 when all donations are linked', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 'tx_1' }] as any);
    prismaMock.donationPaymentEvidence.findMany.mockResolvedValue([
      { evidenceTransactionId: 'tx_1' },
    ] as any);

    const result = await countUnlinkedDonationTransactions('user_1', 2024, 2025);

    expect(result).toBe(0);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user_1',
          type: 'DEBIT',
          status: 'CONFIRMED',
          category: { equals: 'Gifts & donations', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('countUnlinkedDonationTransactions returns 0 when donation is linked via interestTxId', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([{ id: 'tx_1' }] as any);
    prismaMock.donationPayment.findMany.mockResolvedValue([
      { interestTxId: 'tx_1' },
    ] as any);

    const result = await countUnlinkedDonationTransactions('user_1', 2024, 2025);

    expect(result).toBe(0);
  });
});