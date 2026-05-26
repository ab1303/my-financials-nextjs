export const REIMBURSEMENT_CATEGORY = 'Reimbursement' as const;

export const TRANSFER_CATEGORY = 'Transfer' as const;

/**
 * CREDIT transaction categories that map to status = EXCLUDED at import time.
 * These transactions write no downstream record (no IncomeRecord, no MonthlyExpenseSummary).
 * Users can later promote a Reimbursement row by setting its offset category.
 */
export const EXCLUDED_CREDIT_LABELS = ['Transfer', 'Excluded', 'Reimbursement'] as const;

/**
 * DEBIT transaction categories that map to status=EXCLUDED at import time.
 * Transfer debits must not create MonthlyExpenseSummary entries.
 */
export const EXCLUDED_DEBIT_LABELS = ['Transfer'] as const;

/**
 * Categories that must be excluded from all expense and income aggregation queries.
 * Single source of truth for all cashflow query guards across the app.
 */
export const EXCLUDED_FROM_EXPENSE_AGGREGATION = [TRANSFER_CATEGORY] as const;

/**
 * Number of days after which a transfer is considered orphaned if not linked to a counterpart.
 * Used to identify stale unresolved transfers that may inflate expense/income figures.
 */
export const ORPHAN_RESOLUTION_DAYS = 30;
