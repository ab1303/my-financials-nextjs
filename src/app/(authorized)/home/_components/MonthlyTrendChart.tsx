'use client';

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MonthlyTrendPoint } from '@/server/models/dashboard';

interface MonthlyTrendChartProps {
  data: MonthlyTrendPoint[];
}

const formatAUD = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width='100%' height={200}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <XAxis
          dataKey='label'
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide={true} />
        <Tooltip
          formatter={(value) =>
            typeof value === 'number' ? formatAUD(value) : String(value)
          }
          contentStyle={{
            backgroundColor: 'rgba(31, 41, 55, 0.95)',
            border: '1px solid rgb(75, 85, 99)',
            borderRadius: '0.375rem',
            color: 'rgb(229, 231, 235)',
          }}
        />
        <Legend
          verticalAlign='bottom'
          iconType='circle'
          iconSize={8}
          wrapperStyle={{ paddingTop: '10px' }}
        />
        <Bar
          dataKey='income'
          name='Income'
          fill='#22c55e'
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey='expenses'
          name='Expenses'
          fill='#ef4444'
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
