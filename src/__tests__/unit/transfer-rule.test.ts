import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  createRule,
  deleteRule,
  listRules,
  toggleRule,
} from '@/server/services/transactions/transfer-rule.service';

const mockRuleCreate = vi.fn();
const mockRuleFindMany = vi.fn();
const mockRuleFindUnique = vi.fn();
const mockRuleUpdate = vi.fn();
const mockRuleDelete = vi.fn();

const mockPrisma = {
  transferMatchRule: {
    create: mockRuleCreate,
    findMany: mockRuleFindMany,
    findUnique: mockRuleFindUnique,
    update: mockRuleUpdate,
    delete: mockRuleDelete,
  },
} as any;

describe('transfer-rule service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createRule persists fields and returns RuleListItem', async () => {
    mockRuleCreate.mockResolvedValue({
      id: 'rule-1',
      name: 'My Rule',
      isActive: true,
      amountExact: new Decimal(100),
      debitKeywords: ['pay'],
      creditKeywords: ['pay'],
      maxDayGap: 5,
      confidenceThreshold: 85,
      matchCount: 0,
      lastMatchedAt: null,
    });

    const result = await createRule({
      prisma: mockPrisma,
      userId: 'user-1',
      name: 'My Rule',
      amountExact: new Decimal(100),
      debitKeywords: ['pay'],
      creditKeywords: ['pay'],
      maxDayGap: 5,
      debitBankAccountId: null,
      creditBankAccountId: null,
    });

    expect(mockRuleCreate).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'rule-1',
      name: 'My Rule',
      amountExact: 100,
      maxDayGap: 5,
    });
  });

  it('listRules returns mapped rules', async () => {
    mockRuleFindMany.mockResolvedValue([
      {
        id: 'rule-2',
        name: 'Newest',
        isActive: true,
        amountExact: new Decimal(20),
        debitKeywords: ['abc'],
        creditKeywords: ['def'],
        maxDayGap: 2,
        confidenceThreshold: 90,
        matchCount: 3,
        lastMatchedAt: new Date('2024-01-01'),
      },
    ]);

    const result = await listRules({ prisma: mockPrisma, userId: 'user-1' });

    expect(mockRuleFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Newest');
  });

  it('toggleRule flips isActive without changing other fields', async () => {
    mockRuleFindUnique.mockResolvedValue({ id: 'rule-1', userId: 'user-1' });
    await toggleRule({
      prisma: mockPrisma,
      userId: 'user-1',
      ruleId: 'rule-1',
      isActive: false,
    });

    expect(mockRuleUpdate).toHaveBeenCalledWith({
      where: { id: 'rule-1' },
      data: { isActive: false },
    });
  });

  it('deleteRule owned by different user throws error', async () => {
    mockRuleFindUnique.mockResolvedValue({ id: 'rule-1', userId: 'other-user' });

    await expect(
      deleteRule({ prisma: mockPrisma, userId: 'user-1', ruleId: 'rule-1' }),
    ).rejects.toThrow('Rule not found or not authorized');

    expect(mockRuleDelete).not.toHaveBeenCalled();
  });
});
