'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface SparklineData {
  date: string;
  value: number;
}

interface Props {
  data: SparklineData[];
}

/**
 * NetWorthSparkline - Client Component
 * Renders a minimal recharts AreaChart (sparkline-style)
 * - No axes, tooltip, or legend
 * - Purple fill with low opacity
 * - Used within NetWorthWidget for historical net worth visualization
 */
export function NetWorthSparkline({ data }: Props) {
  if (data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width='100%' height={60}>
      <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Area
          type='monotone'
          dataKey='value'
          stroke='#7c3aed'
          fill='#7c3aed'
          fillOpacity={0.15}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
