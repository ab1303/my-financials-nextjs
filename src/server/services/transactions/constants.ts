export const REIMBURSEMENT_CATEGORY = 'Reimbursement' as const;

/**
 * CREDIT transaction categories that map to status = EXCLUDED at import time.
 * These transactions write no downstream record (no IncomeRecord, no MonthlyExpenseSummary).
 * Users can later promote a Reimbursement row by setting its offset category.
 */
export const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'] as const;
