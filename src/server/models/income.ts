export type IncomeModel = {
  id: string;
  calendarId: string;
  userId: string;
};

export type IncomeEntryModel = {
  id: string;
  dateEarned: Date;
  amount: number;
  incomeSourceId: string;
  incomeSourceName: string;
  incomeLedgerId: string;
};

export type IncomeEntryInput = {
  id?: string;
  dateEarned: Date;
  amount: number;
  incomeSourceId: string;
  incomeLedgerId?: string;
};

export type MonthlyIncomeSummary = {
  month: number; // 1-12
  year: number;
  totalAmount: number;
  entryCount: number;
};

export type SourceBreakdown = {
  source: string;
  amount: number;
  percentage: number;
  entryCount: number;
};
