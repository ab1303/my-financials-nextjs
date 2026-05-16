'use client';

import { format } from 'date-fns';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { NetWorthDataPoint } from '@/types/asset-dashboard.types';

type LineVisibility = {
  total: boolean;
  cash: boolean;
  stocks: boolean;
};

type NetWorthChartProps = {
  data: NetWorthDataPoint[];
  visibility: LineVisibility;
};

const formatAudCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export default function NetWorthChart({ data, visibility }: NetWorthChartProps) {
  if (data.length === 0) {
    return (
      <div className='flex h-[360px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'>
        No snapshots recorded. Add your first cash or stock snapshot to start
        tracking.
      </div>
    );
  }

  return (
    <div className='h-[380px] w-full rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900'>
      <ResponsiveContainer width='100%' height='100%'>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray='3 3' stroke='#d1d5db' />
          <XAxis
            dataKey='date'
            tickFormatter={(value) => format(new Date(value), 'dd MMM yy')}
            stroke='#6b7280'
          />
          <YAxis
            tickFormatter={(value) => formatAudCurrency(Number(value))}
            stroke='#6b7280'
            width={90}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) {
                return null;
              }

              const point = payload[0]?.payload as NetWorthDataPoint | undefined;
              if (!point) {
                return null;
              }

              return (
                <div className='rounded-md border border-gray-200 bg-white p-3 shadow-md dark:border-gray-700 dark:bg-gray-900'>
                  <p className='mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100'>
                    {format(new Date(point.date), 'dd MMM yyyy')}
                  </p>
                  <p className='text-sm text-purple-700 dark:text-purple-400'>
                    Total: {formatAudCurrency(point.netWorthTotal)}
                  </p>
                  <p className='text-sm text-blue-700 dark:text-blue-400'>
                    Cash: {formatAudCurrency(point.cashTotal)}
                  </p>
                  <p className='text-sm text-green-700 dark:text-green-400'>
                    Stocks: {formatAudCurrency(point.stockTotal)}
                  </p>
                  {point.isStockStale && (
                    <p className='mt-2 text-xs font-medium text-amber-700 dark:text-amber-300'>
                      Stock value uses latest known snapshot before this date.
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Legend />
          {visibility.total && (
            <Line
              type='monotone'
              dataKey='netWorthTotal'
              name='Total Assets'
              stroke='#7c3aed'
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5 }}
            />
          )}
          {visibility.cash && (
            <Line
              type='monotone'
              dataKey='cashTotal'
              name='Cash'
              stroke='#2563eb'
              strokeWidth={2}
              dot={false}
            />
          )}
          {visibility.stocks && (
            <Line
              type='monotone'
              dataKey='stockTotal'
              name='Stocks'
              stroke='#16a34a'
              strokeWidth={2}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
