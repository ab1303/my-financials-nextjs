import { BarChart2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MonthlyTrendPoint } from "@/server/models/dashboard";

import { MonthlyTrendChart } from "./MonthlyTrendChart";

interface MonthlyTrendWidgetProps {
  data: MonthlyTrendPoint[];
}

export function MonthlyTrendWidget({ data }: MonthlyTrendWidgetProps) {
  const isEmpty = data.length === 0;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          <CardTitle className="text-slate-900 dark:text-slate-100">
            Income vs Expenses
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No transaction data for the last 6 months
          </p>
        ) : (
          <MonthlyTrendChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
