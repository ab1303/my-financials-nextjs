import { describe, expect, it } from 'vitest';
import { buildTransactionWhere } from '@/server/trpc/router/transaction-ledger';

describe('buildTransactionWhere', () => {
  it('filters uncategorized transactions by empty category', () => {
    const where = buildTransactionWhere({ uncategorized: true } as never, 'user-1');

    expect(where.userId).toBe('user-1');
    expect(where.category).toBe('');
  });

  it('applies amount range filters', () => {
    const where = buildTransactionWhere({ amountMin: 500, amountMax: 1000 } as never, 'user-1');

    expect(where.amount).toEqual({ gte: 500, lte: 1000 });
  });

  it('applies date range filters', () => {
    const where = buildTransactionWhere({ dateFrom: '2024-01-01', dateTo: '2024-01-31' } as never, 'user-1');

    expect(where.date).toBeDefined();
    expect(where.date).toMatchObject({
      gte: new Date('2024-01-01T00:00:00'),
      lte: new Date('2024-01-31T23:59:59.999'),
    });
  });
});
