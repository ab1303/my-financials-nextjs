'use client'

import React, { useMemo, useState, useRef, useEffect } from 'react';
import mockGroups, { Category as MockCategory, CategoryGroup } from '../../lib/mockFilterData';

type SelectionMap = Record<string, boolean>;

function buildInitialSelection(groups: CategoryGroup[]): SelectionMap {
  const sel: SelectionMap = {};
  groups.forEach(g => g.categories.forEach(c => (sel[c.id] = true)));
  return sel;
}

export function PreviewTotals({ groups, selection }: { groups: CategoryGroup[]; selection: SelectionMap }) {
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    groups.forEach(g =>
      g.categories.forEach(c => {
        if (!selection[c.id]) return;
        if (c.type === 'income') income += c.amount;
        else if (c.type === 'expense') expense += c.amount;
      })
    );
    return { income, expense, net: income - expense };
  }, [groups, selection]);

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

function CategoryItem({ category, checked, onToggle }: { category: MockCategory; checked: boolean; onToggle: (id: string) => void }) {
  return (
    <label className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(category.id)}
        className="form-checkbox h-4 w-4"
      />
      <span className={`w-2 h-2 rounded-full ${category.color ?? 'bg-gray-300'}`} aria-hidden />
      <span className="flex-1 text-sm">{category.name}</span>
      <span className="text-xs text-slate-400">${category.amount}</span>
    </label>
  );
}

function GroupRow({
  group,
  selection,
  toggleCategory,
  toggleGroup,
}: {
  group: CategoryGroup;
  selection: SelectionMap;
  toggleCategory: (id: string) => void;
  toggleGroup: (groupId: string, checked: boolean) => void;
}) {
  const total = group.categories.length;
  const checkedCount = group.categories.filter(c => selection[c.id]).length;
  const indeterminate = checkedCount > 0 && checkedCount < total;
  const allChecked = checkedCount === total;
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <input
            ref={ref}
            type="checkbox"
            checked={allChecked}
            onChange={() => toggleGroup(group.id, !allChecked)}
            className="form-checkbox h-4 w-4"
            aria-checked={indeterminate ? 'mixed' : allChecked}
          />
          <div className="font-medium">{group.name}</div>
        </div>
        <div className="text-sm text-slate-400">{checkedCount}/{total}</div>
      </div>
      <div className="pl-8 pr-3 pb-3">
        {group.categories.map(c => (
          <CategoryItem key={c.id} category={c} checked={!!selection[c.id]} onToggle={toggleCategory} />
        ))}
      </div>
    </div>
  );
}

export function FiltersPanel({ initialGroups = mockGroups }: { initialGroups?: CategoryGroup[] }) {
  const [groups] = useState<CategoryGroup[]>(initialGroups);
  const [selection, setSelection] = useState<SelectionMap>(() => buildInitialSelection(groups));

  function toggleCategory(id: string) {
    setSelection(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleGroup(groupId: string, checked: boolean) {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setSelection(prev => {
      const copy = { ...prev };
      group.categories.forEach(c => (copy[c.id] = checked));
      return copy;
    });
  }

  function clearFilters() {
    setSelection(buildInitialSelection(groups));
  }

  return (
    <div className="flex gap-6">
      <aside className="w-80 bg-slate-50 dark:bg-slate-900 p-4 rounded shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Category Groups</h3>
          <button className="text-sm text-sky-600">Save View</button>
        </div>
        <div className="space-y-2 overflow-auto max-h-[60vh]">
          {groups.map(g => (
            <GroupRow key={g.id} group={g} selection={selection} toggleCategory={toggleCategory} toggleGroup={toggleGroup} />
          ))}
        </div>
        <div className="mt-4">
          <button onClick={clearFilters} className="text-sm text-slate-600">Clear filters</button>
        </div>
      </aside>

      <main className="flex-1">
        <div className="mb-4">
          {/* Active filter chips */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(selection)
              .filter(([, v]) => !v)
              .map(([id]) => (
                <div key={id} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-sm">{id}</div>
              ))}
          </div>
        </div>

        <div className="max-w-md">
          <PreviewTotals groups={groups} selection={selection} />
        </div>
      </main>
    </div>
  );
}

export default FiltersPanel;
