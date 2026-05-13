export type ExpenseCategoryModel = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
};

export type ExpenseModel = {
  id: string;
  calendarId: string;
  userId: string;
};

export type ExpenseEntryModel = {
  id: string;
  month: number; // 1-12 (January = 1, December = 12)
  amount: number;
  categoryId: string;
  expenseLedgerId: string;
  categoryName?: string; // Populated from join
  importImageId?: string | null; // Link to imported image
  importImage?: {
    id: string;
    fileName: string;
  } | null;
};

// More flexible type for service layer operations
export type ExpenseEntryInput = {
  id?: string;
  month: number;
  amount: number;
  categoryId: string;
  expenseLedgerId?: string;
};

// Type for monthly aggregation results
export type MonthlyExpenseSummary = {
  month: number; // 1-12
  totalAmount: number;
  entryCount: number;
};

// Type for category drill-down results
export type CategoryBreakdown = {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
};

// Type for client components
export type ExpenseEntryWithCategory = ExpenseEntryModel & {
  categoryName: string;
};
