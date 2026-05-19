import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addBrokerageDetailsHandler,
  allBrokerageDetailsHandler,
  removeBrokerageDetailsHandler,
} from '@/server/controllers/brokerage.controller';
import * as brokerageService from '@/server/services/brokerage.service';
import * as prismaUtils from '@/server/utils/prisma';

// Mock the service layer
vi.mock('@/server/services/brokerage.service');
vi.mock('@/server/utils/prisma');

describe('Brokerage Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addBrokerageDetailsHandler', () => {
    it('returns success response when brokerage created', async () => {
      // Arrange
      const input = { name: 'Charles Schwab' };
      const mockBrokerage = {
        id: 'brokerage-2',
        name: 'Charles Schwab',
        userId: null,
        type: 'BROKERAGE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.spyOn(brokerageService, 'addBrokerageDetails').mockResolvedValue(
        mockBrokerage as any
      );

      // Act
      const result = await addBrokerageDetailsHandler({ input });

      // Assert
      expect(result).toEqual({
        status: 'success',
        data: { brokerage: mockBrokerage },
      });
      expect(brokerageService.addBrokerageDetails).toHaveBeenCalledWith({
        name: 'Charles Schwab',
      });
    });

    it('returns success response with correct brokerage data', async () => {
      // Arrange
      const input = { name: 'Fidelity' };
      const mockBrokerage = {
        id: 'brokerage-1',
        name: 'Fidelity',
        userId: null,
        type: 'BROKERAGE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.spyOn(brokerageService, 'addBrokerageDetails').mockResolvedValue(
        mockBrokerage as any
      );

      // Act
      const result = await addBrokerageDetailsHandler({ input });

      // Assert
      expect(result?.status).toBe('success');
      expect(result?.data?.brokerage).toEqual(mockBrokerage);
      expect(result?.data?.brokerage?.userId).toBeNull();
      expect(result?.data?.brokerage?.type).toBe('BROKERAGE');
    });

    it('calls service with correct input parameters', async () => {
      // Arrange
      const input = { name: 'TD Ameritrade' };
      const mockBrokerage = {
        id: 'brokerage-3',
        name: 'TD Ameritrade',
        userId: null,
        type: 'BROKERAGE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.spyOn(brokerageService, 'addBrokerageDetails').mockResolvedValue(
        mockBrokerage as any
      );

      // Act
      await addBrokerageDetailsHandler({ input });

      // Assert
      expect(brokerageService.addBrokerageDetails).toHaveBeenCalledWith({
        name: 'TD Ameritrade',
      });
      expect(brokerageService.addBrokerageDetails).toHaveBeenCalledTimes(1);
    });

    it('catches and handles errors from service', async () => {
      // Arrange
      const input = { name: 'Invalid Broker' };
      const error = new Error('Database connection failed');

      vi.spyOn(brokerageService, 'addBrokerageDetails').mockRejectedValue(
        error
      );
      vi.spyOn(prismaUtils, 'handleCaughtError').mockImplementation((e) => {
        // Mock implementation that doesn't throw
        return;
      });

      // Act
      const result = await addBrokerageDetailsHandler({ input });

      // Assert
      expect(result).toBeUndefined();
      expect(prismaUtils.handleCaughtError).toHaveBeenCalledWith(error);
    });

    it('handles validation errors from service', async () => {
      // Arrange
      const input = { name: 'Test' };
      const validationError = new Error('Invalid input');

      vi.spyOn(brokerageService, 'addBrokerageDetails').mockRejectedValue(
        validationError
      );
      vi.spyOn(prismaUtils, 'handleCaughtError').mockImplementation((e) => {
        return;
      });

      // Act
      const result = await addBrokerageDetailsHandler({ input });

      // Assert
      expect(prismaUtils.handleCaughtError).toHaveBeenCalledWith(
        validationError
      );
    });
  });

  describe('allBrokerageDetailsHandler', () => {
    it('returns array of brokerages', async () => {
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

      vi.spyOn(brokerageService, 'getBrokerageDetails').mockResolvedValue(
        mockBrokerages as any
      );

      // Act
      const result = await allBrokerageDetailsHandler();

      // Assert
      expect(result).toEqual(mockBrokerages);
      expect(result).toHaveLength(2);
      expect(brokerageService.getBrokerageDetails).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no brokerages exist', async () => {
      // Arrange
      vi.spyOn(brokerageService, 'getBrokerageDetails').mockResolvedValue([]);

      // Act
      const result = await allBrokerageDetailsHandler();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('calls service with no parameters', async () => {
      // Arrange
      vi.spyOn(brokerageService, 'getBrokerageDetails').mockResolvedValue(
        [] as any
      );

      // Act
      await allBrokerageDetailsHandler();

      // Assert
      expect(brokerageService.getBrokerageDetails).toHaveBeenCalledWith();
    });

    it('handles errors from service', async () => {
      // Arrange
      const error = new Error('Database error');

      vi.spyOn(brokerageService, 'getBrokerageDetails').mockRejectedValue(
        error
      );
      vi.spyOn(prismaUtils, 'handleCaughtError').mockImplementation((e) => {
        return;
      });

      // Act
      const result = await allBrokerageDetailsHandler();

      // Assert
      expect(result).toBeUndefined();
      expect(prismaUtils.handleCaughtError).toHaveBeenCalledWith(error);
    });
  });

  describe('removeBrokerageDetailsHandler', () => {
    it('calls service with correct brokerage ID', async () => {
      // Arrange
      const params = { brokerageId: 'brokerage-1' };

      vi.spyOn(brokerageService, 'deleteBrokerageDetails').mockResolvedValue(
        undefined as any
      );

      // Act
      await removeBrokerageDetailsHandler({ params });

      // Assert
      expect(brokerageService.deleteBrokerageDetails).toHaveBeenCalledWith(
        'brokerage-1'
      );
    });

    it('successfully removes brokerage when no dependencies exist', async () => {
      // Arrange
      const params = { brokerageId: 'brokerage-2' };

      vi.spyOn(brokerageService, 'deleteBrokerageDetails').mockResolvedValue(
        undefined as any
      );

      // Act
      const result = await removeBrokerageDetailsHandler({ params });

      // Assert
      expect(result).toBeUndefined();
      expect(brokerageService.deleteBrokerageDetails).toHaveBeenCalledWith(
        'brokerage-2'
      );
    });

    it('handles deletion error when accounts depend on brokerage', async () => {
      // Arrange
      const params = { brokerageId: 'brokerage-3' };
      const error = new Error(
        'Cannot delete brokerage: 5 account(s) depend on this institution'
      );

      vi.spyOn(brokerageService, 'deleteBrokerageDetails').mockRejectedValue(
        error
      );
      vi.spyOn(prismaUtils, 'handleCaughtError').mockImplementation((e) => {
        return;
      });

      // Act
      const result = await removeBrokerageDetailsHandler({ params });

      // Assert
      expect(result).toBeUndefined();
      expect(prismaUtils.handleCaughtError).toHaveBeenCalledWith(error);
    });

    it('catches dependency error with specific account count', async () => {
      // Arrange
      const params = { brokerageId: 'brokerage-1' };
      const dependencyError = new Error(
        'Cannot delete brokerage: 3 account(s) depend on this institution'
      );

      vi.spyOn(brokerageService, 'deleteBrokerageDetails').mockRejectedValue(
        dependencyError
      );
      vi.spyOn(prismaUtils, 'handleCaughtError').mockImplementation((e) => {
        return;
      });

      // Act
      const result = await removeBrokerageDetailsHandler({ params });

      // Assert
      expect(prismaUtils.handleCaughtError).toHaveBeenCalledWith(
        dependencyError
      );
      expect(result).toBeUndefined();
    });

    it('handles generic database errors', async () => {
      // Arrange
      const params = { brokerageId: 'brokerage-invalid' };
      const dbError = new Error('Record not found');

      vi.spyOn(brokerageService, 'deleteBrokerageDetails').mockRejectedValue(
        dbError
      );
      vi.spyOn(prismaUtils, 'handleCaughtError').mockImplementation((e) => {
        return;
      });

      // Act
      const result = await removeBrokerageDetailsHandler({ params });

      // Assert
      expect(prismaUtils.handleCaughtError).toHaveBeenCalledWith(dbError);
      expect(result).toBeUndefined();
    });

    it('processes multiple deletion requests sequentially', async () => {
      // Arrange
      const params1 = { brokerageId: 'brokerage-1' };
      const params2 = { brokerageId: 'brokerage-2' };

      vi.spyOn(brokerageService, 'deleteBrokerageDetails').mockResolvedValue(
        undefined as any
      );

      // Act
      await removeBrokerageDetailsHandler({ params: params1 });
      await removeBrokerageDetailsHandler({ params: params2 });

      // Assert
      expect(brokerageService.deleteBrokerageDetails).toHaveBeenCalledTimes(2);
      expect(brokerageService.deleteBrokerageDetails).toHaveBeenNthCalledWith(
        1,
        'brokerage-1'
      );
      expect(brokerageService.deleteBrokerageDetails).toHaveBeenNthCalledWith(
        2,
        'brokerage-2'
      );
    });
  });
});
