import type { CategoryBreakdown, ExpenseEntryWithCategory } from '@/server/models/expense';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';

export type GroupedBreakdown = {
  groupId: string | null;
  groupName: string;
  totalAmount: number;
  percentage: number;
  categories: CategoryBreakdown[];
};

export type GroupedEntry = {
  groupId: string | null;
  groupName: string;
  totalAmount: number;
  entries: ExpenseEntryWithCategory[];
};

/**
 * Merge a flat CategoryBreakdown[] into GroupedBreakdown[] using the user's category groups.
 * Categories not in any group are collected into a trailing "Ungrouped" bucket.
 * If selectedCategoryIds is provided, only those categories are included.
 */
export function groupExpenseBreakdown(
  breakdown: CategoryBreakdown[],
  groups: CategoryGroupListItem[],
  selectedCategoryIds?: Set<string>,
): GroupedBreakdown[] {
  const filtered = selectedCategoryIds
    ? breakdown.filter((b) => selectedCategoryIds.has(b.categoryId))
    : breakdown;

  const total = filtered.reduce((sum, b) => sum + b.amount, 0);
  const groupedIds = new Set<string>();

  const result: GroupedBreakdown[] = groups
    .map((group) => {
      const cats = filtered.filter((b) => group.memberIds.includes(b.categoryId));
      cats.forEach((c) => groupedIds.add(c.categoryId));
      const groupTotal = cats.reduce((sum, c) => sum + c.amount, 0);
      return {
        groupId: group.id,
        groupName: group.name,
        totalAmount: groupTotal,
        percentage: total > 0 ? (groupTotal / total) * 100 : 0,
        categories: cats,
      };
    })
    .filter((g) => g.categories.length > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const ungrouped = filtered.filter((b) => !groupedIds.has(b.categoryId));
  if (ungrouped.length > 0) {
    const ungroupedTotal = ungrouped.reduce((sum, c) => sum + c.amount, 0);
    result.push({
      groupId: null,
      groupName: 'Ungrouped',
      totalAmount: ungroupedTotal,
      percentage: total > 0 ? (ungroupedTotal / total) * 100 : 0,
      categories: ungrouped,
    });
  }

  return result;
}

/**
 * Merge a flat ExpenseEntryWithCategory[] into GroupedEntry[] using the user's category groups.
 */
export function groupExpenseEntries(
  entries: ExpenseEntryWithCategory[],
  groups: CategoryGroupListItem[],
): GroupedEntry[] {
  const groupedIds = new Set<string>();

  const result: GroupedEntry[] = groups
    .map((group) => {
      const groupEntries = entries.filter((e) => group.memberIds.includes(e.categoryId));
      groupEntries.forEach((e) => groupedIds.add(e.categoryId));
      const groupTotal = groupEntries.reduce((sum, e) => sum + e.amount, 0);
      return {
        groupId: group.id,
        groupName: group.name,
        totalAmount: groupTotal,
        entries: groupEntries,
      };
    })
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const ungrouped = entries.filter((e) => !groupedIds.has(e.categoryId));
  if (ungrouped.length > 0) {
    result.push({
      groupId: null,
      groupName: 'Ungrouped',
      totalAmount: ungrouped.reduce((sum, e) => sum + e.amount, 0),
      entries: ungrouped,
    });
  }

  return result;
}
