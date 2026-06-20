import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCategoryGroup,
  deleteCategoryGroup,
  listCategoryGroups,
  updateCategoryGroup,
} from '@/server/services/category-groups/category-groups.service';

const mockCategoryGroupCreate = vi.fn();
const mockCategoryGroupFindMany = vi.fn();
const mockCategoryGroupFindFirst = vi.fn();
const mockCategoryGroupFindUnique = vi.fn();
const mockCategoryGroupUpdate = vi.fn();
const mockCategoryGroupDelete = vi.fn();

const mockCategoryGroupIncomSourceDeleteMany = vi.fn();
const mockCategoryGroupIncomSourceCreateMany = vi.fn();

const mockCategoryGroupExpenseCategoryDeleteMany = vi.fn();
const mockCategoryGroupExpenseCategoryCreateMany = vi.fn();

const mockPrisma = {
  categoryGroup: {
    create: mockCategoryGroupCreate,
    findMany: mockCategoryGroupFindMany,
    findFirst: mockCategoryGroupFindFirst,
    findUnique: mockCategoryGroupFindUnique,
    update: mockCategoryGroupUpdate,
    delete: mockCategoryGroupDelete,
  },
  categoryGroupIncomeSource: {
    deleteMany: mockCategoryGroupIncomSourceDeleteMany,
    createMany: mockCategoryGroupIncomSourceCreateMany,
  },
  categoryGroupExpenseCategory: {
    deleteMany: mockCategoryGroupExpenseCategoryDeleteMany,
    createMany: mockCategoryGroupExpenseCategoryCreateMany,
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
          incomeSources: [
            { incomeSourceId: 'source-1' },
            { incomeSourceId: 'source-2' },
          ],
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
          expenseCategories: [
            { expenseCategoryId: 'cat-1' },
            { expenseCategoryId: 'cat-2' },
            { expenseCategoryId: 'cat-3' },
          ],
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
        memberIds: ['source-1', 'source-2'],
      });
      expect(result[0]!.createdAt).toBe('2024-01-01T00:00:00.000Z');

      expect(result[1]).toMatchObject({
        id: 'group-2',
        userId: 'user-1',
        scope: 'EXPENSE',
        name: 'Recurring Expenses',
        memberCount: 3,
        memberIds: ['cat-1', 'cat-2', 'cat-3'],
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

  describe('createCategoryGroup', () => {
    it('creates income category group with members', async () => {
      mockCategoryGroupFindFirst.mockResolvedValue(null);
      mockCategoryGroupCreate.mockResolvedValue({
        id: 'group-1',
        userId: 'user-1',
        scope: 'INCOME',
        name: 'Primary Income',
        description: 'Main income',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        incomeSources: [
          { incomeSourceId: 'source-1' },
          { incomeSourceId: 'source-2' },
        ],
        expenseCategories: [],
      });

      const result = await createCategoryGroup({
        prisma: mockPrisma,
        userId: 'user-1',
        scope: 'INCOME',
        name: 'Primary Income',
        description: 'Main income',
        memberIds: ['source-1', 'source-2'],
      });

      expect(result.id).toBe('group-1');
      expect(result.scope).toBe('INCOME');
      expect(result.name).toBe('Primary Income');
      expect(result.memberCount).toBe(2);
      expect(result.memberIds).toEqual(['source-1', 'source-2']);
    });

    it('creates expense category group with members', async () => {
      mockCategoryGroupFindFirst.mockResolvedValue(null);
      mockCategoryGroupCreate.mockResolvedValue({
        id: 'group-2',
        userId: 'user-1',
        scope: 'EXPENSE',
        name: 'Recurring Expenses',
        description: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        incomeSources: [],
        expenseCategories: [
          { expenseCategoryId: 'cat-1' },
          { expenseCategoryId: 'cat-2' },
        ],
      });

      const result = await createCategoryGroup({
        prisma: mockPrisma,
        userId: 'user-1',
        scope: 'EXPENSE',
        name: 'Recurring Expenses',
        memberIds: ['cat-1', 'cat-2'],
      });

      expect(result.scope).toBe('EXPENSE');
      expect(result.memberCount).toBe(2);
      expect(result.memberIds).toEqual(['cat-1', 'cat-2']);
    });

    it('rejects duplicate group names within same scope', async () => {
      mockCategoryGroupFindFirst.mockResolvedValue({
        id: 'existing-group',
      });

      await expect(
        createCategoryGroup({
          prisma: mockPrisma,
          userId: 'user-1',
          scope: 'INCOME',
          name: 'Primary Income',
          memberIds: ['source-1'],
        }),
      ).rejects.toThrow(
        'Category group "Primary Income" already exists for income scope',
      );
    });
  });

  describe('updateCategoryGroup', () => {
    it('updates income group name and members', async () => {
      mockCategoryGroupFindUnique.mockResolvedValueOnce({
        id: 'group-1',
        userId: 'user-1',
        scope: 'INCOME',
        name: 'Primary Income',
      });

      mockCategoryGroupFindFirst.mockResolvedValue(null);

      mockCategoryGroupIncomSourceDeleteMany.mockResolvedValue({});
      mockCategoryGroupIncomSourceCreateMany.mockResolvedValue({});

      mockCategoryGroupUpdate.mockResolvedValue({
        id: 'group-1',
        userId: 'user-1',
        scope: 'INCOME',
        name: 'Updated Income',
        description: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        incomeSources: [
          { incomeSourceId: 'source-1' },
          { incomeSourceId: 'source-3' },
        ],
        expenseCategories: [],
      });

      const result = await updateCategoryGroup({
        prisma: mockPrisma,
        userId: 'user-1',
        groupId: 'group-1',
        name: 'Updated Income',
        memberIds: ['source-1', 'source-3'],
      });

      expect(result.name).toBe('Updated Income');
      expect(result.memberIds).toEqual(['source-1', 'source-3']);
    });

    it('throws error when group not found', async () => {
      mockCategoryGroupFindUnique.mockResolvedValue(null);

      await expect(
        updateCategoryGroup({
          prisma: mockPrisma,
          userId: 'user-1',
          groupId: 'non-existent',
          name: 'Test',
        }),
      ).rejects.toThrow('Category group not found');
    });

    it('throws error when unauthorized to update', async () => {
      mockCategoryGroupFindUnique.mockResolvedValue({
        id: 'group-1',
        userId: 'different-user',
        scope: 'INCOME',
      });

      await expect(
        updateCategoryGroup({
          prisma: mockPrisma,
          userId: 'user-1',
          groupId: 'group-1',
          name: 'Test',
        }),
      ).rejects.toThrow('Unauthorized: You do not own this category group');
    });
  });

  describe('deleteCategoryGroup', () => {
    it('deletes category group successfully', async () => {
      mockCategoryGroupFindUnique.mockResolvedValue({
        id: 'group-1',
        userId: 'user-1',
        scope: 'INCOME',
      });

      mockCategoryGroupDelete.mockResolvedValue({});

      await deleteCategoryGroup({
        prisma: mockPrisma,
        userId: 'user-1',
        groupId: 'group-1',
      });

      expect(mockCategoryGroupDelete).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
    });

    it('throws error when group not found', async () => {
      mockCategoryGroupFindUnique.mockResolvedValue(null);

      await expect(
        deleteCategoryGroup({
          prisma: mockPrisma,
          userId: 'user-1',
          groupId: 'non-existent',
        }),
      ).rejects.toThrow('Category group not found');
    });

    it('throws error when unauthorized to delete', async () => {
      mockCategoryGroupFindUnique.mockResolvedValue({
        id: 'group-1',
        userId: 'different-user',
        scope: 'INCOME',
      });

      await expect(
        deleteCategoryGroup({
          prisma: mockPrisma,
          userId: 'user-1',
          groupId: 'group-1',
        }),
      ).rejects.toThrow('Unauthorized: You do not own this category group');
    });
  });
});
