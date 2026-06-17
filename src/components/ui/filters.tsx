'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useCategoryFilters } from '@/hooks/useCategoryFilters';
import mockGroups, { type Category as MockCategory, type CategoryGroup } from '@/lib/mockFilterData';

/**
 * PreviewTotals component - memoized computation of income, expense, net
 * Recomputes only when groups or selection changes
 */
export function PreviewTotals({
  groups,
  selectedCategories,
}: {
  groups: CategoryGroup[];
  selectedCategories: Set<string>;
}) {
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    groups.forEach((g) =>
      g.categories.forEach((c) => {
        if (!selectedCategories.has(c.id)) return;
        if (c.type === 'income') income += c.amount;
        else if (c.type === 'expense') expense += c.amount;
      })
    );
    return { income, expense, net: income - expense };
  }, [groups, selectedCategories]);

  return (
    <div className="p-4 bg-white dark:bg-slate-800 rounded-md shadow-sm w-full">
      <div className="text-sm text-slate-500">Preview Totals</div>
      <div className="mt-2 flex gap-4 items-baseline">
        <div>
          <div className="text-xs text-slate-400">Income</div>
          <div className="text-lg font-semibold">${totals.income}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Expenses</div>
          <div className="text-lg font-semibold">${totals.expense}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Net</div>
          <div className="text-lg font-semibold">${totals.net}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * CategoryItem - individual category checkbox with label and amount
 */
function CategoryItem({
  category,
  checked,
  onToggle,
}: {
  category: MockCategory;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(category.id)}
        className="h-4 w-4 cursor-pointer"
        aria-label={category.name}
      />
      <span
        className={`w-2 h-2 rounded-full ${category.color ?? 'bg-gray-300'}`}
        aria-hidden
      />
      <span className="flex-1 text-sm">{category.name}</span>
      <span className="text-xs text-slate-400">${category.amount}</span>
    </label>
  );
}

/**
 * GroupRow - group header with tri-state checkbox and nested categories
 */
function GroupRow({
  group,
  selectedCategories,
  toggleCategory,
  toggleGroup,
  groupState,
}: {
  group: CategoryGroup;
  selectedCategories: Set<string>;
  toggleCategory: (id: string) => void;
  toggleGroup: (groupId: string, checked: boolean) => void;
  groupState: { checked: boolean; indeterminate: boolean };
}) {
  const total = group.categories.length;
  const checkedCount = group.categories.filter((c) => selectedCategories.has(c.id))
    .length;
  const ref = useRef<HTMLInputElement | null>(null);

  // Update indeterminate property on DOM element
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = groupState.indeterminate;
    }
  }, [groupState.indeterminate]);

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <input
            ref={ref}
            type="checkbox"
            checked={groupState.checked}
            onChange={() => toggleGroup(group.id, !groupState.checked)}
            className="h-4 w-4 cursor-pointer"
            aria-checked={groupState.indeterminate ? 'mixed' : groupState.checked}
            aria-label={`${group.name} group`}
          />
          <div className="font-medium">{group.name}</div>
        </div>
        <div className="text-sm text-slate-400">
          {checkedCount}/{total}
        </div>
      </div>
      <div className="pl-8 pr-3 pb-3">
        {group.categories.map((c) => (
          <CategoryItem
            key={c.id}
            category={c}
            checked={selectedCategories.has(c.id)}
            onToggle={toggleCategory}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * FiltersPanel - main component for category filtering
 *
 * Features:
 * - Tri-state group checkboxes
 * - Individual category checkboxes
 * - Live preview totals
 * - Clear filters button
 * - Save View button (placeholder)
 * - Keyboard accessible with aria-checked for tri-state
 * - Uses useCategoryFilters hook for state management
 */
export function FiltersPanel({
  initialGroups = mockGroups,
  defaultSelectAll = false,
  onSelectionChange,
}: {
  initialGroups?: CategoryGroup[];
  defaultSelectAll?: boolean;
  onSelectionChange?: (selectedCategoryIds: string[]) => void;
}) {
  const {
    buildInitialSelection,
    clearSelection,
    getActiveFilters,
    getGroupState,
    toggleCategory,
    toggleGroup,
  } = useCategoryFilters();

  // Initialize groups and selection on mount
  useEffect(() => {
    buildInitialSelection(initialGroups);
    if (defaultSelectAll) {
      for (const group of initialGroups) {
        toggleGroup(group.id, true);
      }
    }
  }, [buildInitialSelection, defaultSelectAll, initialGroups, toggleGroup]);

  // Get selected categories (for preview totals and rendering)
  const activeFilterIds = useMemo(() => getActiveFilters(), [getActiveFilters]);
  const selectedCategories = new Set(activeFilterIds);

  useEffect(() => {
    onSelectionChange?.(activeFilterIds);
  }, [activeFilterIds, onSelectionChange]);

  return (
    <div className="flex gap-6">
      <aside className="w-80 bg-slate-50 dark:bg-slate-900 p-4 rounded shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Category Groups</h3>
          <button className="text-sm text-sky-600 hover:text-sky-700">
            Save View
          </button>
        </div>
        <div className="space-y-2 overflow-auto max-h-[60vh]">
          {initialGroups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              selectedCategories={selectedCategories}
              toggleCategory={toggleCategory}
              toggleGroup={toggleGroup}
              groupState={getGroupState(g.id)}
            />
          ))}
        </div>
        <div className="mt-4">
          <button
            onClick={clearSelection}
            className="text-sm text-slate-600 hover:text-slate-700"
          >
            Clear filters
          </button>
        </div>
      </aside>

      <main className="flex-1">
        <div className="max-w-md">
          <PreviewTotals groups={initialGroups} selectedCategories={selectedCategories} />
        </div>
      </main>
    </div>
  );
}

export default FiltersPanel;
