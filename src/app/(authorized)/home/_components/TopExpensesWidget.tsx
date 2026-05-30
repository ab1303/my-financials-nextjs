import type { TopExpenseCategory } from "@/server/models/dashboard";
import { TopExpensesChart } from "./TopExpensesChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart } from "lucide-react";

interface TopExpensesWidgetProps {
  data: TopExpenseCategory[];
  periodLabel: string;
}

export function TopExpensesWidget({
  data,
  periodLabel,
}: TopExpensesWidgetProps) {
  const isEmpty = data.length === 0;

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-orange-500 dark:text-orange-400" />
          <div className="flex-1">
            <CardTitle className="text-slate-900 dark:text-slate-100">
              Top Expenses
            </CardTitle>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {periodLabel}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No expense data for this period
          </p>
        ) : (
          <TopExpensesChart data={data} />
        )}
      </CardContent>
    </Card>
  );
}
