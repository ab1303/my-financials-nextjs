import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useCategoryFilters } from '@/hooks/useCategoryFilters';
import mockGroups, { type CategoryGroup } from '@/lib/mockFilterData';

describe('useCategoryFilters', () => {
  describe('buildInitialSelection', () => {
    it('should create initial selection state with all categories unchecked', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
    });

    it('should handle empty groups array', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection([]);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
    });

    it('should handle custom groups with different structures', () => {
      const customGroups: CategoryGroup[] = [
        {
          id: 'g-test',
          name: 'Test',
          categories: [
            { id: 'c-test-1', name: 'Test 1', type: 'expense', amount: 100 },
            { id: 'c-test-2', name: 'Test 2', type: 'income', amount: 200 },
          ],
        },
      ];

      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(customGroups);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
    });
  });

  describe('toggleCategory', () => {
    beforeEach(() => {
      // Reset before each test
    });

    it('should toggle a single category from unchecked to checked', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toContain('c-rent');
      expect(activeFilters.length).toBe(1);
    });

    it('should toggle a category back to unchecked', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
        result.current.toggleCategory('c-rent');
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).not.toContain('c-rent');
    });

    it('should toggle multiple categories independently', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
        result.current.toggleCategory('c-groceries');
        result.current.toggleCategory('c-salary');
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toContain('c-rent');
      expect(activeFilters).toContain('c-groceries');
      expect(activeFilters).toContain('c-salary');
      expect(activeFilters.length).toBe(3);
    });

    it('should not fail when toggling non-existent category', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-nonexistent');
      });

      // Should not throw and getActiveFilters should work
      const activeFilters = result.current.getActiveFilters();
      expect(Array.isArray(activeFilters)).toBe(true);
    });
  });

  describe('toggleGroup', () => {
    it('should check all categories in a group when toggling group to true', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toContain('c-rent');
      expect(activeFilters).toContain('c-groceries');
      expect(activeFilters.length).toBe(2);
    });

    it('should uncheck all categories in a group when toggling group to false', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
        result.current.toggleGroup('g-essentials', false);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).not.toContain('c-rent');
      expect(activeFilters).not.toContain('c-groceries');
    });

    it('should handle group with single category', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-income', true);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toContain('c-salary');
      expect(activeFilters.length).toBe(1);
    });

    it('should not affect other groups when toggling one group', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
        result.current.toggleGroup('g-income', true);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toContain('c-rent');
      expect(activeFilters).toContain('c-groceries');
      expect(activeFilters).toContain('c-salary');
      expect(activeFilters.length).toBe(3);
    });

    it('should handle non-existent group gracefully', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-nonexistent', true);
      });

      // Should not throw
      const activeFilters = result.current.getActiveFilters();
      expect(Array.isArray(activeFilters)).toBe(true);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selected categories', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
        result.current.toggleCategory('c-groceries');
        result.current.toggleCategory('c-salary');
        result.current.clearSelection();
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
    });

    it('should clear selection when nothing is selected', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.clearSelection();
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
    });

    it('should allow re-selecting after clearing', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
        result.current.clearSelection();
        result.current.toggleCategory('c-salary');
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual(['c-salary']);
    });
  });

  describe('getActiveFilters', () => {
    it('should return empty array when no categories selected', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
      expect(Array.isArray(activeFilters)).toBe(true);
    });

    it('should return selected category IDs', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
        result.current.toggleCategory('c-salary');
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual(
        expect.arrayContaining(['c-rent', 'c-salary']),
      );
      expect(activeFilters.length).toBe(2);
    });

    it('should return IDs in consistent order', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-salary');
        result.current.toggleCategory('c-rent');
      });

      const activeFilters1 = result.current.getActiveFilters();

      act(() => {
        result.current.clearSelection();
        result.current.toggleCategory('c-rent');
        result.current.toggleCategory('c-salary');
      });

      const activeFilters2 = result.current.getActiveFilters();
      expect(activeFilters1).toEqual(expect.arrayContaining(activeFilters2));
    });
  });

  describe('tri-state indicator', () => {
    it('should indicate no categories selected for a group', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
      });

      const state = result.current.getGroupState('g-essentials');
      expect(state.checked).toBe(false);
      expect(state.indeterminate).toBe(false);
    });

    it('should indicate all categories selected for a group', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
      });

      const state = result.current.getGroupState('g-essentials');
      expect(state.checked).toBe(true);
      expect(state.indeterminate).toBe(false);
    });

    it('should indicate indeterminate state when some categories are selected', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-rent');
      });

      const state = result.current.getGroupState('g-essentials');
      expect(state.checked).toBe(false);
      expect(state.indeterminate).toBe(true);
    });

    it('should properly compute group state for single-category groups', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleCategory('c-salary');
      });

      const state = result.current.getGroupState('g-income');
      expect(state.checked).toBe(true);
      expect(state.indeterminate).toBe(false);
    });

    it('should update group state when categories are toggled', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
      });

      let state = result.current.getGroupState('g-essentials');
      expect(state.checked).toBe(false);
      expect(state.indeterminate).toBe(false);

      act(() => {
        result.current.toggleCategory('c-rent');
      });

      state = result.current.getGroupState('g-essentials');
      expect(state.indeterminate).toBe(true);

      act(() => {
        result.current.toggleCategory('c-groceries');
      });

      state = result.current.getGroupState('g-essentials');
      expect(state.checked).toBe(true);
      expect(state.indeterminate).toBe(false);
    });

    it('should return correct state for non-existent group', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
      });

      const state = result.current.getGroupState('g-nonexistent');
      expect(state.checked).toBe(false);
      expect(state.indeterminate).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex workflow: toggle group, then individual category, then clear', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
      });

      let activeFilters = result.current.getActiveFilters();
      expect(activeFilters.length).toBe(2);

      act(() => {
        result.current.toggleCategory('c-rent');
      });

      activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual(['c-groceries']);

      act(() => {
        result.current.clearSelection();
      });

      activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toEqual([]);
    });

    it('should maintain state across multiple operations', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
        result.current.toggleGroup('g-invest', true);
        result.current.toggleCategory('c-invest');
      });

      const activeFilters = result.current.getActiveFilters();
      expect(activeFilters).toContain('c-rent');
      expect(activeFilters).toContain('c-groceries');
      expect(activeFilters).toContain('c-transfer');
      expect(activeFilters).not.toContain('c-invest');
      expect(activeFilters.length).toBe(3);
    });

    it('should correctly compute all group states', () => {
      const { result } = renderHook(() => useCategoryFilters());

      act(() => {
        result.current.buildInitialSelection(mockGroups);
        result.current.toggleGroup('g-essentials', true);
      });

      const essentialsState = result.current.getGroupState('g-essentials');
      const investState = result.current.getGroupState('g-invest');
      const incomeState = result.current.getGroupState('g-income');

      expect(essentialsState.checked).toBe(true);
      expect(essentialsState.indeterminate).toBe(false);
      expect(investState.checked).toBe(false);
      expect(investState.indeterminate).toBe(false);
      expect(incomeState.checked).toBe(false);
      expect(incomeState.indeterminate).toBe(false);
    });
  });
});
