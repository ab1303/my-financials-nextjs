import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  createBankAssetSnapshot,
  getBankAssetSnapshots,
  getSnapshotById,
  updateBankAssetEntry,
  addEntryToSnapshot,
  getSnapshotTotals,
} from '@/server/services/bank-asset.service';

// Helper: reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

describe('bank-asset.service', () => {
  describe('createBankAccount', () => {
    it('creates with correct data (institutionId mapped from bankId)', async () => {
      const input = { name: 'Checking', bankId: 'b1', userId: 'u1' };
      const result = { id: 'a1', name: 'Checking', institutionId: 'b1', userId: 'u1', institution: { id: 'b1', name: 'Bank' } };
      prismaMock.financialAccount.create.mockResolvedValue(result as never);
      const out = await createBankAccount(input);
      expect(prismaMock.financialAccount.create).toHaveBeenCalledWith({
        data: { name: 'Checking', institutionId: 'b1', userId: 'u1' },
        include: { institution: true },
      });
      expect(out).toBe(result);
    });
  });

  describe('getBankAccounts', () => {
    it('returns all accounts for user when no bankId filter', async () => {
      const accounts = [{ id: 'a1', name: 'Checking', institution: { id: 'b1', name: 'Bank' } }];
      prismaMock.financialAccount.findMany.mockResolvedValue(accounts as never);
      const out = await getBankAccounts('u1');
      expect(prismaMock.financialAccount.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        include: { institution: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
      expect(out).toBe(accounts);
    });
    it('filters by institutionId when bankId provided', async () => {
      prismaMock.financialAccount.findMany.mockResolvedValue([] as never);
      await getBankAccounts('u1', 'b2');
      expect(prismaMock.financialAccount.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', institutionId: 'b2' },
        include: { institution: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getBankAccountById', () => {
    it('returns account when found', async () => {
      const account = { id: 'a1', name: 'Checking', institution: { id: 'b1', name: 'Bank' } };
      prismaMock.financialAccount.findFirst.mockResolvedValue(account as never);
      const out = await getBankAccountById('a1', 'u1');
      expect(prismaMock.financialAccount.findFirst).toHaveBeenCalledWith({
        where: { id: 'a1', userId: 'u1' },
        include: { institution: true },
      });
      expect(out).toBe(account);
    });
    it('returns null when not found', async () => {
      prismaMock.financialAccount.findFirst.mockResolvedValue(null);
      const out = await getBankAccountById('a2', 'u1');
      expect(out).toBeNull();
    });
  });

  describe('updateBankAccount', () => {
    it('throws "Account not found" when account does not exist', async () => {
      prismaMock.financialAccount.findFirst.mockResolvedValueOnce(null);
      await expect(
        updateBankAccount({ accountId: 'a1', name: 'New', userId: 'u1' })
      ).rejects.toThrow('Account not found');
    });
    it('throws duplicate name error when name already taken for same institution', async () => {
      const account = { id: 'a1', institutionId: 'b1', userId: 'u1' };
      prismaMock.financialAccount.findFirst
        .mockResolvedValueOnce(account as never) // account exists
        .mockResolvedValueOnce({ id: 'a2' } as never); // duplicate exists
      await expect(
        updateBankAccount({ accountId: 'a1', name: 'Dup', userId: 'u1' })
      ).rejects.toThrow('Account name "Dup" already exists for this bank');
    });
    it('updates and returns account when valid', async () => {
      const account = { id: 'a1', institutionId: 'b1', userId: 'u1' };
      const updated = { id: 'a1', name: 'New', institution: { id: 'b1', name: 'Bank' } };
      prismaMock.financialAccount.findFirst
        .mockResolvedValueOnce(account as never) // account exists
        .mockResolvedValueOnce(null); // no duplicate
      prismaMock.financialAccount.update.mockResolvedValue(updated as never);
      const out = await updateBankAccount({ accountId: 'a1', name: 'New', userId: 'u1' });
      expect(prismaMock.financialAccount.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { name: 'New' },
        include: { institution: true },
      });
      expect(out).toBe(updated);
    });
  });

  describe('createBankAssetSnapshot', () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation((fn) => fn(prismaMock));
    });
    it('throws when account count mismatch (accounts not found)', async () => {
      prismaMock.financialAccount.findMany.mockResolvedValue([] as never);
      await expect(
        createBankAssetSnapshot('u1', new Date(), [
          { accountId: 'a1', balance: 100 },
        ])
      ).rejects.toThrow('One or more accounts not found or do not belong to user');
    });
    it('creates snapshot with entries when all accounts found', async () => {
      const accounts = [{ id: 'a1', userId: 'u1' }];
      const snapshot = { id: 's1', balanceRecords: [{ accountId: 'a1', balance: 100 }] };
      prismaMock.financialAccount.findMany.mockResolvedValue(accounts as never);
      prismaMock.bankBalanceSnapshot.create.mockResolvedValue(snapshot as never);
      const out = await createBankAssetSnapshot('u1', new Date(), [
        { accountId: 'a1', balance: 100 },
      ]);
      expect(prismaMock.bankBalanceSnapshot.create).toHaveBeenCalled();
      expect(out).toBe(snapshot);
    });
  });

  describe('getBankAssetSnapshots', () => {
    it('returns snapshots without date filter', async () => {
      const snapshots = [{ id: 's1', snapshotDate: new Date() }];
      prismaMock.bankBalanceSnapshot.findMany.mockResolvedValue(snapshots as never);
      const out = await getBankAssetSnapshots('u1');
      expect(prismaMock.bankBalanceSnapshot.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        include: {
          balanceRecords: {
            include: {
              account: { include: { institution: true } },
              importImage: { select: { id: true, fileName: true } },
            },
            orderBy: { account: { name: 'asc' } },
          },
        },
        orderBy: { snapshotDate: 'desc' },
      });
      expect(out).toBe(snapshots);
    });
    it('applies fromDate/toDate filter when provided', async () => {
      const fromDate = new Date('2023-01-01');
      const toDate = new Date('2023-12-31');
      prismaMock.bankBalanceSnapshot.findMany.mockResolvedValue([] as never);
      await getBankAssetSnapshots('u1', { fromDate, toDate });
      expect(prismaMock.bankBalanceSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'u1',
          snapshotDate: { gte: fromDate, lte: toDate },
        },
        include: {
          balanceRecords: {
            include: {
              account: { include: { institution: true } },
              importImage: { select: { id: true, fileName: true } },
            },
            orderBy: { account: { name: 'asc' } },
          },
        },
        orderBy: { snapshotDate: 'desc' },
      });
    });
  });

  describe('getSnapshotById', () => {
    it('returns snapshot when found', async () => {
      const snapshot = { id: 's1', balanceRecords: [] };
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue(snapshot as never);
      const out = await getSnapshotById('s1', 'u1');
      expect(prismaMock.bankBalanceSnapshot.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', userId: 'u1' },
        include: {
          balanceRecords: {
            include: { account: { include: { institution: true } } },
            orderBy: { account: { name: 'asc' } },
          },
        },
      });
      expect(out).toBe(snapshot);
    });
    it('returns null when not found', async () => {
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue(null);
      const out = await getSnapshotById('s2', 'u1');
      expect(out).toBeNull();
    });
  });

  describe('updateBankAssetEntry', () => {
    it('throws when entry not found', async () => {
      prismaMock.bankBalanceRecord.findFirst.mockResolvedValue(null);
      await expect(updateBankAssetEntry('e1', 200, 'u1')).rejects.toThrow('Entry not found');
    });
    it('updates balance and returns entry with institution', async () => {
      const entry = { id: 'e1', snapshot: { userId: 'u1' } };
      const updated = { id: 'e1', balance: 200, account: { institution: { id: 'b1', name: 'Bank' } } };
      prismaMock.bankBalanceRecord.findFirst.mockResolvedValue(entry as never);
      prismaMock.bankBalanceRecord.update.mockResolvedValue(updated as never);
      const out = await updateBankAssetEntry('e1', 200, 'u1');
      expect(prismaMock.bankBalanceRecord.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { balance: 200 },
        include: { account: { include: { institution: true } } },
      });
      expect(out).toBe(updated);
    });
  });

  describe('addEntryToSnapshot', () => {
    it('throws when snapshot not found', async () => {
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue(null);
      await expect(addEntryToSnapshot('s1', 'a1', 100, 'u1')).rejects.toThrow('Snapshot not found');
    });
    it('throws when account not found', async () => {
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue({ id: 's1' } as never);
      prismaMock.financialAccount.findFirst.mockResolvedValue(null);
      await expect(addEntryToSnapshot('s1', 'a1', 100, 'u1')).rejects.toThrow('Account not found');
    });
    it('creates entry when both exist', async () => {
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue({ id: 's1' } as never);
      prismaMock.financialAccount.findFirst.mockResolvedValue({ id: 'a1' } as never);
      const created = { id: 'e1', balance: 100, account: { institution: { id: 'b1', name: 'Bank' } } };
      prismaMock.bankBalanceRecord.create.mockResolvedValue(created as never);
      const out = await addEntryToSnapshot('s1', 'a1', 100, 'u1');
      expect(prismaMock.bankBalanceRecord.create).toHaveBeenCalledWith({
        data: { snapshotId: 's1', accountId: 'a1', balance: 100 },
        include: { account: { include: { institution: true } } },
      });
      expect(out).toBe(created);
    });
  });

  describe('getSnapshotTotals', () => {
    it('returns null when snapshot not found', async () => {
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue(null);
      const out = await getSnapshotTotals('s1', 'u1');
      expect(out).toBeNull();
    });
    it('aggregates balances by institution correctly', async () => {
      const snapshot = {
        id: 's1',
        snapshotDate: new Date('2023-01-01'),
        balanceRecords: [
          {
            accountId: 'a1',
            balance: new Decimal(100),
            account: { id: 'a1', name: 'A', institutionId: 'b1', institution: { id: 'b1', name: 'BankA' } },
          },
          {
            accountId: 'a2',
            balance: new Decimal(200),
            account: { id: 'a2', name: 'B', institutionId: 'b2', institution: { id: 'b2', name: 'BankB' } },
          },
          {
            accountId: 'a3',
            balance: new Decimal(50),
            account: { id: 'a3', name: 'C', institutionId: 'b1', institution: { id: 'b1', name: 'BankA' } },
          },
        ],
      };
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue(snapshot as never);
      const out = await getSnapshotTotals('s1', 'u1');
      expect(out).toMatchObject({
        snapshotId: 's1',
        snapshotDate: new Date('2023-01-01'),
        grandTotal: 350,
        banks: [
          {
            bankId: 'b1',
            bankName: 'BankA',
            total: 150,
            accounts: [
              { accountId: 'a1', accountName: 'A', balance: 100 },
              { accountId: 'a3', accountName: 'C', balance: 50 },
            ],
          },
          {
            bankId: 'b2',
            bankName: 'BankB',
            total: 200,
            accounts: [
              { accountId: 'a2', accountName: 'B', balance: 200 },
            ],
          },
        ],
      });
    });
    it('sorts banks alphabetically by name', async () => {
      const snapshot = {
        id: 's1',
        snapshotDate: new Date('2023-01-01'),
        balanceRecords: [
          {
            accountId: 'a1',
            balance: new Decimal(100),
            account: { id: 'a1', name: 'A', institutionId: 'b2', institution: { id: 'b2', name: 'ZetaBank' } },
          },
          {
            accountId: 'a2',
            balance: new Decimal(200),
            account: { id: 'a2', name: 'B', institutionId: 'b1', institution: { id: 'b1', name: 'AlphaBank' } },
          },
        ],
      };
      prismaMock.bankBalanceSnapshot.findFirst.mockResolvedValue(snapshot as never);
      const out = await getSnapshotTotals('s1', 'u1');
      expect(out?.banks[0].bankName).toBe('AlphaBank');
      expect(out?.banks[1].bankName).toBe('ZetaBank');
    });
  });
});

