import type { CategoryGroupScope, PrismaClient } from '@prisma/client';

export interface CategoryGroupListItem {
  id: string;
  userId: string;
  scope: CategoryGroupScope;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
}

/**
 * List all category groups for a user, grouped by scope
 * Includes member count for each group
 */
export async function listCategoryGroups(params: {
  prisma: PrismaClient;
  userId: string;
}): Promise<CategoryGroupListItem[]> {
  const { prisma, userId } = params;

  const groups = await prisma.categoryGroup.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      expenseCategories: true,
      incomeSources: true,
    },
  });

  return groups.map((group) => ({
    id: group.id,
    userId: group.userId,
    scope: group.scope,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    memberCount:
      group.scope === 'INCOME'
        ? group.incomeSources.length
        : group.expenseCategories.length,
  }));
}

/**
 * Create a new category group for a user
 * Ownership is enforced by userId
 */
export async function createCategoryGroup(params: {
  prisma: PrismaClient;
  userId: string;
  scope: CategoryGroupScope;
  name: string;
  description?: string | null;
  memberIds: string[];
}): Promise<CategoryGroupListItem> {
  const { prisma, userId, scope, name, description, memberIds } = params;

  // Check for duplicate name within user's scope
  const existing = await prisma.categoryGroup.findFirst({
    where: {
      userId,
      scope,
      name,
    },
  });

  if (existing) {
    throw new Error(
      `Category group "${name}" already exists for ${scope.toLowerCase()} scope`,
    );
  }

  const groupData =
    scope === 'INCOME'
      ? {
          incomeSources: {
            create: memberIds.map((id) => ({
              incomeSourceId: id,
            })),
          },
        }
      : {
          expenseCategories: {
            create: memberIds.map((id) => ({
              expenseCategoryId: id,
            })),
          },
        };

  const group = await prisma.categoryGroup.create({
    data: {
      userId,
      scope,
      name,
      description: description || null,
      ...groupData,
    },
    include: {
      expenseCategories: true,
      incomeSources: true,
    },
  });

  return {
    id: group.id,
    userId: group.userId,
    scope: group.scope,
    name: group.name,
    description: group.description,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    memberCount:
      group.scope === 'INCOME'
        ? group.incomeSources.length
        : group.expenseCategories.length,
  };
}

/**
 * Update an existing category group
 * Ownership is enforced
 */
export async function updateCategoryGroup(params: {
  prisma: PrismaClient;
  userId: string;
  groupId: string;
  name?: string;
  description?: string | null;
  memberIds?: string[];
}): Promise<CategoryGroupListItem> {
  const { prisma, userId, groupId, name, description, memberIds } = params;

  // Verify ownership
  const group = await prisma.categoryGroup.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new Error('Category group not found');
  }

  if (group.userId !== userId) {
    throw new Error('Unauthorized: You do not own this category group');
  }

  // Check for duplicate name if changing name
  if (name && name !== group.name) {
    const duplicate = await prisma.categoryGroup.findFirst({
      where: {
        userId,
        scope: group.scope,
        name,
        NOT: { id: groupId },
      },
    });

    if (duplicate) {
      throw new Error(
        `Category group "${name}" already exists for this scope`,
      );
    }
  }

  // Update member connections if provided
  if (memberIds !== undefined) {
    if (group.scope === 'INCOME') {
      // Delete all existing income source connections
      await prisma.categoryGroupIncomeSource.deleteMany({
        where: { categoryGroupId: groupId },
      });

      // Create new connections
      await prisma.categoryGroupIncomeSource.createMany({
        data: memberIds.map((id) => ({
          categoryGroupId: groupId,
          incomeSourceId: id,
        })),
      });
    } else {
      // Delete all existing expense category connections
      await prisma.categoryGroupExpenseCategory.deleteMany({
        where: { categoryGroupId: groupId },
      });

      // Create new connections
      await prisma.categoryGroupExpenseCategory.createMany({
        data: memberIds.map((id) => ({
          categoryGroupId: groupId,
          expenseCategoryId: id,
        })),
      });
    }
  }

  // Update group metadata
  const updated = await prisma.categoryGroup.update({
    where: { id: groupId },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
    },
    include: {
      expenseCategories: true,
      incomeSources: true,
    },
  });

  return {
    id: updated.id,
    userId: updated.userId,
    scope: updated.scope,
    name: updated.name,
    description: updated.description,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    memberCount:
      updated.scope === 'INCOME'
        ? updated.incomeSources.length
        : updated.expenseCategories.length,
  };
}

/**
 * Delete a category group
 * Ownership is enforced
 */
export async function deleteCategoryGroup(params: {
  prisma: PrismaClient;
  userId: string;
  groupId: string;
}): Promise<void> {
  const { prisma, userId, groupId } = params;

  // Verify ownership
  const group = await prisma.categoryGroup.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new Error('Category group not found');
  }

  if (group.userId !== userId) {
    throw new Error('Unauthorized: You do not own this category group');
  }

  await prisma.categoryGroup.delete({
    where: { id: groupId },
  });
}
