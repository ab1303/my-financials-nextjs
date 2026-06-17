'use client';

import { NumericFormat } from 'react-number-format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CategoryBreakdown } from '@/server/models/expense';

type ExpenseCategoryChartProps = {
  data: CategoryBreakdown[];
  calendarYearId: string;
  onCategoryClick?: (categoryName: string) => void;
};

export function ExpenseCategoryChart({
  data,
  onCategoryClick,
}: ExpenseCategoryChartProps) {
  const TOP_N = 8;
  const topItems = data.slice(0, TOP_N);
  const otherItems = data.slice(TOP_N);
  const otherTotal = otherItems.reduce((s, i) => s + i.amount, 0);
  const otherPct = otherItems.reduce((s, i) => s + i.percentage, 0);

  const rows = [
    ...topItems,
    ...(otherItems.length > 0
      ? [
          {
            categoryId: 'other',
            categoryName: `Other (${otherItems.length} more)`,
            amount: otherTotal,
            percentage: otherPct,
          },
        ]
      : []),
  ];

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Expenses by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No expenses recorded
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Expenses by Category
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((item) => (
          <div
            key={item.categoryId}
            className={`space-y-1 ${
              item.categoryId !== 'other' && onCategoryClick
                ? 'cursor-pointer hover:opacity-80'
                : ''
            }`}
            onClick={() =>
              item.categoryId !== 'other' && onCategoryClick?.(item.categoryName)
            }
          >
            <div className="flex justify-between text-xs">
              <span className="text-foreground/80 truncate max-w-[60%]">
                {item.categoryName}
              </span>
              <span className="text-muted-foreground">
                <NumericFormat
                  value={item.amount}
                  displayType="text"
                  thousandSeparator=","
                  prefix="$"
                  decimalScale={0}
                  fixedDecimalScale
                />{' '}
                ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-red-400 dark:bg-red-500 rounded-full transition-all"
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
