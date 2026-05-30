"use client";

import type { TopExpenseCategory } from "@/server/models/dashboard";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TopExpensesChartProps {
  data: TopExpenseCategory[];
}

const COLORS = [
  "#7c3aed", // violet-600
  "#2563eb", // blue-600
  "#db2777", // pink-600
  "#d97706", // amber-600
  "#059669", // emerald-600
  "#dc2626", // red-600
  "#9333ea", // purple-600
  "#0891b2", // cyan-600
];

const formatAUD = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function TopExpensesChart({ data }: TopExpensesChartProps) {
  if (data.length === 0) {
    return null;
  }

  const percentageMap = new Map(data.map((d) => [d.category, d.percentage]));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => typeof value === 'number' ? formatAUD(value) : String(value)}
          contentStyle={{
            backgroundColor: "rgba(31, 41, 55, 0.95)",
            border: "1px solid rgb(75, 85, 99)",
            borderRadius: "0.375rem",
            color: "rgb(229, 231, 235)",
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(name: string) =>
            `${name}: ${percentageMap.get(name)?.toFixed(1) ?? "0.0"}%`
          }
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
