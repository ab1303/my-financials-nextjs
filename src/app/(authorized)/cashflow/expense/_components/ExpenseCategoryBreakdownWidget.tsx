'use client';

import { Dialog, Transition } from '@headlessui/react';
import { ChevronDown, ChevronUp, ExternalLink, Filter, LayoutList, Search, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useMemo, useRef, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import type { GroupBase, MultiValue } from 'react-select';

import Portal from '@/components/Portal';
import { DistributionWidget, type DistributionItem } from '@/components/ui/DistributionWidget';
import { GroupCategoryPopover } from '@/components/ui/GroupCategoryPopover';
import { SelectWrapper as Select } from '@/components/ui/Select';
import { groupExpenseBreakdown, type GroupedBreakdown } from '@/lib/category-group-utils';
import type { CategoryBreakdown } from '@/server/models/expense';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';
import type { OptionType } from '@/types';

// Fixed ordered palette — assigned by rank (index 0 = highest spend)
const BAR_COLORS = [
  'bg-red-500',    'bg-orange-500',  'bg-amber-500',   'bg-yellow-400',
  'bg-lime-500',   'bg-green-500',   'bg-emerald-500', 'bg-teal-500',
  'bg-cyan-500',   'bg-sky-500',     'bg-blue-500',    'bg-indigo-500',
  'bg-violet-500', 'bg-purple-500',  'bg-fuchsia-500', 'bg-pink-500',
  'bg-rose-500',   'bg-slate-500',   'bg-zinc-500',    'bg-stone-400',
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
  'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200',
  'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-200',
  'bg-stone-100 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200',
];

const TOP_N = 5;

type Props = {
  breakdown: CategoryBreakdown[];
  yearDateFrom: string;
  yearDateTo: string;
  calendarLabel?: string;
  categoryGroups: CategoryGroupListItem[];
  selectedCategoryIds: Set<string>;
  onCategorySelectionChange: (ids: Set<string>) => void;
};

type ExpenseDistributionItem = DistributionItem & CategoryBreakdown;

export default function ExpenseCategoryBreakdownWidget({
  breakdown,
  yearDateFrom,
  yearDateTo,
  calendarLabel,
  categoryGroups,
  selectedCategoryIds,
  onCategorySelectionChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'categories' | 'groups'>('categories');
  const [openPopoverGroupId, setOpenPopoverGroupId] = useState<string | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const _groupBadgeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const expenseGroups = categoryGroups.filter((g) => g.scope === 'EXPENSE');
  const hasGroups = expenseGroups.length > 0;
  const allCategoryIds = useMemo(
    () => breakdown.map((b) => b.categoryId),
    [breakdown],
  );
  const allSelected =
    allCategoryIds.length > 0 &&
    selectedCategoryIds.size === allCategoryIds.length &&
    allCategoryIds.every((id) => selectedCategoryIds.has(id));

  // Categories mode: filter to selected
  const filteredBreakdown = useMemo(
    () => breakdown.filter((b) => selectedCategoryIds.has(b.categoryId)),
    [breakdown, selectedCategoryIds],
  );

  const distributionItems: ExpenseDistributionItem[] = filteredBreakdown.map((item, i) => ({
    name: item.categoryName,
    total: item.amount,
    percentage: item.percentage,
    color: BAR_COLORS[i % BAR_COLORS.length] ?? 'bg-gray-400',
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    amount: item.amount,
  }));

  const visibleItems = expanded ? distributionItems : distributionItems.slice(0, TOP_N);
  const hiddenCount = distributionItems.length - TOP_N;

  // Groups mode
  const groupedBreakdown = useMemo(
    () => groupExpenseBreakdown(breakdown, expenseGroups, selectedCategoryIds),
    [breakdown, expenseGroups, selectedCategoryIds],
  );

  const groupDistributionItems: (DistributionItem & GroupedBreakdown)[] = groupedBreakdown.map(
    (g, i) => ({
      ...g,
      name: g.groupName,
      total: g.totalAmount,
      color: BAR_COLORS[i % BAR_COLORS.length] ?? 'bg-gray-400',
    }),
  );

  // Cross-group filter panel options
  const crossGroupOptions: GroupBase<OptionType>[] = useMemo(() => {
    const grouped = expenseGroups.map((g) => ({
      label: g.name,
      options: breakdown
        .filter((b) => g.memberIds.includes(b.categoryId))
        .map((b) => ({ id: b.categoryId, label: b.categoryName })),
    })).filter((g) => g.options.length > 0);

    const groupedIds = new Set(expenseGroups.flatMap((g) => g.memberIds));
    const ungrouped = breakdown
      .filter((b) => !groupedIds.has(b.categoryId))
      .map((b) => ({ id: b.categoryId, label: b.categoryName }));
    if (ungrouped.length > 0) {
      grouped.push({ label: 'Ungrouped', options: ungrouped });
    }
    return grouped;
  }, [breakdown, expenseGroups]);

  const selectedOptions = useMemo(
    () => crossGroupOptions.flatMap((g) => g.options.filter((o) => selectedCategoryIds.has(o.id))),
    [crossGroupOptions, selectedCategoryIds],
  );

  function handleCrossGroupChange(values: MultiValue<OptionType>) {
    onCategorySelectionChange(new Set(values.map((v) => v.id)));
  }

  if (breakdown.length === 0) return null;

  return (
    <>
      <div className='mb-4 rounded-lg border border-border bg-card/50 p-3'>
        {/* Top row: mode toggle + filter button */}
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
                onClick={() => setViewMode('groups')}
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
            <Link
              href='/cashflow/category-groups'
              className='text-xs text-muted-foreground hover:text-foreground transition-colors'
            >
              + Create category groups for rollup view
            </Link>
          )}

          <div className='flex items-center gap-2'>
            {!allSelected && (
              <button
                type='button'
                onClick={() => {
                  setOpenPopoverGroupId(null);
                  setFilterPanelOpen(false);
                  onCategorySelectionChange(new Set(allCategoryIds));
                }}
                className='rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
                aria-label='Restore all categories'
              >
                All
              </button>
            )}
            <button
              type='button'
              onClick={() => setFilterPanelOpen((v) => !v)}
              className='flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
              aria-label='Filter categories'
            >
              <Filter size={12} />
              Filter
              {selectedCategoryIds.size < breakdown.length && (
                <span className='ml-0.5 rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold text-primary'>
                  {selectedCategoryIds.size}/{breakdown.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Cross-group filter panel */}
        {filterPanelOpen && (
          <div className='mb-3'>
            <Select<OptionType, true, GroupBase<OptionType>>
              instanceId='expense-category-filter-widget'
              inputId='expense-category-filter-widget'
              options={crossGroupOptions}
              value={selectedOptions}
              onChange={handleCrossGroupChange}
              isMulti
              isClearable
              placeholder='Select categories...'
              className='w-full text-sm'
              getOptionValue={(opt) => opt.id}
              getOptionLabel={(opt) => opt.label}
              formatGroupLabel={(group) => (
                <div className='py-1 text-xs font-semibold text-foreground'>
                  {group.label}
                </div>
              )}
            />
          </div>
        )}

        {viewMode === 'categories' ? (
          <>
            <DistributionWidget
              items={visibleItems}
              renderItem={(item) => (
                <CategoryBadgeLink
                  key={item.categoryName}
                  item={item}
                  colorIndex={distributionItems.indexOf(item)}
                  yearDateFrom={yearDateFrom}
                  yearDateTo={yearDateTo}
                />
              )}
            />
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              {hiddenCount > 0 && (
                <button
                  type='button'
                  onClick={() => setExpanded((prev) => !prev)}
                  className='flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
                  aria-label={expanded ? 'Show fewer categories' : `Show ${hiddenCount} more categories`}
                >
                  {expanded ? (
                    <><ChevronUp size={12} /> {hiddenCount} fewer</>
                  ) : (
                    <><ChevronDown size={12} /> + {hiddenCount} more</>
                  )}
                </button>
              )}
              <div className='ml-auto'>
                <button
                  type='button'
                  onClick={() => setDialogOpen(true)}
                  className='flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border hover:bg-muted/60 hover:text-foreground transition-colors'
                  aria-label='View full category breakdown'
                >
                  <LayoutList size={13} />
                  View all
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Groups mode */
          <div>
            <div className='flex h-3 w-full overflow-hidden rounded-full bg-muted mb-3'>
              {groupDistributionItems.map((g) => (
                <div
                  key={g.groupName}
                  style={{ width: `${g.percentage}%` }}
                  className={g.color}
                  title={`${g.groupName}: ${g.percentage.toFixed(1)}%`}
                />
              ))}
            </div>
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
                    ref={(el) => { _groupBadgeRefs.current[popoverId] = el; }}
                    className='relative'
                  >
                    <button
                      type='button'
                      onClick={() => setOpenPopoverGroupId(isOpen ? null : popoverId)}
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
                      {'\u00a0'}
                      <NumericFormat
                        value={g.totalAmount}
                        displayType='text'
                        thousandSeparator
                        prefix='$'
                        decimalScale={0}
                      />
                      <span className='opacity-60'>({g.percentage.toFixed(1)}%)</span>
                      <ChevronDown
                        size={10}
                        className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
                      />
                    </button>

                    {isOpen && (
                      <GroupCategoryPopover
                        group={g}
                        selectedCategoryIds={selectedCategoryIds}
                        onSelectionChange={onCategorySelectionChange}
                        onClose={() => setOpenPopoverGroupId(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <CategorySummaryDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        breakdown={breakdown}
        yearDateFrom={yearDateFrom}
        yearDateTo={yearDateTo}
        calendarLabel={calendarLabel}
      />
    </>
  );
}

// ─── Summary Dialog ────────────────────────────────────────────────────────────

type DialogProps = {
  isOpen: boolean;
  onClose: () => void;
  breakdown: CategoryBreakdown[];
  yearDateFrom: string;
  yearDateTo: string;
  calendarLabel?: string;
};

function CategorySummaryDialog({ isOpen, onClose, breakdown, yearDateFrom, yearDateTo, calendarLabel }: DialogProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? breakdown.filter((item) => item.categoryName.toLowerCase().includes(search.toLowerCase()))
    : breakdown;

  const totalAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Portal>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog onClose={onClose} className='relative z-50'>
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter='ease-out duration-200'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='ease-in duration-150'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <div className='fixed inset-0 bg-black/50' />
          </Transition.Child>

          <div className='fixed inset-0 flex items-center justify-center p-4'>
            <Transition.Child
              as={Fragment}
              enter='ease-out duration-200'
              enterFrom='opacity-0 scale-95'
              enterTo='opacity-100 scale-100'
              leave='ease-in duration-150'
              leaveFrom='opacity-100 scale-100'
              leaveTo='opacity-0 scale-95'
            >
              <Dialog.Panel className='flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-background shadow-2xl ring-1 ring-border'>

                {/* Header */}
                <div className='flex items-center justify-between border-b border-border px-5 py-4'>
                  <Dialog.Title as='h2' className='text-base font-semibold text-foreground'>
                    {calendarLabel ? `${calendarLabel} — ` : ''}Expense Breakdown
                  </Dialog.Title>
                  <button
                    type='button'
                    onClick={onClose}
                    className='rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors'
                    aria-label='Close'
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Stacked bar */}
                <div className='px-5 pt-4 pb-2'>
                  <div className='flex h-3 w-full overflow-hidden rounded-full bg-muted'>
                    {breakdown.map((item, i) => (
                      <div
                        key={item.categoryName}
                        style={{ width: `${item.percentage}%` }}
                        className={BAR_COLORS[i % BAR_COLORS.length]}
                        title={`${item.categoryName}: ${item.percentage.toFixed(1)}%`}
                      />
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div className='px-5 pb-3'>
                  <div className='relative'>
                    <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
                    <input
                      type='text'
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder='Filter categories...'
                      className='w-full rounded-md border border-border bg-muted/40 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
                    />
                  </div>
                </div>

                {/* Category list */}
                <div className='flex-1 overflow-y-auto px-5 pb-2'>
                  {filtered.length === 0 ? (
                    <p className='py-6 text-center text-sm text-muted-foreground'>No categories match your search.</p>
                  ) : (
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-border text-xs font-medium text-muted-foreground select-none'>
                          <th className='pb-2 text-left'>Category</th>
                          <th className='pb-2 text-right'>Amount</th>
                          <th className='pb-2 text-right'>%</th>
                          <th className='pb-2 w-6' />
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-border/50'>
                        {filtered.map((item, i) => {
                          const originalIndex = breakdown.indexOf(item);
                          const url = `/cashflow/transactions?tab=expenses&categoryName=${encodeURIComponent(item.categoryName)}&dateFrom=${yearDateFrom}&dateTo=${yearDateTo}`;
                          return (
                            <tr key={item.categoryName} className='group hover:bg-muted/30 transition-colors'>
                              <td className='py-2 pr-3'>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[originalIndex % BADGE_COLORS.length]}`}>
                                  {item.categoryName}
                                </span>
                              </td>
                              <td className='py-2 pr-3 text-right font-medium tabular-nums text-foreground'>
                                <NumericFormat
                                  value={item.amount}
                                  displayType='text'
                                  thousandSeparator
                                  prefix='$'
                                  decimalScale={2}
                                  fixedDecimalScale
                                />
                              </td>
                              <td className='py-2 pr-2 text-right tabular-nums text-muted-foreground'>
                                {item.percentage.toFixed(1)}%
                              </td>
                              <td className='py-2'>
                                <Link
                                  href={url}
                                  onClick={onClose}
                                  className='flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all'
                                  title={`View ${item.categoryName} transactions`}
                                  aria-label={`View ${item.categoryName} transactions`}
                                >
                                  <ExternalLink size={13} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Footer — total */}
                <div className='border-t border-border px-5 py-3 flex items-center justify-between'>
                  <span className='text-xs text-muted-foreground'>
                    {filtered.length < breakdown.length
                      ? `${filtered.length} of ${breakdown.length} categories`
                      : `${breakdown.length} categories`}
                  </span>
                  <span className='text-sm font-bold text-foreground'>
                    Total:{' '}
                    <NumericFormat
                      value={totalAmount}
                      displayType='text'
                      thousandSeparator
                      prefix='$'
                      decimalScale={2}
                      fixedDecimalScale
                    />
                  </span>
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </Portal>
  );
}

// ─── Summary Dialog (omitted for brevity, assume original remains) ────────────────
// ... (omitted) ...

// ─── Badge Link ──────────────────────────────────────────────────────────────

function CategoryBadgeLink({
  item,
  colorIndex,
  yearDateFrom,
  yearDateTo,
}: {
  item: ExpenseDistributionItem;
  colorIndex: number;
  yearDateFrom: string;
  yearDateTo: string;
}) {
  const url = `/cashflow/transactions?tab=expenses&categoryName=${encodeURIComponent(item.categoryName)}&dateFrom=${yearDateFrom}&dateTo=${yearDateTo}`;

  return (
    <Link
      href={url}
      className='flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors'
      title={`View ${item.categoryName} transactions`}
    >
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[colorIndex % BADGE_COLORS.length]}`}>
        {item.categoryName}
      </span>
      <NumericFormat
        value={item.amount}
        displayType='text'
        thousandSeparator
        prefix='$'
        decimalScale={2}
        fixedDecimalScale
      />
      <span>({item.percentage.toFixed(1)}%)</span>
      <ExternalLink size={13} className='ml-0.5 opacity-70' />
    </Link>
  );
}
