import { describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';

vi.mock('@/server/db/client', () => ({
  prisma: prismaMock,
}));

import { findDuplicatesForClassifiedMonths } from '@/server/services/transactions/dedup.service';

describe('findDuplicatesForClassifiedMonths', () => {
  it('returns empty list when no duplicates found', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const result = await findDuplicatesForClassifiedMonths({
      userId: 'user-1',
      bankAccountId: 'bank-1',
      classifiedMonths: [],
    });

    expect(result).toEqual([]);
  });

  it('identifies duplicate when key matches existing transaction', async () => {
    const existingTx = {
      id: 'tx-1',
      date: new Date('2025-01-15T00:00:00.000Z'),
      description: 'Woolworths',
      amount: 42.5,
      type: 'DEBIT',
    };
    prismaMock.transaction.findMany.mockResolvedValue([existingTx as never]);

    const classifiedMonths = [
      {
        month: '2025-01',
        transactions: [
          {
            id: 'csv-1',
            date: '2025-01-15',
            description: 'Woolworths',
            amount: 42.5,
            type: 'DEBIT' as const,
            llmCategory: 'Food',
          },
        ],
      },
    ];

    const result = await findDuplicatesForClassifiedMonths({
      userId: 'user-1',
      bankAccountId: 'bank-1',
      classifiedMonths: classifiedMonths as never,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      csvId: 'csv-1',
      matchedTransactionIds: ['tx-1'],
    });
  });
});
