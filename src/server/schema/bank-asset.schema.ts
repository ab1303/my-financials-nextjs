import type { TypeOf } from 'zod';
import { object, string, z, array } from 'zod';

// Schema for creating a bank account
export const createBankAccountSchema = object({
  name: string({ required_error: 'Account name is required' }).max(
    100,
    'Account name must be less than 100 characters',
  ),
  bankId: string({ required_error: 'Bank is required' }),
});

// Schema for a single bank asset entry (account balance in a snapshot)
export const bankAssetEntrySchema = object({
  accountId: string({ required_error: 'Account is required' }),
  balance: z
    .number({ required_error: 'Balance is required' })
    .min(0, 'Balance must be greater than or equal to 0'),
});

// Schema for creating a bank asset snapshot with multiple entries
export const createBankAssetSnapshotSchema = object({
  snapshotDate: z.coerce.date({ required_error: 'Snapshot date is required' }),
  entries: array(bankAssetEntrySchema).min(
    1,
    'At least one account entry is required',
  ),
});

// Schema for updating a single entry balance
export const updateBankAssetEntrySchema = object({
  entryId: string({ required_error: 'Entry ID is required' }),
  balance: z
    .number({ required_error: 'Balance is required' })
    .min(0, 'Balance must be greater than or equal to 0'),
});

// Schema for deleting a snapshot
export const deleteSnapshotSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
});

// Schema for deleting an entry
export const deleteEntrySchema = object({
  entryId: string({ required_error: 'Entry ID is required' }),
});

// Schema for getting snapshots with filters
export const getSnapshotsSchema = object({
  calendarYearId: string().optional(),
  calendarType: z.enum(['FISCAL', 'ANNUAL', 'ZAKAT']).optional(),
});

// Schema for getting a specific snapshot
export const getSnapshotByIdSchema = object({
  snapshotId: string({ required_error: 'Snapshot ID is required' }),
});

// Schema for getting user's bank accounts
export const getBankAccountsSchema = object({
  bankId: string().optional(),
});

export type CreateBankAccountInput = TypeOf<typeof createBankAccountSchema>;
export type BankAssetEntryInput = TypeOf<typeof bankAssetEntrySchema>;
export type CreateBankAssetSnapshotInput = TypeOf<
  typeof createBankAssetSnapshotSchema
>;
export type UpdateBankAssetEntryInput = TypeOf<
  typeof updateBankAssetEntrySchema
>;
export type DeleteSnapshotInput = TypeOf<typeof deleteSnapshotSchema>;
export type DeleteEntryInput = TypeOf<typeof deleteEntrySchema>;
export type GetSnapshotsInput = TypeOf<typeof getSnapshotsSchema>;
export type GetSnapshotByIdInput = TypeOf<typeof getSnapshotByIdSchema>;
export type GetBankAccountsInput = TypeOf<typeof getBankAccountsSchema>;
