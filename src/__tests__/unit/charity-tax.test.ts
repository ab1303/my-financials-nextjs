import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock prisma before importing the helper
vi.mock('@/server/utils/prisma', () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/server/utils/prisma';
import { deriveTaxCategory } from '@/server/utils/charity-tax';
import { BeneficiaryEnumType } from '@prisma/client';

describe('charity-tax helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deriveTaxCategory', () => {
    it('should return "DEDUCTIBLE" when beneficiary is a DGR-registered business', async () => {
      // Arrange
      const mockBusiness = {
        id: 'biz-123',
        name: 'Charity Corp',
        isDgrRegistered: true,
        type: 'PHILANTHROPY',
        userId: 'user-1',
      };

      (prisma.business.findUnique as any).mockResolvedValue(mockBusiness);

      // Act
      const result = await deriveTaxCategory(
        'biz-123',
        'BUSINESS',
        'user-1'
      );

      // Assert
      expect(result).toBe('DEDUCTIBLE');
      expect(prisma.business.findUnique).toHaveBeenCalledWith({
        where: { id: 'biz-123' },
      });
    });

    it('should return "NON_DEDUCTIBLE" when beneficiary is a non-DGR business', async () => {
      // Arrange
      const mockBusiness = {
        id: 'biz-456',
        name: 'Non-Charity Corp',
        isDgrRegistered: false,
        type: 'BANK',
        userId: 'user-1',
      };

      (prisma.business.findUnique as any).mockResolvedValue(mockBusiness);

      // Act
      const result = await deriveTaxCategory(
        'biz-456',
        'BUSINESS',
        'user-1'
      );

      // Assert
      expect(result).toBe('NON_DEDUCTIBLE');
    });

    it('should always return "NON_DEDUCTIBLE" for individual beneficiaries', async () => {
      // Arrange: Individual DGR is not supported; all individuals are non-deductible
      // Act
      const result = await deriveTaxCategory(
        'ind-789',
        'INDIVIDUAL',
        'user-1'
      );

      // Assert
      expect(result).toBe('NON_DEDUCTIBLE');
      // Verify that we never query the individual table
      expect(prisma.business.findUnique).not.toHaveBeenCalled();
    });

    it('should return "NON_DEDUCTIBLE" when beneficiary is not found', async () => {
      // Arrange
      (prisma.business.findUnique as any).mockResolvedValue(null);

      // Act
      const result = await deriveTaxCategory(
        'biz-nonexistent',
        'BUSINESS',
        'user-1'
      );

      // Assert
      expect(result).toBe('NON_DEDUCTIBLE');
    });

    it('should return "NON_DEDUCTIBLE" when isDgrRegistered is null or undefined', async () => {
      // Arrange
      const mockBusiness = {
        id: 'biz-789',
        name: 'Unknown Status Corp',
        isDgrRegistered: null,
        type: 'PHILANTHROPY',
        userId: 'user-1',
      };

      (prisma.business.findUnique as any).mockResolvedValue(mockBusiness);

      // Act
      const result = await deriveTaxCategory(
        'biz-789',
        'BUSINESS',
        'user-1'
      );

      // Assert
      expect(result).toBe('NON_DEDUCTIBLE');
    });
  });
});
