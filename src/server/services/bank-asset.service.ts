import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

// Bank Account Service

export const createBankAccount = async (input: {
  name: string;
  bankId: string;
  userId: string;
}) => {
  return await prisma.bankAccount.create({
    data: input,
    include: {
      bank: true,
    },
  });
};

export const getBankAccounts = async (userId: string, bankId?: string) => {
  return await prisma.bankAccount.findMany({
    where: {
      userId,
      ...(bankId && { bankId }),
    },
    include: {
      bank: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
};

export const getBankAccountById = async (accountId: string, userId: string) => {
  return await prisma.bankAccount.findFirst({
    where: {
      id: accountId,
      userId,
    },
    include: {
      bank: true,
    },
  });
};

export const updateBankAccount = async (input: {
  accountId: string;
  name: string;
  userId: string;
}) => {
  // Verify the account belongs to the user
  const account = await prisma.bankAccount.findFirst({
    where: {
      id: input.accountId,
      userId: input.userId,
    },
  });

  if (!account) {
    throw new Error('Account not found or does not belong to user');
  }

  // Check if new name is unique within the same bank for this user
  // (allow if it's the same account being updated)
  const existingAccount = await prisma.bankAccount.findFirst({
    where: {
      name: input.name,
      bankId: account.bankId,
      userId: input.userId,
      id: {
        not: input.accountId, // Don't check against itself
      },
    },
  });

  if (existingAccount) {
    throw new Error(
      `Account name "${input.name}" already exists for this bank`,
    );
  }

  return await prisma.bankAccount.update({
    where: {
      id: input.accountId,
    },
    data: {
      name: input.name,
    },
    include: {
      bank: true,
    },
  });
};

// Bank Asset Snapshot Service

export const createBankAssetSnapshot = async (
  userId: string,
  snapshotDate: Date,
  entries: Array<{ accountId: string; balance: number }>,
) => {
  // Create snapshot with entries in a transaction
  return await prisma.$transaction(async (tx) => {
    // Verify all accounts belong to the user
    const accounts = await tx.bankAccount.findMany({
      where: {
        id: { in: entries.map((e) => e.accountId) },
        userId,
      },
    });

    if (accounts.length !== entries.length) {
      throw new Error(
        'One or more accounts not found or do not belong to user',
      );
    }

    // Create the snapshot
    const snapshot = await tx.bankAssetSnapshot.create({
      data: {
        snapshotDate,
        userId,
        entries: {
          create: entries.map((entry) => ({
            accountId: entry.accountId,
            balance: entry.balance,
          })),
        },
      },
      include: {
        entries: {
          include: {
            account: {
              include: {
                bank: true,
              },
            },
          },
        },
      },
    });

    return snapshot;
  });
};

export const getBankAssetSnapshots = async (
  userId: string,
  filters?: {
    calendarYearId?: string;
    fromDate?: Date;
    toDate?: Date;
  },
) => {
  const where: Prisma.BankAssetSnapshotWhereInput = {
    userId,
  };

  if (filters?.fromDate || filters?.toDate) {
    where.snapshotDate = {};
    if (filters.fromDate) {
      where.snapshotDate.gte = filters.fromDate;
    }
    if (filters.toDate) {
      where.snapshotDate.lte = filters.toDate;
    }
  }

  return await prisma.bankAssetSnapshot.findMany({
    where,
    include: {
      entries: {
        include: {
          account: {
            include: {
              bank: true,
            },
          },
        },
        orderBy: {
          account: {
            name: 'asc',
          },
        },
      },
    },
    orderBy: {
      snapshotDate: 'desc',
    },
  });
};

export const getMostRecentSnapshot = async (
  userId: string,
  filters?: {
    calendarYearId?: string;
    fromDate?: Date;
    toDate?: Date;
  },
) => {
  const snapshots = await getBankAssetSnapshots(userId, filters);
  return snapshots[0] || null;
};

export const getSnapshotById = async (snapshotId: string, userId: string) => {
  return await prisma.bankAssetSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId,
    },
    include: {
      entries: {
        include: {
          account: {
            include: {
              bank: true,
            },
          },
        },
        orderBy: {
          account: {
            name: 'asc',
          },
        },
      },
    },
  });
};

export const updateBankAssetEntry = async (
  entryId: string,
  balance: number,
  userId: string,
) => {
  // Verify the entry belongs to the user's snapshot
  const entry = await prisma.bankAssetEntry.findFirst({
    where: {
      id: entryId,
      snapshot: {
        userId,
      },
    },
  });

  if (!entry) {
    throw new Error('Entry not found or does not belong to user');
  }

  return await prisma.bankAssetEntry.update({
    where: {
      id: entryId,
    },
    data: {
      balance,
    },
    include: {
      account: {
        include: {
          bank: true,
        },
      },
    },
  });
};

export const deleteBankAssetEntry = async (entryId: string, userId: string) => {
  // Verify the entry belongs to the user's snapshot
  const entry = await prisma.bankAssetEntry.findFirst({
    where: {
      id: entryId,
      snapshot: {
        userId,
      },
    },
  });

  if (!entry) {
    throw new Error('Entry not found or does not belong to user');
  }

  return await prisma.bankAssetEntry.delete({
    where: {
      id: entryId,
    },
  });
};

export const deleteBankAssetSnapshot = async (
  snapshotId: string,
  userId: string,
) => {
  // Verify the snapshot belongs to the user
  const snapshot = await prisma.bankAssetSnapshot.findFirst({
    where: {
      id: snapshotId,
      userId,
    },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found or does not belong to user');
  }

  // Delete snapshot (cascade will delete entries)
  return await prisma.bankAssetSnapshot.delete({
    where: {
      id: snapshotId,
    },
  });
};

// Get aggregated totals for a snapshot
export const getSnapshotTotals = async (snapshotId: string, userId: string) => {
  const snapshot = await getSnapshotById(snapshotId, userId);

  if (!snapshot) {
    return null;
  }

  // Calculate totals by bank
  const bankTotals = snapshot.entries.reduce(
    (acc, entry) => {
      const bankId = entry.account.bankId;
      const bankName = entry.account.bank.name;

      if (!acc[bankId]) {
        acc[bankId] = {
          bankId,
          bankName,
          total: 0,
          accounts: [],
        };
      }

      acc[bankId].total += Number(entry.balance);
      acc[bankId].accounts.push({
        accountId: entry.accountId,
        accountName: entry.account.name,
        balance: Number(entry.balance),
      });

      return acc;
    },
    {} as Record<
      string,
      {
        bankId: string;
        bankName: string;
        total: number;
        accounts: Array<{
          accountId: string;
          accountName: string;
          balance: number;
        }>;
      }
    >,
  );

  const grandTotal = Object.values(bankTotals).reduce(
    (sum, bank) => sum + bank.total,
    0,
  );

  return {
    snapshotId: snapshot.id,
    snapshotDate: snapshot.snapshotDate,
    grandTotal,
    banks: Object.values(bankTotals).sort((a, b) =>
      a.bankName.localeCompare(b.bankName),
    ),
  };
};
