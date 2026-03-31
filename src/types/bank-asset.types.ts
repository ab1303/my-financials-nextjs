// Bank Assets Feature - Type Definitions
// These types extend Prisma generated types with computed fields for frontend use

import type {
  BankAccount,
  BankAssetSnapshot,
  BankAssetEntry,
  Business,
} from '@prisma/client';

// Extended types with relations

export type BankAccountWithBank = BankAccount & {
  bank: Pick<Business, 'id' | 'name'>;
};

export type BankAssetEntryWithAccount = BankAssetEntry & {
  account: BankAccountWithBank;
  importImage?: { id: string; fileName: string } | null;
};

export type BankAssetSnapshotWithEntries = BankAssetSnapshot & {
  entries: BankAssetEntryWithAccount[];
};

// Aggregated types for display

export type BankTotalSummary = {
  bankId: string;
  bankName: string;
  total: number;
  accounts: AccountBalance[];
};

export type AccountBalance = {
  accountId: string;
  accountName: string;
  balance: number;
};

export type SnapshotTotals = {
  snapshotId: string;
  snapshotDate: Date;
  grandTotal: number;
  banks: BankTotalSummary[];
};

// Form types for snapshot creation

export type SnapshotEntryForm = {
  accountId: string;
  accountName?: string;
  bankId: string;
  bankName?: string;
  balance: number;
  isNewAccount?: boolean;
};

export type SnapshotFormData = {
  snapshotDate: Date;
  entries: SnapshotEntryForm[];
};

// Options for CreatableSelect

export type BankAccountOption = {
  value: string;
  label: string;
  bankId: string;
  isNew?: boolean;
};

export type BankOption = {
  value: string;
  label: string;
};

// Calendar year filter types

export type CalendarType = 'FISCAL' | 'ANNUAL' | 'ZAKAT';

export type CalendarYearFilter = {
  id: string;
  type: CalendarType;
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
};

// Accordion state types

export type BankAccordionItem = {
  bankId: string;
  bankName: string;
  total: number;
  accounts: AccountBalance[];
  isExpanded: boolean;
};

// API response types

export type CreateAccountResponse = {
  status: 'success';
  data: {
    account: BankAccountWithBank;
  };
};

export type CreateSnapshotResponse = {
  status: 'success';
  data: {
    snapshot: BankAssetSnapshotWithEntries;
  };
};

export type UpdateEntryResponse = {
  status: 'success';
  data: {
    entry: BankAssetEntryWithAccount;
  };
};

export type DeleteResponse = {
  status: 'success';
  message: string;
};
