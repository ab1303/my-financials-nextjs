import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import {
  addBrokerageDetails,
  getBrokerageDetails,
  deleteBrokerageDetails,
} from '@/server/services/brokerage.service';

describe('Brokerage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addBrokerageDetails', () => {
    it('creates global brokerage with userId=null and type=BROKERAGE', async () => {
      // Arrange
      const input = { name: 'Fidelity' };
      const mockResult = {
        id: 'brokerage-1',
        name: 'Fidelity',
        userId: null,
        type: 'BROKERAGE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      prismaMock.business.create.mockResolvedValue(mockResult as any);

      // Act
      const result = await addBrokerageDetails(input);

      // Assert
      expect(prismaMock.business.create).toHaveBeenCalledWith({
        data: { name: 'Fidelity', userId: null, type: 'BROKERAGE' },
      });
      expect(result).toEqual(mockResult);
      expect(result.userId).toBeNull();
      expect(result.type).toBe('BROKERAGE');
    });

    it('creates multiple brokerages independently', async () => {
      // Arrange
      const inputs = [
        { name: 'Fidelity' },
        { name: 'Charles Schwab' },
        { name: 'TD Ameritrade' },
      ];

      const mockResults = [
        {
          id: 'brokerage-1',
          name: 'Fidelity',
          userId: null,
          type: 'BROKERAGE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'brokerage-2',
          name: 'Charles Schwab',
          userId: null,
          type: 'BROKERAGE',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'brokerage-3',
          name: 'TD Ameritrade',
          userId: null,
          type: 'BROKERAGE',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      prismaMock.business.create
        .mockResolvedValueOnce(mockResults[0] as any)
        .mockResolvedValueOnce(mockResults[1] as any)
        .mockResolvedValueOnce(mockResults[2] as any);

      // Act
      const results = await Promise.all(
        inputs.map((input) => addBrokerageDetails(input))
      );

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('Fidelity');
      expect(results[1].name).toBe('Charles Schwab');
      expect(results[2].name).toBe('TD Ameritrade');
      expect(prismaMock.business.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('getBrokerageDetails', () => {
    it('filters for global brokerages only (userId=null and type=BROKERAGE)', async () => {
      // Arrange
      const mockBrokerages = [
        {
          id: 'brokerage-1',
          name: 'Fidelity',
          userId: null,
          type: 'BROKERAGE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'brokerage-2',
          name: 'Charles Schwab',
          userId: null,
          type: 'BROKERAGE',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      prismaMock.business.findMany.mockResolvedValue(mockBrokerages as any);

      // Act
      const result = await getBrokerageDetails();

      // Assert
      expect(prismaMock.business.findMany).toHaveBeenCalledWith({
        where: {
          type: 'BROKERAGE',
          userId: null,
        },
        select: undefined,
      });
      expect(result).toEqual(mockBrokerages);
      expect(result).toHaveLength(2);
      result.forEach((brokerage) => {
        expect(brokerage.userId).toBeNull();
        expect(brokerage.type).toBe('BROKERAGE');
      });
    });

    it('returns empty array when no brokerages exist', async () => {
      // Arrange
      prismaMock.business.findMany.mockResolvedValue([]);

      // Act
      const result = await getBrokerageDetails();

      // Assert
      expect(result).toEqual([]);
      expect(prismaMock.business.findMany).toHaveBeenCalledWith({
        where: {
          type: 'BROKERAGE',
          userId: null,
        },
        select: undefined,
      });
    });

    it('accepts optional where clause and merges with global filters', async () => {
      // Arrange
      const mockBrokerage = [
        {
          id: 'brokerage-1',
          name: 'Fidelity',
          userId: null,
          type: 'BROKERAGE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      prismaMock.business.findMany.mockResolvedValue(mockBrokerage as any);

      // Act
      const result = await getBrokerageDetails({ id: 'brokerage-1' });

      // Assert
      expect(prismaMock.business.findMany).toHaveBeenCalledWith({
        where: {
          id: 'brokerage-1',
          type: 'BROKERAGE',
          userId: null,
        },
        select: undefined,
      });
      expect(result).toEqual(mockBrokerage);
    });

    it('accepts select parameter for specific fields', async () => {
      // Arrange
      const mockBrokerages = [{ id: 'brokerage-1', name: 'Fidelity' }];

      prismaMock.business.findMany.mockResolvedValue(mockBrokerages as any);

      // Act
      const result = await getBrokerageDetails(undefined, {
        id: true,
        name: true,
      });

      // Assert
      expect(prismaMock.business.findMany).toHaveBeenCalledWith({
        where: {
          type: 'BROKERAGE',
          userId: null,
        },
        select: {
          id: true,
          name: true,
        },
      });
      expect(result).toEqual(mockBrokerages);
    });
  });

  describe('deleteBrokerageDetails', () => {
    it('deletes brokerage when no dependent accounts exist', async () => {
      // Arrange
      const brokerageId = 'brokerage-1';
      const mockDeleteResult = {
        id: 'brokerage-1',
        name: 'Fidelity',
        userId: null,
        type: 'BROKERAGE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      prismaMock.financialAccount.count.mockResolvedValue(0);
      prismaMock.business.delete.mockResolvedValue(mockDeleteResult as any);

      // Act
      const result = await deleteBrokerageDetails(brokerageId);

      // Assert
      expect(prismaMock.financialAccount.count).toHaveBeenCalledWith({
        where: { institutionId: brokerageId },
      });
      expect(prismaMock.business.delete).toHaveBeenCalledWith({
        where: { id: brokerageId, type: 'BROKERAGE', userId: null },
      });
      expect(result).toEqual(mockDeleteResult);
    });

    it('throws error when dependent accounts exist (single account)', async () => {
      // Arrange
      const brokerageId = 'brokerage-1';
      prismaMock.financialAccount.count.mockResolvedValue(1);

      // Act & Assert
      await expect(deleteBrokerageDetails(brokerageId)).rejects.toThrow(
        'Cannot delete brokerage: 1 account(s) depend on this institution'
      );
      expect(prismaMock.business.delete).not.toHaveBeenCalled();
    });

    it('throws error when multiple dependent accounts exist', async () => {
      // Arrange
      const brokerageId = 'brokerage-1';
      prismaMock.financialAccount.count.mockResolvedValue(5);

      // Act & Assert
      await expect(deleteBrokerageDetails(brokerageId)).rejects.toThrow(
        'Cannot delete brokerage: 5 account(s) depend on this institution'
      );
      expect(prismaMock.business.delete).not.toHaveBeenCalled();
    });

    it('prevents deletion of brokerage with many dependent accounts', async () => {
      // Arrange
      const brokerageId = 'brokerage-1';
      const accountCount = 100;
      prismaMock.financialAccount.count.mockResolvedValue(accountCount);

      // Act & Assert
      await expect(deleteBrokerageDetails(brokerageId)).rejects.toThrow(
        `Cannot delete brokerage: ${accountCount} account(s) depend on this institution`
      );
      expect(prismaMock.financialAccount.count).toHaveBeenCalledWith({
        where: { institutionId: brokerageId },
      });
    });

    it('checks account dependencies before attempting deletion', async () => {
      // Arrange
      const brokerageId = 'brokerage-1';
      prismaMock.financialAccount.count.mockResolvedValue(3);

      // Act & Assert
      await expect(
        deleteBrokerageDetails(brokerageId)
      ).rejects.toThrow();

      // Verify count was called before delete
      expect(prismaMock.financialAccount.count).toHaveBeenCalledBefore(
        prismaMock.business.delete
      );
    });
  });
});
