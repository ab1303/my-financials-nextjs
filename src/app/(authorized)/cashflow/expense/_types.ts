import type {
  ExpenseModel,
  ExpenseEntryModel,
  ExpenseEntryWithCategory,
  MonthlyExpenseSummary,
} from '@/server/models/expense';

// State for the expense table
export type ExpenseData = {
  calendarId: string;
  userId: string;
  monthlySummaries: MonthlyExpenseSummary[];
  totalAmount: number;
};

// State for category breakdown modal
export type ExpenseEntryState = {
  data: ExpenseEntryWithCategory[];
  isLoading?: boolean;
  error?: string | null;
};

export type MonthData = {
  month: number;
  monthName: string;
  totalAmount: number;
  entryCount: number;
};
