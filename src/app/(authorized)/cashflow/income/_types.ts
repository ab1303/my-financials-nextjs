export const INCOME_SOURCE_LABELS: Record<string, string> = new Proxy(
  {},
  {
    get: (_, property) => (typeof property === 'string' ? property : ''),
  },
) as Record<string, string>;
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
  incomeSourceId: string;
  incomeSourceName: string;
  incomeLedgerId: string;
};

