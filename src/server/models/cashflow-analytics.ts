import type { CategoryBreakdown } from './expense';
import type { SourceBreakdown } from './income';

export type MonthlyTrendPoint = {
  month: number; // 1–12
  year: number;
  label: string; // e.g. "Jul '24"
  income: number;
  expenses: number;
  net: number; // income - expenses
};

export type CashflowKPIs = {
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  savingsRate: number; // (net / income) * 100; 0 if income = 0
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
};

export type CashflowAnalyticsData = {
  kpis: CashflowKPIs;
  monthlyTrend: MonthlyTrendPoint[]; // sorted by year asc, month asc
  expenseCategories: CategoryBreakdown[]; // sorted by amount desc
  incomeSources: SourceBreakdown[]; // sorted by amount desc
};
