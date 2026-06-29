'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import type { GroupBase, MultiValue } from 'react-select';

import {
  type DistributionItem,
  DistributionWidget,
} from '@/components/ui/DistributionWidget';
import { GroupCategoryPopover } from '@/components/ui/GroupCategoryPopover';
import { GroupedCategorySelect } from '@/components/ui/GroupedCategorySelect';
import {
  type GroupedBreakdown,
  groupExpenseBreakdown,
} from '@/lib/category-group-utils';
import type { CategoryBreakdown } from '@/server/models/expense';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';
import type { OptionType } from '@/types';

const BAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-400',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
];

const BADGE_COLORS = [
  'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
];

type Props = {
  breakdown: CategoryBreakdown[];
  categoryGroups: CategoryGroupListItem[];
  allCategories?: OptionType[];
  scope?: 'EXPENSE' | 'INCOME';
  selectedCategoryIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  label: string;
  emptyStateHref?: string;
  defaultFilterOpen?: boolean;
  showSelectedValuesInFilter?: boolean;
  showFilterLabel?: boolean;
  showEmptyGroups?: boolean;
};

export function CategoryGroupRollupPanel({
  breakdown,
  categoryGroups,
  allCategories,
  scope = 'EXPENSE',
  selectedCategoryIds,
  onSelectionChange,
  label,
  emptyStateHref,
  defaultFilterOpen = false,
  showSelectedValuesInFilter = false,
  showFilterLabel = false,
  showEmptyGroups = false,
}: Props) {
  const [viewMode, setViewMode] = useState<'categories' | 'groups'>(
    'categories',
  );
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(defaultFilterOpen);
  const [openPopoverGroupId, setOpenPopoverGroupId] = useState<string | null>(
    null,
  );
  const groupBadgeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scopedGroups = useMemo(
    () => categoryGroups.filter((g) => g.scope === scope),
    [categoryGroups, scope],
  );
  const hasGroups = scopedGroups.length > 0;
  const sourceCategories = useMemo(() => {
    if (allCategories && allCategories.length > 0) {
      return allCategories.map((category) => ({
        id: category.id,
        label: category.label,
      }));
    }
    return breakdown.map((b) => ({
      id: b.categoryId,
      label: b.categoryName,
    }));
  }, [allCategories, breakdown]);
  const allCategoryIds = useMemo(
    () => sourceCategories.map((category) => category.id),
    [sourceCategories],
  );
  const allSelected =
    allCategoryIds.length > 0 &&
    selectedCategoryIds.size === allCategoryIds.length &&
    allCategoryIds.every((id) => selectedCategoryIds.has(id));

  const filteredBreakdown = useMemo(
    () => breakdown.filter((b) => selectedCategoryIds.has(b.categoryId)),
    [breakdown, selectedCategoryIds],
  );

  const distributionItems: (DistributionItem & CategoryBreakdown)[] =
    filteredBreakdown.map((item, i) => ({
      name: item.categoryName,
      total: item.amount,
      percentage: item.percentage,
      color: BAR_COLORS[i % BAR_COLORS.length] ?? 'bg-gray-400',
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      amount: item.amount,
    }));

  const visibleItems = expanded
    ? distributionItems
    : distributionItems.slice(0, 5);
  const hiddenCount = distributionItems.length - 5;

  const groupedBreakdown = useMemo(() => {
    const base = groupExpenseBreakdown(
      breakdown,
      scopedGroups,
      selectedCategoryIds,
    );
    if (!showEmptyGroups) return base;

    const existingGroupIds = new Set(
      base
        .map((group) => group.groupId)
        .filter((groupId): groupId is string => Boolean(groupId)),
    );
    const selectedBreakdown = breakdown.filter((entry) =>
      selectedCategoryIds.has(entry.categoryId),
    );
    const missingGroups = scopedGroups
      .filter((group) => !existingGroupIds.has(group.id))
      .map((group) => {
        const categories = selectedBreakdown.filter((entry) =>
          group.memberIds.includes(entry.categoryId),
        );
        const totalAmount = categories.reduce(
          (sum, entry) => sum + entry.amount,
          0,
        );
        return {
          groupId: group.id,
          groupName: group.name,
          totalAmount,
          percentage: 0,
          categories,
        };
      });

    return [...base, ...missingGroups];
  }, [breakdown, scopedGroups, selectedCategoryIds, showEmptyGroups]);

  const groupDistributionItems: (DistributionItem & GroupedBreakdown)[] =
    groupedBreakdown.map((g, i) => ({
      ...g,
      name: g.groupName,
      total: g.totalAmount,
      color: BAR_COLORS[i % BAR_COLORS.length] ?? 'bg-gray-400',
    }));

  const groupedIds = new Set(scopedGroups.flatMap((g) => g.memberIds));
  const crossGroupOptions: GroupBase<OptionType>[] = useMemo(() => {
    const grouped = scopedGroups
      .map((g) => ({
        label: g.name,
        options: sourceCategories
          .filter((category) => g.memberIds.includes(category.id))
          .map((category) => ({ id: category.id, label: category.label })),
      }))
      .filter((g) => g.options.length > 0);

    const ungrouped = sourceCategories
      .filter((category) => !groupedIds.has(category.id))
      .map((category) => ({ id: category.id, label: category.label }));
    if (ungrouped.length > 0)
      grouped.push({ label: 'Ungrouped', options: ungrouped });
    return grouped;
  }, [groupedIds, scopedGroups, sourceCategories]);

  const selectedOptions = useMemo(
    () =>
      crossGroupOptions.flatMap((g) =>
        g.options.filter((o: OptionType) => selectedCategoryIds.has(o.id)),
      ),
    [crossGroupOptions, selectedCategoryIds],
  );

  if (sourceCategories.length === 0) return null;

  return (
    <div className='rounded-lg border border-border bg-card/50 p-3'>
      <div className='mb-2 flex items-center justify-between gap-2'>
        {hasGroups ? (
          <div className='flex items-center rounded-md border border-border bg-muted/40 p-0.5'>
            <button
              type='button'
              onClick={() => setViewMode('categories')}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors select-none cursor-default ${
                viewMode === 'categories'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Categories
            </button>
            <button
              type='button'
              onClick={() => {
                setViewMode('groups');
                setFilterOpen(false);
              }}
              className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors select-none cursor-default ${
                viewMode === 'groups'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Groups
            </button>
          </div>
        ) : (
          <a
            href={emptyStateHref ?? '/cashflow/category-groups'}
            className='text-xs text-muted-foreground hover:text-foreground transition-colors'
          >
            + Create category groups for rollup view
          </a>
        )}

        <div className='flex items-center gap-1.5'>
          {!allSelected && (
            <button
              type='button'
              onClick={() => {
                setOpenPopoverGroupId(null);
                setFilterOpen(false);
                onSelectionChange(new Set(allCategoryIds));
              }}
              className='rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
              aria-label='Restore all categories'
            >
              All
            </button>
          )}
          {viewMode === 'categories' && (
            <button
              type='button'
              onClick={() => setFilterOpen((p) => !p)}
              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors ${
                filterOpen
                  ? 'bg-muted/60 border-border text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
              aria-label='Toggle category filter'
            >
              Filter
              {!allSelected && (
                <span className='rounded-full bg-primary/15 px-1 text-[10px] font-semibold leading-4 text-primary'>
                  {selectedCategoryIds.size}/{allCategoryIds.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {filterOpen && viewMode === 'categories' && (
        <div className='mb-3'>
          <GroupedCategorySelect
            label={label}
            instanceId={`category-group-rollup-select-${scope.toLowerCase()}`}
            options={crossGroupOptions}
            value={selectedOptions}
            onChange={(values: MultiValue<OptionType>) =>
              onSelectionChange(new Set(values.map((v) => v.id)))
            }
            placeholder='Search categories...'
            hideSelectedValues={!showSelectedValuesInFilter}
            hideLabel={!showFilterLabel}
            searchable={false}
          />
        </div>
      )}

      {breakdown.length > 0 && viewMode === 'categories' ? (
        <>
          <DistributionWidget
            items={visibleItems}
            renderItem={(item) => (
              <button
                key={item.categoryName}
                type='button'
                className='rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors select-none cursor-default bg-muted/40 text-muted-foreground border-border'
              >
                {item.categoryName}{' '}
                <NumericFormat
                  value={item.total}
                  displayType='text'
                  thousandSeparator
                  prefix='$'
                  decimalScale={0}
                />
              </button>
            )}
          />
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            {hiddenCount > 0 && (
              <button
                type='button'
                onClick={() => setExpanded((prev) => !prev)}
                className='flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
                aria-label={
                  expanded
                    ? 'Show fewer categories'
                    : `Show ${hiddenCount} more categories`
                }
              >
                {expanded ? (
                  <>
                    <ChevronUp size={12} /> {hiddenCount} fewer
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} /> + {hiddenCount} more
                  </>
                )}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className='flex flex-wrap gap-2'>
          {groupDistributionItems.map((g, i) => {
            const popoverId = g.groupId ?? 'ungrouped';
            const isOpen = openPopoverGroupId === popoverId;
            const selectedInGroup = g.categories.filter((c) =>
              selectedCategoryIds.has(c.categoryId),
            ).length;
            const totalInGroup = g.categories.length;

            return (
              <div
                key={g.groupName}
                ref={(el) => {
                  groupBadgeRefs.current[popoverId] = el;
                }}
                className='relative'
              >
                <button
                  type='button'
                  onClick={() =>
                    setOpenPopoverGroupId(isOpen ? null : popoverId)
                  }
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    BADGE_COLORS[i % BADGE_COLORS.length] ?? ''
                  } border-transparent hover:border-current`}
                  aria-expanded={isOpen}
                  aria-haspopup='dialog'
                >
                  <span
                    className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${BAR_COLORS[i % BAR_COLORS.length] ?? 'bg-gray-400'}`}
                  />
                  {g.groupName}
                  {selectedInGroup < totalInGroup && (
                    <span className='opacity-70'>
                      ({selectedInGroup}/{totalInGroup})
                    </span>
                  )}
                  <NumericFormat
                    value={g.totalAmount}
                    displayType='text'
                    thousandSeparator
                    prefix='$'
                    decimalScale={0}
                  />
                  <span className='opacity-60'>
                    ({g.percentage.toFixed(1)}%)
                  </span>
                  <ChevronDown
                    size={10}
                    className={
                      isOpen
                        ? 'rotate-180 transition-transform'
                        : 'transition-transform'
                    }
                  />
                </button>

                {isOpen && (
                  <GroupCategoryPopover
                    group={g}
                    selectedCategoryIds={selectedCategoryIds}
                    onSelectionChange={onSelectionChange}
                    onClose={() => setOpenPopoverGroupId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
