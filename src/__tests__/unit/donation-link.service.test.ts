import type { Prisma } from '@prisma/client';
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
    prismaMock.voluntaryDonation.findMany.mockResolvedValue([]);
    prismaMock.interestCleansingEvidence.findMany.mockResolvedValue([]);
    prismaMock.zakatPayment.findMany.mockResolvedValue([]);
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
    ] as never);

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

  it('getUnlinkedDonationTransactions excludes transactions linked to VoluntaryDonation, InterestCleansing, or ZakatPayment', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 'tx_1',
        date: new Date(),
        description: 'd1',
        amount: 1,
        category: 'c',
      },
      {
        id: 'tx_2',
        date: new Date(),
        description: 'd2',
        amount: 2,
        category: 'c',
      },
      {
        id: 'tx_3',
        date: new Date(),
        description: 'd3',
        amount: 3,
        category: 'c',
      },
      {
        id: 'tx_4',
        date: new Date(),
        description: 'd4',
        amount: 4,
        category: 'c',
      },
    ] as never);
    prismaMock.voluntaryDonation.findMany.mockResolvedValue([
      { transactionId: 'tx_1' },
    ] as never);
    prismaMock.interestCleansingEvidence.findMany.mockResolvedValue([
      { transactionId: 'tx_2' },
    ] as never);
    prismaMock.zakatPayment.findMany.mockResolvedValue([
      { transactionId: 'tx_3' },
    ] as never);

    const result = await getUnlinkedDonationTransactions(
      'user_1',
      new Date('2024-07-01T00:00:00.000Z'),
      new Date('2025-06-30T23:59:59.000Z'),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('tx_4');
  });

  it('getUnlinkedDonationTransactions excludes transactions outside the given date range', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([] as never);

    await getUnlinkedDonationTransactions(
      'user_1',
      new Date('2024-07-01T00:00:00.000Z'),
      new Date('2025-06-30T23:59:59.000Z'),
    );

    const call = prismaMock.transaction.findMany.mock.calls[0]?.[0];

    const where = (call?.where ?? {}) as Prisma.TransactionWhereInput;
    const dateFilter = where.date as Prisma.DateTimeFilter<'Transaction'>;

    expect(dateFilter?.gte).toEqual(new Date('2024-07-01T00:00:00.000Z'));
    expect(dateFilter?.lte).toEqual(new Date('2025-06-30T23:59:59.000Z'));
  });

  it('countUnlinkedDonationTransactions returns 0 when all donations are linked', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: 'tx_1' },
    ] as never);
    prismaMock.voluntaryDonation.findMany.mockResolvedValue([
      { transactionId: 'tx_1' },
    ] as never);

    const result = await countUnlinkedDonationTransactions(
      'user_1',
      2024,
      2025,
    );

    expect(result).toBe(0);
  });

  it('countUnlinkedDonationTransactions returns 0 when donation is linked via InterestCleansingEvidence', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      { id: 'tx_1' },
    ] as never);
    prismaMock.interestCleansingEvidence.findMany.mockResolvedValue([
      { transactionId: 'tx_1' },
    ] as never);

    const result = await countUnlinkedDonationTransactions(
      'user_1',
      2024,
      2025,
    );

    expect(result).toBe(0);
  });
});
