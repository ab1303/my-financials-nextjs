import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { getBrokerageAccounts, createBrokerageSubAccount } from '@/server/services/stock-asset.service';

const userId = 'user-123';

describe('stock-asset.service — brokerage functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBrokerageAccounts', () => {
    it('returns empty array when user has no brokerage accounts', async () => {
      prismaMock.financialAccount.findMany.mockResolvedValueOnce([] as never);
      const result = await getBrokerageAccounts(userId);
      expect(result).toEqual([]);
      expect(prismaMock.financialAccount.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          institution: { type: 'BROKERAGE' },
        },
        select: {
          id: true,
          name: true,
          institution: { select: { id: true, name: true } },
        },
        orderBy: [
          { institution: { name: 'asc' } },
          { name: 'asc' },
        ],
      });
    });

    it('returns accounts with institution data for the user', async () => {
      const accounts = [
        {
          id: 'acc-1',
          name: 'Brokerage 1',
          institution: { id: 'inst-1', name: 'Fidelity' },
        },
        {
          id: 'acc-2',
          name: 'Brokerage 2',
          institution: { id: 'inst-2', name: 'Vanguard' },
        },
      ];
      prismaMock.financialAccount.findMany.mockResolvedValueOnce(accounts as never);
      const result = await getBrokerageAccounts(userId);
      expect(result).toEqual(accounts);
    });

    it('calls findMany with correct where clause', async () => {
      prismaMock.financialAccount.findMany.mockResolvedValueOnce([] as never);
      await getBrokerageAccounts(userId);
      expect(prismaMock.financialAccount.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          institution: { type: 'BROKERAGE' },
        },
        select: {
          id: true,
          name: true,
          institution: { select: { id: true, name: true } },
        },
        orderBy: [
          { institution: { name: 'asc' } },
          { name: 'asc' },
        ],
      });
    });
  });

  describe('createBrokerageSubAccount', () => {
    const input = { businessId: 'biz-1', name: 'My Subaccount' };

    it('throws when business not found', async () => {
      prismaMock.business.findFirst.mockResolvedValueOnce(null as never);
      await expect(createBrokerageSubAccount(userId, input)).rejects.toThrow('Brokerage institution not found or not owned by user');
      expect(prismaMock.business.findFirst).toHaveBeenCalledWith({
        where: {
          id: input.businessId,
          type: 'BROKERAGE',
          OR: [
            { userId: null },        // Global institution
            { userId },              // User-owned institution
          ],
        },
      });
    });

    it('creates and returns sub-account when global brokerage exists', async () => {
      const business = { id: input.businessId };
      const created = {
        id: 'acc-1',
        name: input.name,
        institution: { id: input.businessId, name: 'Fidelity' },
      };
      prismaMock.business.findFirst.mockResolvedValueOnce(business as never);
      prismaMock.financialAccount.create.mockResolvedValueOnce(created as never);
      const result = await createBrokerageSubAccount(userId, input);
      expect(result).toEqual(created);
    });

    it('creates and returns sub-account when user-owned brokerage exists', async () => {
      const business = { id: input.businessId, userId };
      const created = {
        id: 'acc-2',
        name: input.name,
        institution: { id: input.businessId, name: 'Vanguard' },
      };
      prismaMock.business.findFirst.mockResolvedValueOnce(business as never);
      prismaMock.financialAccount.create.mockResolvedValueOnce(created as never);
      const result = await createBrokerageSubAccount(userId, input);
      expect(result).toEqual(created);
    });

    it('passes correct data to prisma.financialAccount.create', async () => {
      const business = { id: input.businessId };
      const created = {
        id: 'acc-2',
        name: input.name,
        institution: { id: input.businessId, name: 'Vanguard' },
      };
      prismaMock.business.findFirst.mockResolvedValueOnce(business as never);
      prismaMock.financialAccount.create.mockResolvedValueOnce(created as never);
      await createBrokerageSubAccount(userId, input);
      expect(prismaMock.financialAccount.create).toHaveBeenCalledWith({
        data: {
          name: input.name,
          institutionId: input.businessId,
          userId,
        },
        select: {
          id: true,
          name: true,
          institution: { select: { id: true, name: true } },
        },
      });
    });
  });
});
