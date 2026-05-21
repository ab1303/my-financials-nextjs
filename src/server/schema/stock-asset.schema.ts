import { object, string, z } from 'zod';

// Enum validations
const currencyEnum = z.enum(['AUD', 'USD']);
const investmentTermEnum = z.enum(['SHORT_TERM', 'MID_TERM', 'LONG_TERM']);

// Cash balance schema (for brokerage cash holdings)
export const cashBalanceEntrySchema = object({
  accountId: string({ required_error: 'Account ID is required' }),
  currency: currencyEnum,
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .nonnegative('Amount must be greater than or equal to 0'),
});

// Single holding schema (used in snapshot creation)
export const stockHoldingEntrySchema = object({
  ticker: string({ required_error: 'Ticker symbol is required' })
    .min(1, 'Ticker is required')
    .max(10, 'Ticker must be 10 characters or less'),
  companyName: string({ required_error: 'Company name is required' })
    .min(1, 'Company name is required')
    .max(255, 'Company name must be 255 characters or less'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0'),
  buyPrice: z.coerce
    .number({ invalid_type_error: 'Buy price must be a number' })
    .positive('Buy price must be greater than 0'),
  buyDate: z.coerce.date().optional().nullable(),
  currentPrice: z.coerce
    .number({ invalid_type_error: 'Current price must be a number' })
    .positive('Current price must be greater than 0'),
  currency: currencyEnum,
  plannedTerm: investmentTermEnum,
  salePrice: z.coerce
    .number({ invalid_type_error: 'Sale price must be a number' })
    .positive('Sale price must be greater than 0')
    .optional()
    .nullable(),
  saleDate: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.coerce.date().optional().nullable()
  ),
  soldQuantity: z.coerce
    .number({ invalid_type_error: 'Sold quantity must be a number' })
    .positive('Sold quantity must be greater than 0')
    .optional()
    .nullable(),
  accountId: string({ required_error: 'Account is required' }),
});

// Create snapshot with multiple holdings
export const createStockSnapshotSchema = object({
  snapshotDate: z.coerce.date({ required_error: 'Snapshot date is required' }),
  usdToAudRate: z.coerce.number().positive().optional().nullable(),
  holdings: z.array(stockHoldingEntrySchema).optional(),
  cashBalances: z.array(cashBalanceEntrySchema).optional(),
}).refine(
  data => (data.holdings?.length ?? 0) + (data.cashBalances?.length ?? 0) > 0,
  {
    message: 'Add at least one holding or cash balance',
    path: ['holdings'],
  }
);

// Create a single holding (add to existing snapshot)
export const createStockHoldingSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
}).merge(stockHoldingEntrySchema);

// Update an existing holding
export const updateStockHoldingSchema = object({
  holdingId: string({ required_error: 'Holding ID is required' }),
  ticker: string().min(1).max(10).optional(),
  companyName: string().min(1).max(255).optional(),
  quantity: z.coerce.number().positive().optional(),
  buyPrice: z.coerce.number().positive().optional(),
  buyDate: z.coerce.date().optional(),
  currentPrice: z.coerce.number().positive().optional(),
  currency: currencyEnum.optional(),
  plannedTerm: investmentTermEnum.optional(),
  salePrice: z.coerce.number().positive().optional().nullable(),
  saleDate: z.preprocess(
    (val) => (val === '' || val == null ? undefined : val),
    z.coerce.date().optional().nullable()
  ),
  soldQuantity: z.coerce.number().positive().optional().nullable(),
});

// Delete schemas
export const deleteSnapshotSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
});

export const deleteHoldingSchema = object({
  holdingId: string({ required_error: 'Holding ID is required' }),
});

// Query schemas
export const getSnapshotsSchema = object({
  calendarYearId: string().optional(),
  calendarType: z.enum(['FISCAL', 'ANNUAL', 'ZAKAT']).optional(),
});

export const getSnapshotByIdSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
});

// Update snapshot FX rate (backfill for existing snapshots)
export const updateSnapshotFxRateSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
  usdToAudRate: z.coerce.number().positive().nullable(),
});

// Export inferred types
export type StockHoldingEntryInput = z.infer<typeof stockHoldingEntrySchema>;
export type CashBalanceEntryInput = z.infer<typeof cashBalanceEntrySchema>;
export type UpdateSnapshotFxRateInput = z.infer<typeof updateSnapshotFxRateSchema>;
export type CreateStockSnapshotInput = z.infer<
  typeof createStockSnapshotSchema
>;
export type CreateStockHoldingInput = z.infer<typeof createStockHoldingSchema>;
export type UpdateStockHoldingInput = z.infer<typeof updateStockHoldingSchema>;
export type DeleteSnapshotInput = z.infer<typeof deleteSnapshotSchema>;
export type DeleteHoldingInput = z.infer<typeof deleteHoldingSchema>;
export type GetSnapshotsInput = z.infer<typeof getSnapshotsSchema>;
export type GetSnapshotByIdInput = z.infer<typeof getSnapshotByIdSchema>;
