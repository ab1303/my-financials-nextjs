'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MonthlyTrendPoint } from '@/server/models/cashflow-analytics';

type NetCashflowChartProps = {
  data: MonthlyTrendPoint[];
};

const formatTick = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : v <= -1000 ? `-$${(Math.abs(v) / 1000).toFixed(0)}k` : `$${v}`;

export function NetCashflowChart({ data }: NetCashflowChartProps) {
  // Compute cumulative savings line using reduce
  const chartData = data.reduce(
    (acc: any[], point, index) => {
      const cumulative = (acc[index - 1]?.cumulative ?? 0) + point.net;
      acc.push({ ...point, cumulative });
      return acc;
    },
    []
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Net Cashflow by Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No data for this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tickFormatter={formatTick} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value, name) => {
                  const num = Number(value);
                  if (name === 'Cumulative') {
                    return [
                      num >= 0 ? `+$${num.toLocaleString()}` : `-$${Math.abs(num).toLocaleString()}`,
                      'Cumulative',
                    ];
                  }
                  return [
                    num >= 0
                      ? `+$${num.toLocaleString()}`
                      : `-$${Math.abs(num).toLocaleString()}`,
                    'Net',
                  ];
                }}
              />
              <Legend />
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <Bar dataKey="net" name="Net Cashflow" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.net >= 0 ? '#16a34a' : '#dc2626'}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="cumulative"
                name="Cumulative"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
