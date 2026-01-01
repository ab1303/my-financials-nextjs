import type { IncomeSourceEnumType } from '@prisma/client';

export type ServerActionType<T = unknown> = {
  success: boolean;
  error: unknown;
  data?: T;
};

export type IncomeType = {
  id: string;
  calendarId: string;
  userId: string;
  totalIncome: number;
  entries: Array<IncomeEntryType>;
};

export type IncomeEntryType = {
  id: string;
  dateEarned: Date;
  amount: number;
  source: IncomeSourceEnumType;
  incomeId: string;
};

export const INCOME_SOURCE_LABELS: Record<IncomeSourceEnumType, string> = {
  EMPLOYMENT: 'Employment',
  STOCKS: 'Stocks',
  BONDS: 'Bonds',
  RENTAL: 'Rental',
  BUSINESS: 'Business',
  FREELANCE: 'Freelance',
  OTHER: 'Other',
};
