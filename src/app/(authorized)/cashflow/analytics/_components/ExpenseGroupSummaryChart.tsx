'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { NumericFormat } from 'react-number-format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { groupExpenseBreakdown } from '@/lib/category-group-utils';
import type { CategoryBreakdown } from '@/server/models/expense';
import type { CategoryGroupListItem } from '@/server/services/category-groups/category-groups.service';

const GROUP_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-pink-500',
];

const GROUP_BADGE_COLORS = [
  'text-red-700 dark:text-red-400',
  'text-orange-700 dark:text-orange-400',
  'text-amber-700 dark:text-amber-400',
  'text-lime-700 dark:text-lime-400',
  'text-green-700 dark:text-green-400',
  'text-teal-700 dark:text-teal-400',
  'text-cyan-700 dark:text-cyan-400',
  'text-blue-700 dark:text-blue-400',
  'text-indigo-700 dark:text-indigo-400',
  'text-violet-700 dark:text-violet-400',
  'text-purple-700 dark:text-purple-400',
  'text-pink-700 dark:text-pink-400',
];

type Props = {
  expenseCategories: CategoryBreakdown[];
  categoryGroups: CategoryGroupListItem[];
};

export function ExpenseGroupSummaryChart({
  expenseCategories,
  categoryGroups,
}: Props) {
  const expenseGroups = useMemo(
    () => categoryGroups.filter((g) => g.scope === 'EXPENSE'),
    [categoryGroups],
  );

  const grouped = useMemo(
    () => groupExpenseBreakdown(expenseCategories, expenseGroups),
    [expenseCategories, expenseGroups],
  );

  if (expenseGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Expenses by Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground py-4 text-center'>
            No category groups defined.{' '}
            <Link
              href='/cashflow/category-groups'
              className='text-primary hover:underline'
            >
              Create groups
            </Link>{' '}
            to see a rollup view.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (grouped.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>Expenses by Group</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stacked bar */}
        <div className='flex h-3 w-full overflow-hidden rounded-full bg-muted mb-4'>
          {grouped.map((g, i) => (
            <div
              key={g.groupName}
              style={{ width: `${g.percentage}%` }}
              className={GROUP_COLORS[i % GROUP_COLORS.length] ?? 'bg-gray-400'}
              title={`${g.groupName}: ${g.percentage.toFixed(1)}%`}
            />
          ))}
        </div>

        {/* Group rows */}
        <div className='space-y-3'>
          {grouped.map((group, i) => {
            const barColor =
              GROUP_COLORS[i % GROUP_COLORS.length] ?? 'bg-gray-400';
            const textColor =
              GROUP_BADGE_COLORS[i % GROUP_BADGE_COLORS.length] ??
              'text-foreground';

            return (
              <div key={group.groupName} className='space-y-1'>
                {/* Group header row */}
                <div className='flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2 min-w-0'>
                    <span
                      className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${barColor}`}
                    />
                    <span
                      className={`text-sm font-semibold truncate ${textColor}`}
                    >
                      {group.groupName}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      ({group.categories.length}{' '}
                      {group.categories.length === 1
                        ? 'category'
                        : 'categories'}
                      )
                    </span>
                  </div>
                  <div className='flex items-center gap-2 flex-shrink-0'>
                    <span className='text-xs text-muted-foreground'>
                      {group.percentage.toFixed(1)}%
                    </span>
                    <span className='text-sm font-semibold text-foreground tabular-nums'>
                      <NumericFormat
                        value={group.totalAmount}
                        displayType='text'
                        thousandSeparator
                        prefix='$'
                        decimalScale={0}
                        fixedDecimalScale={false}
                      />
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
                  <div
                    className={`h-full rounded-full ${barColor} opacity-70`}
                    style={{ width: `${group.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
