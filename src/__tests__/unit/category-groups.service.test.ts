import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listCategoryGroups } from '@/server/services/category-groups/category-groups.service';

const mockCategoryGroupFindMany = vi.fn();

const mockPrisma = {
  categoryGroup: {
    findMany: mockCategoryGroupFindMany,
  },
} as unknown as PrismaClient;

describe('category-groups service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCategoryGroups', () => {
    it('returns all category groups for a user with member count', async () => {
      mockCategoryGroupFindMany.mockResolvedValue([
        {
          id: 'group-1',
          userId: 'user-1',
          scope: 'INCOME',
          name: 'Primary Income',
          description: 'Main income sources',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          incomeSources: [{ id: 'source-1' }, { id: 'source-2' }],
          expenseCategories: [],
        },
        {
          id: 'group-2',
          userId: 'user-1',
          scope: 'EXPENSE',
          name: 'Recurring Expenses',
          description: null,
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
          incomeSources: [],
          expenseCategories: [{ id: 'cat-1' }, { id: 'cat-2' }, { id: 'cat-3' }],
        },
      ]);

      const result = await listCategoryGroups({
        prisma: mockPrisma,
        userId: 'user-1',
      });

      expect(mockCategoryGroupFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          expenseCategories: true,
          incomeSources: true,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'group-1',
        userId: 'user-1',
        scope: 'INCOME',
        name: 'Primary Income',
        description: 'Main income sources',
        memberCount: 2,
      });
      expect(result[0]!.createdAt).toBe('2024-01-01T00:00:00.000Z');

      expect(result[1]).toMatchObject({
        id: 'group-2',
        userId: 'user-1',
        scope: 'EXPENSE',
        name: 'Recurring Expenses',
        memberCount: 3,
      });
    });

    it('returns empty array when no groups exist for user', async () => {
      mockCategoryGroupFindMany.mockResolvedValue([]);

      const result = await listCategoryGroups({
        prisma: mockPrisma,
        userId: 'user-1',
      });

      expect(result).toHaveLength(0);
    });
  });
});
