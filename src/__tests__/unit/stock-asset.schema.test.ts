import { describe, expect, it } from 'vitest';
import {
  stockHoldingEntrySchema,
  createStockSnapshotSchema,
  updateStockHoldingSchema,
} from '@/server/schema/stock-asset.schema';
import { ZodError } from 'zod';

describe('stock-asset.schema', () => {
  describe('stockHoldingEntrySchema - buyDate optional', () => {
    it('should save holding without buyDate (buyDate optional)', () => {
      // Arrange
      const validHoldingWithoutBuyDate = {
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        quantity: 10,
        buyPrice: 150.5,
        buyDate: undefined,
        currentPrice: 175.0,
        currency: 'USD',
        plannedTerm: 'LONG_TERM',
        accountId: 'acc-123',
      };

      // Act
      const result = stockHoldingEntrySchema.safeParse(
        validHoldingWithoutBuyDate
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        // buyDate is optional, so it can be undefined or null
        expect(result.data.buyDate ?? null).toBeNull();
      }
    });

    it('should save holding with null buyDate', () => {
      // Arrange
      const validHoldingWithNullBuyDate = {
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        quantity: 10,
        buyPrice: 150.5,
        buyDate: null,
        currentPrice: 175.0,
        currency: 'USD',
        plannedTerm: 'LONG_TERM',
        accountId: 'acc-123',
      };

      // Act
      const result = stockHoldingEntrySchema.safeParse(
        validHoldingWithNullBuyDate
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        // When null is provided, it should stay null or become undefined
        expect(result.data.buyDate ?? null).toBeNull();
      }
    });
  });

  describe('stockHoldingEntrySchema - saleDate validation', () => {
    it('should save holding with empty saleDate (preprocessing skips validation)', () => {
      // Arrange: Complete valid holding with empty saleDate
      const validHoldingWithEmptySaleDate = {
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        quantity: 10,
        buyPrice: 150.5,
        buyDate: new Date('2023-01-15'),
        currentPrice: 175.0,
        currency: 'USD',
        plannedTerm: 'LONG_TERM',
        saleDate: '',
        accountId: 'acc-123',
      };

      // Act
      const result = stockHoldingEntrySchema.safeParse(
        validHoldingWithEmptySaleDate
      );

      // Assert: Should pass validation (not throw "Invalid date" error)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleDate ?? null).toBeNull();
      }
    });

    it('should save holding with null saleDate', () => {
      // Arrange
      const validHoldingWithNullSaleDate = {
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        quantity: 10,
        buyPrice: 150.5,
        buyDate: new Date('2023-01-15'),
        currentPrice: 175.0,
        currency: 'USD',
        plannedTerm: 'LONG_TERM',
        saleDate: null,
        accountId: 'acc-123',
      };

      // Act
      const result = stockHoldingEntrySchema.safeParse(
        validHoldingWithNullSaleDate
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleDate ?? null).toBeNull();
      }
    });

    it('should save holding with undefined saleDate', () => {
      // Arrange
      const validHoldingWithUndefinedSaleDate = {
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        quantity: 10,
        buyPrice: 150.5,
        buyDate: new Date('2023-01-15'),
        currentPrice: 175.0,
        currency: 'USD',
        plannedTerm: 'LONG_TERM',
        saleDate: undefined,
        accountId: 'acc-123',
      };

      // Act
      const result = stockHoldingEntrySchema.safeParse(
        validHoldingWithUndefinedSaleDate
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleDate ?? null).toBeNull();
      }
    });

    it('should save holding with valid saleDate', () => {
      // Arrange
      const validHoldingWithValidSaleDate = {
        ticker: 'AAPL',
        companyName: 'Apple Inc',
        quantity: 10,
        buyPrice: 150.5,
        buyDate: new Date('2023-01-15'),
        currentPrice: 175.0,
        currency: 'USD',
        plannedTerm: 'LONG_TERM',
        saleDate: new Date('2024-01-15'),
        salePrice: 200.0,
        soldQuantity: 10,
        accountId: 'acc-123',
      };

      // Act
      const result = stockHoldingEntrySchema.safeParse(
        validHoldingWithValidSaleDate
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleDate).toEqual(new Date('2024-01-15'));
      }
    });
  });

  describe('createStockSnapshotSchema - integration', () => {
    it('should create snapshot with holdings that have optional/null buyDate', () => {
      // Arrange
      const snapshotWithOptionalBuyDates = {
        snapshotDate: new Date('2024-01-31'),
        holdings: [
          {
            ticker: 'AAPL',
            companyName: 'Apple Inc',
            quantity: 10,
            buyPrice: 150.5,
            buyDate: new Date('2023-01-15'),
            currentPrice: 175.0,
            currency: 'USD',
            plannedTerm: 'LONG_TERM',
            accountId: 'acc-123',
          },
          {
            ticker: 'MSFT',
            companyName: 'Microsoft Corp',
            quantity: 5,
            buyPrice: 300.0,
            buyDate: undefined,
            currentPrice: 350.0,
            currency: 'USD',
            plannedTerm: 'MID_TERM',
            accountId: 'acc-123',
          },
        ],
      };

      // Act
      const result = createStockSnapshotSchema.safeParse(
        snapshotWithOptionalBuyDates
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.holdings).toHaveLength(2);
        // buyDate is optional, so it can be undefined or null
        expect(result.data.holdings[1].buyDate ?? null).toBeNull();
      }
    });
  });

  describe('updateStockHoldingSchema', () => {
    it('should update holding with optional buyDate', () => {
      // Arrange
      const updatePayload = {
        holdingId: 'holding-123',
        ticker: 'AAPL',
        buyDate: undefined,
      };

      // Act
      const result = updateStockHoldingSchema.safeParse(updatePayload);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buyDate).toBeUndefined();
      }
    });

    it('should update holding with empty saleDate string (preprocesses to null)', () => {
      // Arrange
      const updatePayload = {
        holdingId: 'holding-123',
        saleDate: '',
      };

      // Act
      const result = updateStockHoldingSchema.safeParse(updatePayload);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleDate ?? null).toBeNull();
      }
    });
  });
});
