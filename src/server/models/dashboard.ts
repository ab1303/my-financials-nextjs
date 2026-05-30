/**
 * Dashboard Summary Response Model
 * Defines the shape of the GET /api/dashboard/summary response
 */

export interface DashboardSummaryResponse {
  netWorth: {
    latestTotal: number;
    latestCashTotal: number;
    latestStockTotal: number;
    latestCashDate: string | null;
    latestStockDate: string | null;
    sparklinePoints: Array<{ date: string; value: number }>;
  };
  cashflowYTD: {
    calendarYearId: string;
    calendarYearDescription: string;
    totalIncome: number;
    totalExpenses: number;
    netCashflow: number;
    savingsRate: number;
  } | null;
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    category: string;
    bankAccountName: string | null;
  }>;
}
