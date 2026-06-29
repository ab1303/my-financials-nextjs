import { handleCaughtError } from '@/server/db/client';
import type {
  AddEntryToSnapshotInput,
  CreateBankAccountInput,
  CreateBankAssetSnapshotInput,
  DeleteEntryInput,
  DeleteSnapshotInput,
  GetBankAccountsInput,
  GetSnapshotByIdInput,
  GetSnapshotsInput,
  UpdateBankAssetEntryInput,
} from '@/server/schema/bank-asset.schema';
import {
  addEntryToSnapshot,
  createBankAccount,
  createBankAssetSnapshot,
  deleteBankAssetEntry,
  deleteBankAssetSnapshot,
  getBankAccounts,
  getBankAssetSnapshots,
  getMostRecentSnapshot,
  getSnapshotById,
  getSnapshotTotals,
  updateBankAssetEntry,
} from '@/server/services/bank-asset.service';

// Bank Account Controllers

export const createBankAccountHandler = async ({
  input,
  userId,
}: {
  input: CreateBankAccountInput;
  userId: string;
}) => {
  try {
    const account = await createBankAccount({
      name: input.name,
      institutionId: input.institutionId,
      userId,
    });
    return {
      status: 'success',
      data: {
        account,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getBankAccountsHandler = async ({
  input,
  userId,
}: {
  input: GetBankAccountsInput;
  userId: string;
}) => {
  try {
    const accounts = await getBankAccounts(userId, input.institutionId);
    return accounts;
  } catch (e) {
    handleCaughtError(e);
  }
};

// Bank Asset Snapshot Controllers

export const createSnapshotHandler = async ({
  input,
  userId,
}: {
  input: CreateBankAssetSnapshotInput;
  userId: string;
}) => {
  try {
    const snapshot = await createBankAssetSnapshot(
      userId,
      input.snapshotDate,
      input.entries,
    );
    return {
      status: 'success',
      data: {
        snapshot,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getSnapshotsHandler = async ({
  input,
  userId,
}: {
  input: GetSnapshotsInput;
  userId: string;
}) => {
  try {
    // If calendarYearId is provided, we need to get the date range
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (input.calendarYearId) {
      // Import calendar year service to get date range
      const { prisma } = await import('@/server/db/client');
      const calendarYear = await prisma.calendarYear.findUnique({
        where: { id: input.calendarYearId },
      });

      if (calendarYear) {
        fromDate = new Date(
          calendarYear.fromYear,
          calendarYear.fromMonth - 1,
          1,
        );
        toDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0);
      }
    }

    const snapshots = await getBankAssetSnapshots(userId, {
      calendarYearId: input.calendarYearId,
      fromDate,
      toDate,
    });

    return snapshots;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getMostRecentSnapshotHandler = async ({
  input,
  userId,
}: {
  input: GetSnapshotsInput;
  userId: string;
}) => {
  try {
    // If calendarYearId is provided, we need to get the date range
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (input.calendarYearId) {
      const { prisma } = await import('@/server/db/client');
      const calendarYear = await prisma.calendarYear.findUnique({
        where: { id: input.calendarYearId },
      });

      if (calendarYear) {
        fromDate = new Date(
          calendarYear.fromYear,
          calendarYear.fromMonth - 1,
          1,
        );
        toDate = new Date(calendarYear.toYear, calendarYear.toMonth, 0);
      }
    }

    const snapshot = await getMostRecentSnapshot(userId, {
      calendarYearId: input.calendarYearId,
      fromDate,
      toDate,
    });

    return snapshot;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getSnapshotByIdHandler = async ({
  input,
  userId,
}: {
  input: GetSnapshotByIdInput;
  userId: string;
}) => {
  try {
    const snapshot = await getSnapshotById(input.snapshotId, userId);
    return snapshot;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getSnapshotTotalsHandler = async ({
  input,
  userId,
}: {
  input: GetSnapshotByIdInput;
  userId: string;
}) => {
  try {
    const totals = await getSnapshotTotals(input.snapshotId, userId);
    return totals;
  } catch (e) {
    handleCaughtError(e);
  }
};

export const updateEntryHandler = async ({
  input,
  userId,
}: {
  input: UpdateBankAssetEntryInput;
  userId: string;
}) => {
  try {
    const entry = await updateBankAssetEntry(
      input.entryId,
      input.balance,
      userId,
    );
    return {
      status: 'success',
      data: {
        entry,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const deleteEntryHandler = async ({
  input,
  userId,
}: {
  input: DeleteEntryInput;
  userId: string;
}) => {
  try {
    await deleteBankAssetEntry(input.entryId, userId);
    return {
      status: 'success',
      message: 'Entry deleted successfully',
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const deleteSnapshotHandler = async ({
  input,
  userId,
}: {
  input: DeleteSnapshotInput;
  userId: string;
}) => {
  try {
    await deleteBankAssetSnapshot(input.snapshotId, userId);
    return {
      status: 'success',
      message: 'Snapshot deleted successfully',
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const addEntryToSnapshotHandler = async ({
  input,
  userId,
}: {
  input: AddEntryToSnapshotInput;
  userId: string;
}) => {
  try {
    const record = await addEntryToSnapshot(
      input.snapshotId,
      input.accountId,
      input.balance,
      userId,
    );
    return { status: 'success', data: { record } };
  } catch (e) {
    handleCaughtError(e);
  }
};
