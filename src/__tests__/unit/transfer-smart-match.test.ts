import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractPatternFromPair,
  batchLinkTransferPairs,
} from '@/server/services/transactions/transfer.service';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionStatusEnum, TransactionTypeEnum } from '@prisma/client';

function createMockPrisma(options?: { failDebitId?: string }) {
  const updates: Array<{ id: string }> = [];
  const mockPrisma = {
    transaction: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === options?.failDebitId) return null;
        if (where.id.startsWith('d')) {
          return {
            id: where.id,
            userId: 'user-1',
            type: TransactionTypeEnum.DEBIT,
            bankAccountId: 'acc-debit',
            status: TransactionStatusEnum.EXCLUDED,
            category: 'Transfer',
            amount: new Decimal(100),
            date: new Date('2024-01-01'),
            transferLinkedTransactionId: null,
          };
        }
        return {
          id: where.id,
          userId: 'user-1',
          type: TransactionTypeEnum.CREDIT,
          bankAccountId: 'acc-credit',
          status: TransactionStatusEnum.EXCLUDED,
          category: 'Transfer',
          amount: new Decimal(100),
          date: new Date('2024-01-02'),
          transferLinkedTransactionId: null,
        };
      }),
      update: vi.fn(async ({ where }: { where: { id: string } }) => {
        updates.push({ id: where.id });
        return {};
      }),
    },
    incomeRecord: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<void>) => cb(mockPrisma)),
  } as any;

  return { mockPrisma, updates };
}

describe('transfer smart match helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extractPatternFromPair strips stop words', () => {
    const result = extractPatternFromPair({
      debit: {
        description: 'Transfer to my savings account',
        amount: new Decimal(50),
        date: new Date('2024-01-01'),
        bankAccountId: 'a',
        bankId: 'b',
      },
      credit: {
        description: 'From the app transfer',
        amount: new Decimal(50),
        date: new Date('2024-01-02'),
        bankAccountId: 'c',
        bankId: 'd',
      },
    });

    expect(result.debitKeywords).toContain('transfer');
    expect(result.debitKeywords).not.toContain('to');
    expect(result.debitKeywords).not.toContain('my');
  });

  it('extractPatternFromPair returns lowercased non-trivial tokens', () => {
    const result = extractPatternFromPair({
      debit: {
        description: 'FAST Transfer TO Savings-123',
        amount: new Decimal(50),
        date: new Date('2024-01-01'),
        bankAccountId: 'a',
        bankId: 'b',
      },
      credit: {
        description: 'From Checking',
        amount: new Decimal(50),
        date: new Date('2024-01-03'),
        bankAccountId: 'c',
        bankId: 'd',
      },
    });

    expect(result.debitKeywords).toContain('fast');
    expect(result.debitKeywords).toContain('savings');
    expect(result.debitKeywords).toContain('123');
    expect(result.maxDayGap).toBeGreaterThanOrEqual(5);
  });

  it('batchLinkTransferPairs with 3 valid pairs returns linked count 3', async () => {
    const { mockPrisma } = createMockPrisma();

    const result = await batchLinkTransferPairs({
      prisma: mockPrisma,
      userId: 'user-1',
      pairs: [
        { debitTransactionId: 'd1', creditTransactionId: 'c1' },
        { debitTransactionId: 'd2', creditTransactionId: 'c2' },
        { debitTransactionId: 'd3', creditTransactionId: 'c3' },
      ],
    });

    expect(result).toEqual({ linkedCount: 3, errors: [] });
  });

  it("batchLinkTransferPairs error in one pair doesn't roll back others", async () => {
    const { mockPrisma } = createMockPrisma({ failDebitId: 'd2' });

    const result = await batchLinkTransferPairs({
      prisma: mockPrisma,
      userId: 'user-1',
      pairs: [
        { debitTransactionId: 'd1', creditTransactionId: 'c1' },
        { debitTransactionId: 'd2', creditTransactionId: 'c2' },
        { debitTransactionId: 'd3', creditTransactionId: 'c3' },
      ],
    });

    expect(result.linkedCount).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.debitId).toBe('d2');
  });
});
