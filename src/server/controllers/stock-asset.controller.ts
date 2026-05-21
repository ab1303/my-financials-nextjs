import { handleCaughtError, prisma } from '@/server/utils/prisma';
import {
  createStockSnapshot,
  getStockSnapshots,
  getMostRecentSnapshot,
  getSnapshotById,
  getSnapshotTotals,
  createStockHolding,
  updateStockHolding,
  deleteStockHolding,
  deleteStockSnapshot,
  getBrokerageAccounts,
  createBrokerageSubAccount,
  updateSnapshotFxRate,
  updateStockSnapshot,
} from '@/server/services/stock-asset.service';

import type {
  CreateStockSnapshotInput,
  CreateStockHoldingInput,
  UpdateStockHoldingInput,
  DeleteSnapshotInput,
  DeleteHoldingInput,
  GetSnapshotsInput,
  GetSnapshotByIdInput,
  UpdateSnapshotFxRateInput,
} from '@/server/schema/stock-asset.schema';

// Helper: Resolve calendarYearId to date range
async function resolveDateRange(calendarYearId?: string) {
  if (!calendarYearId) return {};

  const calendarYear = await prisma.calendarYear.findUnique({
    where: { id: calendarYearId },
  });

  if (!calendarYear) return {};

  return {
    fromDate: new Date(calendarYear.fromYear, calendarYear.fromMonth - 1, 1),
    toDate: new Date(calendarYear.toYear, calendarYear.toMonth, 0),
  };
}

// Snapshot Controllers

export const createSnapshotHandler = async ({
  input,
  userId,
}: {
  input: CreateStockSnapshotInput;
  userId: string;
}) => {
  try {
    const snapshot = await createStockSnapshot(userId, input);
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

// Phase 5: Update snapshot with holdings and cash in atomic transaction
export const updateSnapshotHandler = async ({
  input,
  userId,
}: {
  input: CreateStockSnapshotInput & { snapshotId: string };
  userId: string;
}) => {
  try {
    const snapshot = await updateStockSnapshot(userId, input);
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
    const dateRange = await resolveDateRange(input.calendarYearId);

    const snapshots = await getStockSnapshots(userId, {
      calendarYearId: input.calendarYearId,
      ...dateRange,
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
    const dateRange = await resolveDateRange(input.calendarYearId);

    const snapshot = await getMostRecentSnapshot(userId, {
      calendarYearId: input.calendarYearId,
      ...dateRange,
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

export const deleteSnapshotHandler = async ({
  input,
  userId,
}: {
  input: DeleteSnapshotInput;
  userId: string;
}) => {
  try {
    await deleteStockSnapshot(input.snapshotId, userId);
    return {
      status: 'success',
      message: 'Snapshot deleted successfully',
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

// Holding Controllers

export const createHoldingHandler = async ({
  input,
  userId,
}: {
  input: CreateStockHoldingInput;
  userId: string;
}) => {
  try {
    const holding = await createStockHolding(userId, input);
    return {
      status: 'success',
      data: {
        holding,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const updateHoldingHandler = async ({
  input,
  userId,
}: {
  input: UpdateStockHoldingInput;
  userId: string;
}) => {
  try {
    const holding = await updateStockHolding(userId, input);
    return {
      status: 'success',
      data: {
        holding,
      },
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const deleteHoldingHandler = async ({
  input,
  userId,
}: {
  input: DeleteHoldingInput;
  userId: string;
}) => {
  try {
    await deleteStockHolding(input.holdingId, userId);
    return {
      status: 'success',
      message: 'Holding deleted successfully',
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const getBrokerageAccountsHandler = async ({
  userId,
}: {
  userId: string;
}) => {
  try {
    return await getBrokerageAccounts(userId);
  } catch (e) {
    handleCaughtError(e);
  }
};

export const createBrokerageSubAccountHandler = async ({
  input,
  userId,
}: {
  input: { businessId: string; name: string };
  userId: string;
}) => {
  try {
    const account = await createBrokerageSubAccount(userId, input);
    return {
      id: account.id,
      name: account.name,
      institution: account.institution,
    };
  } catch (e) {
    handleCaughtError(e);
  }
};

export const updateSnapshotFxRateHandler = async ({
  input,
  userId,
}: {
  input: UpdateSnapshotFxRateInput;
  userId: string;
}) => {
  try {
    await updateSnapshotFxRate(input.snapshotId, userId, input.usdToAudRate);
    return { status: 'success' };
  } catch (e) {
    handleCaughtError(e);
  }
};
