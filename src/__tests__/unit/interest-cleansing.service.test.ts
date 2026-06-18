import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import {
  getYearlyCleansingData,
  applyAllocations,
} from '@/server/services/interest-cleansing/interest-cleansing.service';

describe('interest-cleansing.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getYearlyCleansingData', () => {
    // TEST 1: dateFrom uses calendarYear.fromMonth (not hardcoded January)
    it('should use calendarYear.fromMonth for dateFrom (not hardcoded January)', async () => {
      const calendarYearId = 'fy-2024';
      const userId = 'user-1';
      const institutionId = 'bank-1';

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
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

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
      const institutionId = 'bank-1';

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
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

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
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7, // July
        toYear: 2025,
        toMonth: 6, // June
        type: 'FISCAL',
        userId,
      } as never);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

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
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7,
        toYear: 2025,
        toMonth: 6,
        type: 'FISCAL',
        userId,
      } as never);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Verify donation query uses datePaid, NOT donationLedger.calendarId
      expect(prismaMock.interestCleansing.findMany).toHaveBeenCalledWith(
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

      const callArg = (prismaMock.interestCleansing.findMany as any).mock.calls[0][0];
      // Ensure donationLedger.calendarId is NOT in the query
      expect(callArg.where.donationLedger).toBeUndefined();
      // Ensure datePaid IS in the query
      expect(callArg.where.datePaid).toBeDefined();
    });

    // TEST 5: YearlyCleansingData includes dateFrom and dateTo strings
    it('should include dateFrom and dateTo as ISO date strings in return type', async () => {
      const calendarYearId = 'annual-2024';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);

      
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

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

    // TEST 6: Transaction query uses category-based OR clause (Credit Interest anchor)
    it('should query transactions by category Credit Interest and Bank Interest (not description)', async () => {
      const calendarYearId = 'annual-2024';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);
      prismaMock.financialAccount.findMany.mockResolvedValue([]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      await getYearlyCleansingData(institutionId, calendarYearId, userId);

      const callArg = (prismaMock.transaction.findMany as any).mock.calls[0][0];
      const orClauses = callArg.where.OR as Array<Record<string, unknown>>;

      // Must include category-based clauses
      expect(orClauses).toContainEqual({ category: { equals: 'Credit Interest', mode: 'insensitive' } });
      expect(orClauses).toContainEqual({ category: { equals: 'Bank Interest', mode: 'insensitive' } });

      // Must NOT fall back to description-based matching
      const hasDescriptionFallback = orClauses.some((c) => 'description' in c);
      expect(hasDescriptionFallback).toBe(false);
    });

    // TEST 7: Returns correct interest/donation totals for ANNUAL year (Jan-Dec)
    it('should return correct totals for ANNUAL year (Jan-Dec)', async () => {
      const calendarYearId = 'annual-2024';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 1, // January
        toYear: 2024,
        toMonth: 12, // December
        type: 'ANNUAL',
        userId,
      } as never);

      // Mock interest transactions: $100 in Jan, $50 in Feb, $75 in Mar = $225 total
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          date: new Date('2024-01-15'),
          description: 'Interest Credit',
          amount: new Decimal('100'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-2',
          date: new Date('2024-02-15'),
          description: 'Interest Credit',
          amount: new Decimal('50'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-3',
          date: new Date('2024-03-15'),
          description: 'Interest Credit',
          amount: new Decimal('75'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock cleansing donations: $100 + $50 = $150 total
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-1',
          datePaid: new Date('2024-01-20'),
          amount: new Decimal('100'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity A' },
          individual: null,
          transactionId: 'tx-1',
          evidence: [],
        } as never,
        {
          id: 'dp-2',
          datePaid: new Date('2024-02-20'),
          amount: new Decimal('50'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'INDIVIDUAL',
          business: null,
          individual: { firstName: 'John', lastName: 'Doe' },
          transactionId: null,
          evidence: [],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Verify totals
      expect(result.yearlySummary.totalReceived).toBe(225); // $100 + $50 + $75
      expect(result.yearlySummary.totalCleansed).toBe(150); // $100 + $50
      expect(result.yearlySummary.balance).toBe(75); // $225 - $150
      expect(result.cleansingDonations).toHaveLength(2);
    });

    // TEST 8: Returns correct interest/donation totals for FISCAL year (Jul-Jun)
    it('should return correct totals for FISCAL year (Jul-Jun)', async () => {
      const calendarYearId = 'fy-2024-2025';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 7, // July
        toYear: 2025,
        toMonth: 6, // June
        type: 'FISCAL',
        userId,
      } as never);

      // Mock interest transactions spanning fiscal year: $80 (Jul-2024) + $120 (Jun-2025) = $200
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          date: new Date('2024-07-15'),
          description: 'Interest Credit',
          amount: new Decimal('80'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-2',
          date: new Date('2025-06-15'),
          description: 'Interest Credit',
          amount: new Decimal('120'),
          type: 'CREDIT',
          category: 'Bank Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock cleansing donations: $80 only (linked to tx-1)
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-1',
          datePaid: new Date('2024-07-20'),
          amount: new Decimal('80'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity B' },
          individual: null,
          interestTxId: 'tx-1',
          evidence: [
            {
              id: 'ev-1',
              amountApplied: new Decimal('80'),
              evidenceTransaction: { description: 'Donation B', date: new Date('2024-07-20') },
            },
          ],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);


      // Verify totals
      expect(result.yearlySummary.totalReceived).toBe(200); // $80 + $120
      expect(result.yearlySummary.totalCleansed).toBe(80); // $80
      expect(result.yearlySummary.balance).toBe(120); // $200 - $80
      expect(result.unlinkedInterestCount).toBe(1); // tx-2 is unlinked
    });

    // TEST 9: Back-dated CalendarYear includes all matching records in window
    it('should include all interest and donation records within window for back-dated calendar', async () => {
      const calendarYearId = 'backdated-2023';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Back-dated calendar: Oct 2022 - Sep 2023 (12-month fiscal year)
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2022,
        fromMonth: 10,
        toYear: 2023,
        toMonth: 9,
        type: 'FISCAL',
        userId,
      } as never);

      // Mock interest transactions spread across the back-dated window
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          date: new Date('2022-10-05'),
          description: 'Interest Credit',
          amount: new Decimal('10'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-2',
          date: new Date('2023-03-10'),
          description: 'Interest Credit',
          amount: new Decimal('20'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-3',
          date: new Date('2023-09-28'),
          description: 'Interest Credit',
          amount: new Decimal('30'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock donations all within the back-dated window
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-1',
          datePaid: new Date('2022-10-10'),
          amount: new Decimal('10'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity C' },
          individual: null,
          interestTxId: 'tx-1',
          evidence: [
            {
              id: 'ev-1',
              amountApplied: new Decimal('10'),
              evidenceTransaction: { description: 'Donation C', date: new Date('2022-10-10') },
            },
          ],
        } as never,
      ]);

        const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);


      // Verify 12-month fiscal window is generated (Oct-Sep)
      expect(result.monthlyCredits.length).toBe(12); // 12 months in fiscal window
      const totalMonthlyReceived = result.monthlyCredits.reduce(
        (sum, m) => sum + m.receivedFromLedger,
        0
      );
      expect(totalMonthlyReceived).toBe(60); // $10 + $20 + $30

      // Verify donation is included
      expect(result.cleansingDonations).toHaveLength(1);
      expect(result.yearlySummary.totalCleansed).toBe(10);

      // Verify the correct months are generated
      const firstMonth = result.monthlyCredits[0];
      expect(firstMonth).toBeDefined();
      expect(firstMonth!.month).toBe(10); // October
      expect(firstMonth!.year).toBe(2022);

      const lastMonth = result.monthlyCredits[11];
      expect(lastMonth).toBeDefined();
      expect(lastMonth!.month).toBe(9); // September
      expect(lastMonth!.year).toBe(2023);
    });

    // TEST 10: Donations outside date window are excluded
    it('should exclude donations outside the calendar window', async () => {
      const calendarYearId = 'annual-2024';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2024,
        fromMonth: 1,
        toYear: 2024,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);

      // Mock transactions within window
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          date: new Date('2024-06-15'),
          description: 'Interest Credit',
          amount: new Decimal('100'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock donations: one inside window, one before, one after
      // NOTE: Service queries by datePaid, so only donations within the window should be returned
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-1',
          datePaid: new Date('2024-06-20'),
          amount: new Decimal('50'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Inside Window' },
          individual: null,
          transactionId: null,
          evidence: [],
        } as never,
        // NOTE: These would NOT be returned by Prisma because the query filters by datePaid
        // We're testing that the service correctly passes datePaid filters to the query
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Verify only donations within window are included
      expect(result.cleansingDonations).toHaveLength(1);
      expect(result.cleansingDonations[0]).toBeDefined();
      expect(result.cleansingDonations[0]!.datePaid).toEqual(new Date('2024-06-20'));
      expect(result.yearlySummary.totalCleansed).toBe(50);

      // Verify the service queried with correct date range
      const donationCallArg = (prismaMock.interestCleansing.findMany as any).mock.calls[0][0];
      const dateFromQuery = donationCallArg.where.datePaid.gte;
      const dateToQuery = donationCallArg.where.datePaid.lte;

      // Verify query dates match calendar window
      expect(dateFromQuery.toISOString().slice(0, 10)).toBe('2024-01-01');
      expect(dateToQuery.toISOString().slice(0, 10)).toBe('2024-12-31');
    });
  }); // end describe('getYearlyCleansingData')

  describe('applyAllocations', () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation((cb) => cb(prismaMock as any));
    });

    it('should set sourceBusinessId to the provided value when creating a new InterestCleansing record', async () => {
      const creditId = 'tx-credit-1';
      const allocations = [{ evidenceId: 'tx-debit-1', amount: 50 }];
      const userId = 'user-1';
      const sourceBusinessId = 'beneficiary-business-1';

      prismaMock.transaction.findUniqueOrThrow.mockResolvedValue({
        id: creditId,
        date: new Date('2026-06-15'),
        amount: new Decimal('100'),
      } as any);

      prismaMock.interestCleansing.findUnique.mockResolvedValue(null);
      prismaMock.donationLedger.findFirst.mockResolvedValue({ id: 'ledger-1' } as any);
      prismaMock.interestCleansing.create.mockResolvedValue({ id: 'cleansing-1' } as any);
      prismaMock.interestCleansingEvidence.upsert.mockResolvedValue({} as any);

      const result = await applyAllocations(creditId, allocations, userId, sourceBusinessId);

      expect(result.success).toBe(true);
      expect(prismaMock.interestCleansing.create).toHaveBeenCalledWith({
        data: {
          datePaid: expect.any(Date),
          amount: expect.any(Decimal),
          donationLedgerId: 'ledger-1',
          creditTxId: creditId,
          sourceBusinessId: sourceBusinessId,
        },
      });
    });

    it('should set sourceBusinessId to null when no value is provided', async () => {
      const creditId = 'tx-credit-1';
      const allocations = [{ evidenceId: 'tx-debit-1', amount: 50 }];
      const userId = 'user-1';

      prismaMock.transaction.findUniqueOrThrow.mockResolvedValue({
        id: creditId,
        date: new Date('2026-06-15'),
        amount: new Decimal('100'),
      } as any);

      prismaMock.interestCleansing.findUnique.mockResolvedValue(null);
      prismaMock.donationLedger.findFirst.mockResolvedValue({ id: 'ledger-1' } as any);
      prismaMock.interestCleansing.create.mockResolvedValue({ id: 'cleansing-1' } as any);
      prismaMock.interestCleansingEvidence.upsert.mockResolvedValue({} as any);

      const result = await applyAllocations(creditId, allocations, userId);

      expect(result.success).toBe(true);
      expect(prismaMock.interestCleansing.create).toHaveBeenCalledWith({
        data: {
          datePaid: expect.any(Date),
          amount: expect.any(Decimal),
          donationLedgerId: 'ledger-1',
          creditTxId: creditId,
          sourceBusinessId: null,
        },
      });
    });
  });
}); // end describe('interest-cleansing.service')
