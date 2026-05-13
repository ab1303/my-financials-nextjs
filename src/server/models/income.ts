import type { IncomeSourceEnumType } from '@prisma/client';

export type IncomeModel = {
  id: string;
  calendarId: string;
  userId: string;
};

export type IncomeEntryModel = {
  id: string;
  dateEarned: Date;
  amount: number;
  source: IncomeSourceEnumType;
  incomeLedgerId: string;
};

// More flexible type for service layer operations
export type IncomeEntryInput = {
  id?: string;
  dateEarned: Date;
  amount: number;
  source: IncomeSourceEnumType;
  incomeLedgerId?: string;
};

// Type for monthly aggregation results
export type MonthlyIncomeSummary = {
  month: number; // 1-12
  year: number;
  totalAmount: number;
  entryCount: number;
};

// Type for source drill-down results
export type SourceBreakdown = {
  source: IncomeSourceEnumType;
  amount: number;
  percentage: number;
  entryCount: number;
};
