import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { getYearlyCleansingData } from '@/server/services/bank-interest/interest-cleansing.service';

describe('interest-cleansing.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getYearlyCleansingData', () => {
    // TEST 1: dateFrom uses calendarYear.fromMonth (not hardcoded January)
    it('should use calendarYear.fromMonth for dateFrom (not hardcoded January)', async () => {
      const calendarYearId = 'fy-2024';
      const userId = 'user-1';
      const bankId = 'bank-1';

      // Setup: Fiscal year starting July (month 7)
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7, // July - should NOT be hardcoded to January
        toYear: 2025,
        toMonth: 6, // June
        type: 'FISCAL',
        userId,
      } as never);

      prismaMock.bankInterestLiability.findMany.mockResolvedValue([]);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.donationPayment.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(bankId, calendarYearId, userId);

      // Verify dateFrom is July 1, 2024 (not Jan 1)
      expect(result.dateFrom).toBe('2024-07-01');

      // Verify the transaction query used the correct date range
      expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );

      const callArg = (prismaMock.transaction.findMany as any).mock.calls[0][0];
      expect(callArg.where.date.gte.toISOString().slice(0, 10)).toBe('2024-07-01');
    });

    // TEST 2: dateTo uses calendarYear.toYear/toMonth (not hardcoded December)
    it('should use calendarYear.toYear/toMonth for dateTo (not hardcoded December)', async () => {
      const calendarYearId = 'fy-2024';
      const userId = 'user-1';
      const bankId = 'bank-1';

      // Setup: Fiscal year Jul-Jun
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7,
        toYear: 2025,
        toMonth: 6, // June - should NOT be hardcoded to December
        type: 'FISCAL',
        userId,
      } as never);

      prismaMock.bankInterestLiability.findMany.mockResolvedValue([]);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.donationPayment.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(bankId, calendarYearId, userId);

      // Verify dateTo is June 30, 2025 (not Dec 31)
      expect(result.dateTo).toBe('2025-06-30');

      // Verify the transaction query used the correct date range
      const callArg = (prismaMock.transaction.findMany as any).mock.calls[0][0];
      expect(callArg.where.date.lte.toISOString().slice(0, 10)).toBe('2025-06-30');
    });

    // TEST 3: Fiscal year window (Jul–Jun) produces correct dateFrom/dateTo
    it('should produce correct date window for fiscal year (Jul-Jun)', async () => {
      const calendarYearId = 'fy-2024-2025';
      const userId = 'user-1';
      const bankId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7, // July
        toYear: 2025,
        toMonth: 6, // June
        type: 'FISCAL',
        userId,
      } as never);

      prismaMock.bankInterestLiability.findMany.mockResolvedValue([]);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.donationPayment.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(bankId, calendarYearId, userId);

      expect(result.dateFrom).toBe('2024-07-01');
      expect(result.dateTo).toBe('2025-06-30');

      // Verify 12-month fiscal window
      const fromDate = new Date(result.dateFrom);
      const toDate = new Date(result.dateTo);
      const monthDiff = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + 
                        (toDate.getMonth() - fromDate.getMonth());
      expect(monthDiff).toBe(11); // 12 months span = 11 month difference
    });

    // TEST 4: Donation query uses datePaid range, not calendarId FK
    it('should use datePaid date range in donation query (not calendarId FK)', async () => {
      const calendarYearId = 'fy-2024';
      const userId = 'user-1';
      const bankId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7,
        toYear: 2025,
        toMonth: 6,
        type: 'FISCAL',
        userId,
      } as never);

      prismaMock.bankInterestLiability.findMany.mockResolvedValue([]);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.donationPayment.findMany.mockResolvedValue([]);

      await getYearlyCleansingData(bankId, calendarYearId, userId);

      // Verify donation query uses datePaid, NOT donationLedger.calendarId
      expect(prismaMock.donationPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            donationPurpose: 'INTEREST_CLEANSING',
            datePaid: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      );

      const callArg = (prismaMock.donationPayment.findMany as any).mock.calls[0][0];
      // Ensure donationLedger.calendarId is NOT in the query
      expect(callArg.where.donationLedger).toBeUndefined();
      // Ensure datePaid IS in the query
      expect(callArg.where.datePaid).toBeDefined();
    });

    // TEST 5: YearlyCleansingData includes dateFrom and dateTo strings
    it('should include dateFrom and dateTo as ISO date strings in return type', async () => {
      const calendarYearId = 'annual-2024';
      const userId = 'user-1';
      const bankId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);

      prismaMock.bankInterestLiability.findMany.mockResolvedValue([
        {
          id: 'liability-1',
          bankId,
          calendarId: calendarYearId,
          month: 1,
          year: 2024,
          amountDue: new Decimal('50.00'),
        } as never,
      ]);

      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.donationPayment.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(bankId, calendarYearId, userId);

      // Verify return type includes dateFrom and dateTo as ISO date strings
      expect(result).toHaveProperty('dateFrom');
      expect(result).toHaveProperty('dateTo');
      expect(typeof result.dateFrom).toBe('string');
      expect(typeof result.dateTo).toBe('string');

      // Verify format is YYYY-MM-DD
      expect(result.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify correct values
      expect(result.dateFrom).toBe('2024-01-01');
      expect(result.dateTo).toBe('2024-12-31');
    });
  });
});
