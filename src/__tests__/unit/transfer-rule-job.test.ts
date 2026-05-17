import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { TransactionTypeEnum } from '@prisma/client';
import { runTransferMatchRules } from '@/server/services/transactions/transfer-rule-job.service';

const mockLinkTransferPair = vi.fn();
const mockScoreCandidate = vi.fn();

vi.mock('@/server/services/transactions/transfer.service', () => ({
  linkTransferPair: (...args: unknown[]) => mockLinkTransferPair(...args),
  scoreCandidate: (...args: unknown[]) => mockScoreCandidate(...args),
}));

describe('runTransferMatchRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScoreCandidate.mockReturnValue({ score: 90 });
  });

  it('returns zero summary when no active rules', async () => {
    const prisma = {
      transferMatchRule: { findMany: vi.fn().mockResolvedValue([]) },
    } as any;

    const result = await runTransferMatchRules({
      prisma,
      userId: 'u1',
      importSessionId: 's1',
    });

    expect(result).toEqual({
      rulesRan: 0,
      autoLinkedCount: 0,
      flaggedCount: 0,
      skippedCount: 0,
      jobResultIds: [],
    });
  });

  it('queries rules with isActive=true (inactive rules skipped)', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      transferMatchRule: { findMany },
    } as any;

    await runTransferMatchRules({
      prisma,
      userId: 'u1',
      importSessionId: 's1',
    });

    expect(findMany).toHaveBeenCalledWith({ where: { userId: 'u1', isActive: true } });
  });

  it('increments rule matchCount after successful auto-link', async () => {
    mockLinkTransferPair.mockResolvedValue({});
    const prisma = {
      transferMatchRule: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'rule-1',
            debitBankAccountId: null,
            creditBankAccountId: null,
            amountExact: new Decimal(100),
            maxDayGap: 5,
            confidenceThreshold: 85,
            debitKeywords: ['transfer'],
          },
        ]),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'd1',
              userId: 'u1',
              type: TransactionTypeEnum.DEBIT,
              category: 'Transfer',
              amount: new Decimal(100),
              date: new Date('2024-01-10'),
              description: 'Transfer to savings',
              bankAccountId: 'acc-1',
              transferLinkedTransactionId: null,
              transferCounterpart: null,
              bankAccount: { bankId: 'b1' },
              importSessionId: 's1',
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'c1',
              userId: 'u1',
              type: TransactionTypeEnum.CREDIT,
              category: 'Transfer',
              amount: new Decimal(100),
              date: new Date('2024-01-11'),
              description: 'Transfer from spending',
              bankAccountId: 'acc-2',
              transferLinkedTransactionId: null,
              transferCounterpart: null,
              bankAccount: { bankId: 'b2' },
            },
          ]),
        findUnique: vi.fn().mockResolvedValue({
          transferLinkedTransactionId: null,
          transferCounterpart: null,
        }),
      },
      transferMatchJobResult: {
        create: vi.fn().mockResolvedValue({ id: 'jr-1' }),
      },
    } as any;

    const result = await runTransferMatchRules({
      prisma,
      userId: 'u1',
      importSessionId: 's1',
    });

    expect(result.rulesRan).toBe(1);
    expect(result.autoLinkedCount).toBe(1);
    expect(prisma.transferMatchRule.update).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { matchCount: { increment: 1 }, lastMatchedAt: expect.any(Date) },
    });
  });
});
