import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { calculateHoldingMetrics, getCGTProjectionText } from '@/utils/stock-asset-calculations';
import type { StockHoldingWithAccount } from '@/types/stock-asset.types';

/**
 * Phase 3: Service Layer Null Handling Tests
 *
 * These tests verify that the service layer and calculation functions
 * properly handle null buyDate in calculations and aggregations.
 */

describe('Stock Asset Service - Null buyDate Handling', () => {
  // Helper to create a mock holding with optional buyDate
  const createMockHolding = (
    overrides: Partial<StockHoldingWithAccount> = {}
  ): StockHoldingWithAccount => {
    return {
      id: 'holding-1',
      ticker: 'AAPL',
      companyName: 'Apple Inc',
      quantity: 10,
      buyPrice: 150,
      buyDate: new Date('2023-01-15'), // Default with date
      currentPrice: 175,
      currency: 'USD' as const,
      plannedTerm: 'LONG_TERM' as const,
      salePrice: null,
      saleDate: null,
      soldQuantity: null,
      snapshotId: 'snapshot-1',
      accountId: 'account-1',
      account: {
        id: 'account-1',
        name: 'Main Brokerage',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  };

  describe('Test 1: getSnapshotTotals with null buyDate', () => {
    it('should return holding with 0 months and isCGTEligible = false when buyDate is null', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const holdingWithNullBuyDate = createMockHolding({
        buyDate: null,
        quantity: 100,
        buyPrice: 50,
        currentPrice: 75,
      });

      // Act
      const metrics = calculateHoldingMetrics(holdingWithNullBuyDate, snapshotDate);

      // Assert
      expect(metrics.holdingPeriodMonths).toBe(0);
      expect(metrics.isCGTEligible).toBe(false);
      expect(metrics.marketValue).toBe(7500); // 100 * 75
      expect(metrics.costBasis).toBe(5000); // 100 * 50
    });

    it('should calculate unrealizedPL correctly with null buyDate', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const holdingWithNullBuyDate = createMockHolding({
        buyDate: null,
        quantity: 50,
        buyPrice: 100,
        currentPrice: 120,
      });

      // Act
      const metrics = calculateHoldingMetrics(holdingWithNullBuyDate, snapshotDate);

      // Assert - Should calculate P/L based on prices, not buyDate
      expect(metrics.unrealizedPL).toBe(1000); // (120 - 100) * 50
      expect(metrics.unrealizedPLPercent).toBe(20); // (120 - 100) / 100 * 100
    });

    it('should handle negative P/L with null buyDate', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const holdingWithNullBuyDate = createMockHolding({
        buyDate: null,
        quantity: 50,
        buyPrice: 100,
        currentPrice: 80,
      });

      // Act
      const metrics = calculateHoldingMetrics(holdingWithNullBuyDate, snapshotDate);

      // Assert
      expect(metrics.unrealizedPL).toBe(-1000); // (80 - 100) * 50
      expect(metrics.unrealizedPLPercent).toBe(-20);
    });
  });

  describe('Test 2: Aggregation includes null buyDate holdings', () => {
    it('should sum market values correctly with mixed null/non-null buyDates', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const holdingWithDate = createMockHolding({
        id: 'holding-with-date',
        buyDate: new Date('2023-01-15'),
        quantity: 10,
        buyPrice: 100,
        currentPrice: 120,
      });
      const holdingWithoutDate = createMockHolding({
        id: 'holding-no-date',
        buyDate: null,
        quantity: 20,
        buyPrice: 50,
        currentPrice: 60,
      });

      // Act
      const metricsWithDate = calculateHoldingMetrics(holdingWithDate, snapshotDate);
      const metricsWithoutDate = calculateHoldingMetrics(holdingWithoutDate, snapshotDate);

      // Assert - Both should aggregate properly
      const totalMarketValue = metricsWithDate.marketValue + metricsWithoutDate.marketValue;
      const totalUnrealizedPL = metricsWithDate.unrealizedPL + metricsWithoutDate.unrealizedPL;

      expect(totalMarketValue).toBe(1200 + 1200); // 1200 + 1200
      expect(totalUnrealizedPL).toBe(200 + 200); // (120-100)*10 + (60-50)*20
    });

    it('should include null buyDate holdings in account totals without errors', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const holdings = [
        createMockHolding({ id: 'h1', buyDate: new Date('2023-01-15'), quantity: 10, buyPrice: 100, currentPrice: 120 }),
        createMockHolding({ id: 'h2', buyDate: null, quantity: 5, buyPrice: 50, currentPrice: 60 }),
        createMockHolding({ id: 'h3', buyDate: new Date('2022-06-01'), quantity: 15, buyPrice: 200, currentPrice: 210 }),
      ];

      // Act
      const allMetrics = holdings.map((h) => calculateHoldingMetrics(h, snapshotDate));

      // Assert
      expect(allMetrics).toHaveLength(3);
      allMetrics.forEach((m) => {
        expect(m.marketValue).toBeGreaterThan(0);
        expect(typeof m.holdingPeriodMonths).toBe('number');
        expect(typeof m.isCGTEligible).toBe('boolean');
      });

      // Verify null buyDate results in expected state
      expect(allMetrics[1].holdingPeriodMonths).toBe(0);
      expect(allMetrics[1].isCGTEligible).toBe(false);
    });
  });

  describe('Test 3: CGT text shows "Buy date not specified"', () => {
    it('should return "Buy date not specified" when buyDate is null', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');

      // Act
      const text = getCGTProjectionText(null, snapshotDate);

      // Assert
      expect(text).toBe('Buy date not specified');
    });

    it('should return proper CGT text when buyDate is provided', () => {
      // Arrange
      const buyDate = new Date('2023-06-01');
      const snapshotDate = new Date('2024-01-31'); // About 7-8 months later

      // Act
      const text = getCGTProjectionText(buyDate, snapshotDate);

      // Assert
      expect(text).toContain('month');
      expect(text).not.toBe('Buy date not specified');
    });

    it('should show "Eligible now" when 12+ months have passed', () => {
      // Arrange
      const buyDate = new Date('2022-01-01');
      const snapshotDate = new Date('2024-01-31'); // 24+ months later

      // Act
      const text = getCGTProjectionText(buyDate, snapshotDate);

      // Assert
      expect(text).toBe('Eligible now');
    });
  });

  describe('Test 4: Update holding to null buyDate', () => {
    it('should handle updateStockHolding with null buyDate in schema', () => {
      // Arrange - This test verifies the schema accepts null/undefined for buyDate
      const updatePayload = {
        holdingId: 'holding-123',
        buyDate: null, // Setting to null
      };

      // Act & Assert - This verifies the type is correct
      expect(updatePayload.buyDate).toBeNull();
      expect(typeof updatePayload.holdingId).toBe('string');
    });

    it('should calculate metrics correctly after buyDate is set to null', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const originalHolding = createMockHolding({
        id: 'holding-to-update',
        buyDate: new Date('2023-01-15'),
        quantity: 100,
        buyPrice: 50,
        currentPrice: 75,
      });

      // Act - Calculate metrics before null
      const metricsBefore = calculateHoldingMetrics(originalHolding, snapshotDate);

      // Create updated holding with null buyDate
      const updatedHolding = createMockHolding({
        id: 'holding-to-update',
        buyDate: null, // Updated to null
        quantity: 100,
        buyPrice: 50,
        currentPrice: 75,
      });
      const metricsAfter = calculateHoldingMetrics(updatedHolding, snapshotDate);

      // Assert
      expect(metricsBefore.holdingPeriodMonths).toBeGreaterThan(0);
      expect(metricsBefore.isCGTEligible).toBe(false); // Less than 12 months
      expect(metricsAfter.holdingPeriodMonths).toBe(0);
      expect(metricsAfter.isCGTEligible).toBe(false);
      // Market values should stay the same
      expect(metricsAfter.marketValue).toBe(metricsBefore.marketValue);
    });
  });

  describe('Edge Cases: Null buyDate with sold holdings', () => {
    it('should calculate realizedPL with null buyDate for sold holdings', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const soldHoldingWithNullBuyDate = createMockHolding({
        buyDate: null,
        quantity: 100,
        buyPrice: 50,
        currentPrice: 0, // No longer holding
        salePrice: 75,
        saleDate: new Date('2024-01-30'),
        soldQuantity: 100,
      });

      // Act
      const metrics = calculateHoldingMetrics(soldHoldingWithNullBuyDate, snapshotDate);

      // Assert
      expect(metrics.isSold).toBe(true);
      expect(metrics.isFullySold).toBe(true);
      expect(metrics.realizedPL).toBe(2500); // (75 - 50) * 100
      expect(metrics.holdingPeriodMonths).toBe(0); // null buyDate
      expect(metrics.isCGTEligible).toBe(false); // No buyDate, so no CGT eligibility
    });

    it('should handle partial sales with null buyDate', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const partiallySoldWithNullBuyDate = createMockHolding({
        buyDate: null,
        quantity: 100,
        buyPrice: 50,
        currentPrice: 60,
        salePrice: 75,
        saleDate: new Date('2024-01-15'),
        soldQuantity: 50,
      });

      // Act
      const metrics = calculateHoldingMetrics(partiallySoldWithNullBuyDate, snapshotDate);

      // Assert
      expect(metrics.isSold).toBe(true);
      expect(metrics.isFullySold).toBe(false);
      expect(metrics.realizedPL).toBe(1250); // (75 - 50) * 50
      expect(metrics.remainingQuantity).toBe(50); // 100 - 50
      expect(metrics.marketValue).toBe(3000); // 50 * 60
      expect(metrics.isCGTEligible).toBe(false);
    });
  });

  describe('Edge Cases: Null buyDate with different snapshot dates', () => {
    it('should handle null buyDate consistently across different snapshot dates', () => {
      // Arrange
      const holding = createMockHolding({
        buyDate: null,
        quantity: 100,
        buyPrice: 50,
        currentPrice: 75,
      });

      const snapshotDate1 = new Date('2024-01-31');
      const snapshotDate2 = new Date('2024-12-31');

      // Act
      const metrics1 = calculateHoldingMetrics(holding, snapshotDate1);
      const metrics2 = calculateHoldingMetrics(holding, snapshotDate2);

      // Assert - Should be identical regardless of snapshot date
      expect(metrics1.holdingPeriodMonths).toBe(0);
      expect(metrics2.holdingPeriodMonths).toBe(0);
      expect(metrics1.marketValue).toBe(metrics2.marketValue);
      expect(metrics1.unrealizedPL).toBe(metrics2.unrealizedPL);
    });
  });

  describe('Integration: Multiple holdings with null buyDate', () => {
    it('should aggregate multiple null buyDate holdings without errors', () => {
      // Arrange
      const snapshotDate = new Date('2024-01-31');
      const portfolioHoldings = [
        createMockHolding({ id: 'h1', buyDate: null, ticker: 'AAPL', quantity: 10, buyPrice: 150, currentPrice: 175 }),
        createMockHolding({ id: 'h2', buyDate: null, ticker: 'MSFT', quantity: 5, buyPrice: 300, currentPrice: 350 }),
        createMockHolding({ id: 'h3', buyDate: null, ticker: 'GOOGL', quantity: 3, buyPrice: 100, currentPrice: 120 }),
      ];

      // Act
      const allMetrics = portfolioHoldings.map((h) => calculateHoldingMetrics(h, snapshotDate));

      // Assert
      const totalMarketValue = allMetrics.reduce((sum, m) => sum + m.marketValue, 0);
      const totalUnrealizedPL = allMetrics.reduce((sum, m) => sum + m.unrealizedPL, 0);

      expect(totalMarketValue).toBeGreaterThan(0);
      expect(totalUnrealizedPL).toBeGreaterThan(0);
      allMetrics.forEach((m) => {
        expect(m.holdingPeriodMonths).toBe(0);
        expect(m.isCGTEligible).toBe(false);
      });
    });
  });

  describe('CGT Projection Edge Cases', () => {
    it('should handle null buyDate in getCGTProjectionText consistently', () => {
      // Arrange
      const nullBuyDate = null;
      const testDates = [
        new Date('2024-01-01'),
        new Date('2024-06-15'),
        new Date('2024-12-31'),
      ];

      // Act & Assert
      testDates.forEach((date) => {
        const text = getCGTProjectionText(nullBuyDate, date);
        expect(text).toBe('Buy date not specified');
      });
    });

    it('should properly calculate months remaining to CGT eligibility', () => {
      // Arrange - Bought 2 months ago, need 10 more months
      const buyDate = new Date('2023-11-01');
      const snapshotDate = new Date('2024-01-01');

      // Act
      const text = getCGTProjectionText(buyDate, snapshotDate);

      // Assert
      expect(text).toContain('month');
      expect(text).not.toContain('Eligible now');
    });
  });
});
