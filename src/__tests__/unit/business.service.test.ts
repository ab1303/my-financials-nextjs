import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the prisma module before importing the service
vi.mock('@/server/db/client', () => ({
  prisma: {
    business: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import type { Business } from '@prisma/client';

import {
  addBusinessDetails,
  updateBusinessDetails,
  validateBusinessNameUniqueness,
} from '@/server/services/business.service';
import { prisma } from '@/server/db/client';
import { BusinessEnumType } from '@/types/enum';

describe('business.service', () => {
  const mockUserId = 'user-123';
  const mockBusinessId = 'business-456';

  const mockBusiness: Business = {
    id: mockBusinessId,
    name: 'Acme Corp',
    type: BusinessEnumType.PHILANTHROPY,
    isDgrRegistered: true,
    addressLine: '123 Main St',
    streetAddress: 'Main Street',
    postcode: 2000,
    state: 'NSW',
    suburb: 'Sydney',
    userId: mockUserId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addBusinessDetails', () => {
    it('should create a business with the provided input', async () => {
      // Arrange
      const input = {
        name: 'Acme Corp',
        type: BusinessEnumType.PHILANTHROPY,
        isDgrRegistered: true,
        addressLine: '123 Main St',
        streetAddress: 'Main Street',
        postcode: 2000,
        state: 'NSW',
        suburb: 'Sydney',
        userId: mockUserId,
      };

      vi.mocked(prisma.business.create).mockResolvedValueOnce(
        mockBusiness as any,
      );

      // Act
      const result = await addBusinessDetails(input);

      // Assert
      expect(vi.mocked(prisma.business.create)).toHaveBeenCalledWith({
        data: input,
      });
      expect(result).toEqual(mockBusiness);
      expect(result.name).toBe('Acme Corp');
      expect(result.userId).toBe(mockUserId);
    });

    it('should return the created business with correct fields', async () => {
      // Arrange
      const input = {
        name: 'Tech Ventures',
        type: BusinessEnumType.PHILANTHROPY,
        isDgrRegistered: false,
        userId: mockUserId,
      };

      const createdBusiness: Business = {
        ...mockBusiness,
        name: 'Tech Ventures',
      };

      vi.mocked(prisma.business.create).mockResolvedValueOnce(
        createdBusiness as any,
      );

      // Act
      const result = await addBusinessDetails(input as any);

      // Assert
      expect(result.name).toBe('Tech Ventures');
      expect(result.id).toBeDefined();
    });
  });

  describe('validateBusinessNameUniqueness', () => {
    it('should return true when business name is unique (not found)', async () => {
      // Arrange
      const name = 'Unique Business';
      vi.mocked(prisma.business.findFirst).mockResolvedValueOnce(null);

      // Act
      const isUnique = await validateBusinessNameUniqueness(name, mockUserId);

      // Assert
      expect(isUnique).toBe(true);
      expect(vi.mocked(prisma.business.findFirst)).toHaveBeenCalledWith({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          userId: mockUserId,
        },
      });
    });

    it('should return false when business name already exists (not unique)', async () => {
      // Arrange
      const name = 'Existing Business';
      vi.mocked(prisma.business.findFirst).mockResolvedValueOnce(
        mockBusiness as any,
      );

      // Act
      const isUnique = await validateBusinessNameUniqueness(name, mockUserId);

      // Assert
      expect(isUnique).toBe(false);
    });

    it('should exclude current business by ID when checking uniqueness', async () => {
      // Arrange
      const name = 'Updated Name';
      const excludeId = mockBusinessId;
      vi.mocked(prisma.business.findFirst).mockResolvedValueOnce(null);

      // Act
      await validateBusinessNameUniqueness(name, mockUserId, excludeId);

      // Assert
      expect(vi.mocked(prisma.business.findFirst)).toHaveBeenCalledWith({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          userId: mockUserId,
          id: { not: excludeId },
        },
      });
    });

    it('should handle case-insensitive name matching', async () => {
      // Arrange
      const name = 'MyBusiness';
      vi.mocked(prisma.business.findFirst).mockResolvedValueOnce(
        mockBusiness as any,
      );

      // Act
      const isUnique = await validateBusinessNameUniqueness(name, mockUserId);

      // Assert
      expect(isUnique).toBe(false);
      const callArgs = vi.mocked(prisma.business.findFirst).mock.calls[0]?.[0];
      expect(callArgs?.where?.name).toEqual({
        equals: name,
        mode: 'insensitive',
      });
    });
  });

  describe('updateBusinessDetails', () => {
    it('should update a business with the provided data', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Business Name',
        addressLine: '456 New Street',
      };

      const updatedBusiness: Business = {
        ...mockBusiness,
        ...updateData,
      };

      vi.mocked(prisma.business.update).mockResolvedValueOnce(
        updatedBusiness as any,
      );

      // Act
      const result = await updateBusinessDetails(mockBusinessId, updateData);

      // Assert
      expect(vi.mocked(prisma.business.update)).toHaveBeenCalledWith({
        where: { id: mockBusinessId },
        data: updateData,
      });
      expect(result).toEqual(updatedBusiness);
      expect(result.name).toBe('Updated Business Name');
    });

    it('should update only provided fields', async () => {
      // Arrange
      const partialUpdateData = {
        name: 'New Name Only',
      };

      const partiallyUpdatedBusiness: Business = {
        ...mockBusiness,
        name: 'New Name Only',
      };

      vi.mocked(prisma.business.update).mockResolvedValueOnce(
        partiallyUpdatedBusiness as any,
      );

      // Act
      const result = await updateBusinessDetails(
        mockBusinessId,
        partialUpdateData,
      );

      // Assert
      expect(vi.mocked(prisma.business.update)).toHaveBeenCalledWith({
        where: { id: mockBusinessId },
        data: partialUpdateData,
      });
      expect(result.name).toBe('New Name Only');
    });

    it('should return the updated business', async () => {
      // Arrange
      const updateData = {
        suburb: 'Melbourne',
        state: 'VIC',
        postcode: 3000,
      };

      const updatedBusiness: Business = {
        ...mockBusiness,
        ...updateData,
      };

      vi.mocked(prisma.business.update).mockResolvedValueOnce(
        updatedBusiness as any,
      );

      // Act
      const result = await updateBusinessDetails(mockBusinessId, updateData);

      // Assert
      expect(result.suburb).toBe('Melbourne');
      expect(result.state).toBe('VIC');
      expect(result.postcode).toBe(3000);
      expect(result.id).toBe(mockBusinessId);
    });
  });
});