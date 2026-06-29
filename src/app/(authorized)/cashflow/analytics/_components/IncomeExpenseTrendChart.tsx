'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MonthlyTrendPoint } from '@/server/models/cashflow-analytics';

type IncomeExpenseTrendChartProps = {
  data: MonthlyTrendPoint[];
  onMonthClick?: (
    point: MonthlyTrendPoint,
    series: 'income' | 'expenses',
  ) => void;
};

const formatTick = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`;

export function IncomeExpenseTrendChart({
  data,
  onMonthClick,
}: IncomeExpenseTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-medium'>
          Income vs Expenses — Monthly Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className='text-center text-sm text-muted-foreground py-8'>
            No data for this period
          </p>
        ) : (
          <ResponsiveContainer width='100%' height={300}>
            <ComposedChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray='3 3' />
              <XAxis dataKey='label' tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tickFormatter={formatTick} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => [
                  `$${Number(value ?? 0).toLocaleString()}`,
                  String(name ?? '').replace(/^\w/, (c) => c.toUpperCase()),
                ]}
              />
              <Legend />
              <ReferenceLine
                y={0}
                stroke='hsl(var(--muted-foreground))'
                opacity={0.3}
              />
              <Bar
                dataKey='income'
                name='Income'
                fill='#16a34a'
                radius={[4, 4, 0, 0]}
                onClick={(d) =>
                  onMonthClick?.(d as unknown as MonthlyTrendPoint, 'income')
                }
                cursor={onMonthClick ? 'pointer' : 'default'}
              />
              <Bar
                dataKey='expenses'
                name='Expenses'
                fill='#dc2626'
                radius={[4, 4, 0, 0]}
                onClick={(d) =>
                  onMonthClick?.(d as unknown as MonthlyTrendPoint, 'expenses')
                }
                cursor={onMonthClick ? 'pointer' : 'default'}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
