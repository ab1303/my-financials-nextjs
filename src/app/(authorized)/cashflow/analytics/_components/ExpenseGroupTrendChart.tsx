'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ExpenseGroupTrendChartProps = {
  monthlyData: Array<{
    month: number;
    year: number;
    groups: Array<{
      groupId: string | null;
      groupName: string;
      totalAmount: number;
    }>;
  }>;
};

type TrendGroup = {
  key: string;
  groupId: string | null;
  groupName: string;
  color: string;
};

type ChartRow = {
  label: string;
  month: number;
  year: number;
  total: number;
  [key: string]: string | number;
};

const GROUP_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
];

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);

const formatMonthLabel = (month: number, year: number) => {
  const monthLabel = MONTH_LABELS[month - 1] ?? `M${month}`;
  return `${monthLabel} '${String(year).slice(-2)}`;
};

type TrendTooltipItem = {
  name: string;
  value: number;
  color: string;
};

type TrendTooltipProps = TooltipContentProps;
type TrendTooltipEntry = NonNullable<TrendTooltipProps['payload']>[number];

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const rows: TrendTooltipItem[] = (payload ?? [])
    .map((item: TrendTooltipEntry) => ({
      name: String(item.name ?? ''),
      value: Number(item.value ?? 0),
      color: String(item.color ?? '#64748b'),
    }))
    .filter((item: TrendTooltipItem) => item.value !== 0 || item.name.length > 0);

  const total = rows.reduce((sum: number, row: TrendTooltipItem) => sum + row.value, 0);

  return (
    <div className='rounded-lg border bg-popover px-3 py-2 shadow-md'>
      <p className='text-sm font-medium text-popover-foreground'>{String(label)}</p>
      <p className='text-xs text-muted-foreground'>
        Estimated monthly spend split by annual group mix
      </p>
      <div className='mt-2 space-y-1'>
        <div className='flex items-center justify-between gap-4 text-xs'>
          <span className='text-muted-foreground'>Total (estimated)</span>
          <span className='font-medium tabular-nums'>{formatMoney(total)}</span>
        </div>
        {rows.map((row) => (
          <div key={row.name} className='flex items-center justify-between gap-4 text-xs'>
            <span className='flex items-center gap-2 text-muted-foreground'>
              <span
                className='inline-block h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: row.color }}
              />
              {row.name}
            </span>
            <span className='font-medium tabular-nums'>{formatMoney(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExpenseGroupTrendChart({ monthlyData }: ExpenseGroupTrendChartProps) {
  const groups = useMemo<TrendGroup[]>(() => {
    const firstMonthGroups = monthlyData[0]?.groups ?? [];

    return firstMonthGroups.map((group: ExpenseGroupTrendChartProps['monthlyData'][number]['groups'][number], index: number) => ({
      key: group.groupId ?? `ungrouped-${group.groupName}`,
      groupId: group.groupId,
      groupName: group.groupName,
      color: GROUP_COLORS[index % GROUP_COLORS.length] ?? '#64748b',
    }));
  }, [monthlyData]);

  const chartData = useMemo<ChartRow[]>(() => {
    return monthlyData.map((point: ExpenseGroupTrendChartProps['monthlyData'][number]) => {
      const row: ChartRow = {
        label: formatMonthLabel(point.month, point.year),
        month: point.month,
        year: point.year,
        total: 0,
      };

      for (const group of point.groups as ExpenseGroupTrendChartProps['monthlyData'][number]['groups']) {
        const key = group.groupId ?? `ungrouped-${group.groupName}`;
        row[key] = group.totalAmount;
        row.total += group.totalAmount;
      }

      return row;
    });
  }, [monthlyData]);

  if (monthlyData.length === 0 || groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-sm font-medium'>
            Estimated Expense Group Trend
          </CardTitle>
          <CardDescription>
            Monthly spend is estimated from the annual group mix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className='py-8 text-center text-sm text-muted-foreground'>
            No estimated group trend available for this selection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>
          Estimated Expense Group Trend
        </CardTitle>
        <CardDescription>
          Monthly spend is allocated using the annual group mix for a transparent
          estimate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray='3 3' />
            <XAxis dataKey='label' tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => formatMoney(Number(value)).replace(/\.00$/, '')} />
            <Tooltip content={TrendTooltip} />
            <Legend />
            {groups.map((group, index) => (
              <Bar
                key={group.key}
                dataKey={group.key}
                name={group.groupName}
                stackId='expense-groups'
                fill={group.color}
                radius={index === groups.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
