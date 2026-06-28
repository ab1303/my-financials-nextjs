'use client';

import { useEffect, useRef } from 'react';
import { NumericFormat } from 'react-number-format';

import type { GroupedBreakdown } from '@/lib/category-group-utils';

type Props = {
  group: GroupedBreakdown;
  selectedCategoryIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onClose: () => void;
};

export function GroupCategoryPopover({
  group,
  selectedCategoryIds,
  onSelectionChange,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const allSelected = group.categories.every((c) => selectedCategoryIds.has(c.categoryId));
  const noneSelected = group.categories.every((c) => !selectedCategoryIds.has(c.categoryId));

  function toggleCategory(categoryId: string) {
    const next = new Set(selectedCategoryIds);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    onSelectionChange(next);
  }

  function selectAll() {
    const next = new Set(selectedCategoryIds);
    group.categories.forEach((c) => next.add(c.categoryId));
    onSelectionChange(next);
  }

  function clearAll() {
    const next = new Set(selectedCategoryIds);
    group.categories.forEach((c) => next.delete(c.categoryId));
    onSelectionChange(next);
  }

  return (
    <div
      ref={ref}
      className='absolute z-50 mt-1 min-w-[220px] rounded-lg border border-border bg-card shadow-lg'
      role='dialog'
      aria-label={`Filter categories in ${group.groupName}`}
    >
      <div className='flex items-center justify-between border-b border-border px-3 py-2'>
        <span className='text-xs font-semibold text-foreground'>{group.groupName}</span>
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={selectAll}
            disabled={allSelected}
            className='text-[11px] font-medium text-primary disabled:opacity-40 hover:underline'
          >
            All
          </button>
          <span className='text-muted-foreground'>·</span>
          <button
            type='button'
            onClick={clearAll}
            disabled={noneSelected}
            className='text-[11px] font-medium text-primary disabled:opacity-40 hover:underline'
          >
            None
          </button>
        </div>
      </div>
      <ul className='max-h-48 overflow-y-auto py-1'>
        {group.categories.map((cat) => {
          const checked = selectedCategoryIds.has(cat.categoryId);
          return (
            <li key={cat.categoryId}>
              <label className='flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors'>
                <input
                  type='checkbox'
                  checked={checked}
                  onChange={() => toggleCategory(cat.categoryId)}
                  className='accent-primary h-3.5 w-3.5 flex-shrink-0'
                />
                <span className={`flex-1 truncate ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {cat.categoryName}
                </span>
                <span className='text-xs tabular-nums text-muted-foreground'>
                  <NumericFormat
                    value={cat.amount}
                    displayType='text'
                    thousandSeparator
                    prefix='$'
                    decimalScale={0}
                    fixedDecimalScale={false}
                  />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
