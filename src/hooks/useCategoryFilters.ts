'use client';

import { useCallback, useRef, useState } from 'react';

import { type CategoryGroup } from '@/lib/mockFilterData';

/**
 * State for a checkbox representing tri-state:
 * - checked: true = all items selected, false = none/some selected
 * - indeterminate: true = some (but not all) items selected
 */
export type CheckboxState = {
  checked: boolean;
  indeterminate: boolean;
};

/**
 * useCategoryFilters Hook
 *
 * Manages client-side category selection state for filtering aggregations.
 * Supports tri-state checkboxes for groups and individual categories.
 *
 * Features:
 * - Build initial selection from category groups
 * - Toggle individual categories
 * - Toggle all categories in a group
 * - Clear all selections
 * - Get active (selected) category IDs
 * - Compute tri-state indicators for groups
 *
 * @example
 * const filters = useCategoryFilters();
 * filters.buildInitialSelection(mockGroups);
 * filters.toggleCategory('c-rent');
 * const active = filters.getActiveFilters(); // ['c-rent']
 */
export function useCategoryFilters() {
  // Maps category ID -> selected state (true = selected)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  // Use ref to store groups to avoid stale closure issues in useCallback
  // (ensures toggleGroup always uses the latest groups)
  const groupsRef = useRef<CategoryGroup[]>([]);

  /**
   * Initialize the filter state based on provided category groups.
   * Resets all selections to unchecked.
   */
  const buildInitialSelection = useCallback((categoryGroups: CategoryGroup[]) => {
    groupsRef.current = categoryGroups;
    setSelectedCategories(new Set());
  }, []);

  /**
   * Toggle a single category by ID.
   * If the category is currently selected, unselect it.
   * If unselected, select it.
   */
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle all categories in a group.
   * @param groupId - The group ID to toggle
   * @param checked - true = select all, false = deselect all
   */
  const toggleGroup = useCallback((groupId: string, checked: boolean) => {
    const group = groupsRef.current.find((g) => g.id === groupId);
    if (!group) return;

    setSelectedCategories((prev) => {
      const next = new Set(prev);
      group.categories.forEach((cat) => {
        if (checked) {
          next.add(cat.id);
        } else {
          next.delete(cat.id);
        }
      });
      return next;
    });
  }, []);

  /**
   * Clear all selected categories.
   */
  const clearSelection = useCallback(() => {
    setSelectedCategories(new Set());
  }, []);

  /**
   * Get the list of currently selected category IDs.
   */
  const getActiveFilters = useCallback((): string[] => {
    return Array.from(selectedCategories);
  }, [selectedCategories]);

  /**
   * Get the checkbox state (checked/indeterminate) for a group.
   *
   * Tri-state logic:
   * - All categories selected → checked=true, indeterminate=false
   * - No categories selected → checked=false, indeterminate=false
   * - Some categories selected → checked=false, indeterminate=true
   *
   * @param groupId - The group ID to check state for
   * @returns CheckboxState with checked and indeterminate flags
   */
  const getGroupState = useCallback(
    (groupId: string): CheckboxState => {
      const group = groupsRef.current.find((g) => g.id === groupId);
      if (!group || group.categories.length === 0) {
        return { checked: false, indeterminate: false };
      }

      const checkedCount = group.categories.filter((cat) => selectedCategories.has(cat.id))
        .length;
      const total = group.categories.length;

      if (checkedCount === 0) {
        return { checked: false, indeterminate: false };
      }

      if (checkedCount === total) {
        return { checked: true, indeterminate: false };
      }

      // Some but not all are checked
      return { checked: false, indeterminate: true };
    },
    [selectedCategories]
  );

  return {
    buildInitialSelection,
    toggleCategory,
    toggleGroup,
    clearSelection,
    getActiveFilters,
    getGroupState,
  };
}
