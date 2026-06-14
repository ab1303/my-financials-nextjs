import { Decimal } from '@prisma/client/runtime/library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { getYearlyCleansingData } from '@/server/services/bank-interest/interest-cleansing.service';

describe('interest-cleansing-phase3: Historical CalendarYear Back-Dating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Phase 3: Create/select historical CalendarYear (e.g., Annual 2022, Fiscal 2021-22)', () => {
    // PHASE 3 TEST 1: Historical ANNUAL year (2022)
    it('should return correct interest/donation totals for historical ANNUAL year (Jan-Dec 2022)', async () => {
      const calendarYearId = 'annual-2022';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Setup: Historical annual year 2022
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2022,
        fromMonth: 1, // January 2022
        toYear: 2022,
        toMonth: 12, // December 2022
        type: 'ANNUAL',
        userId,
      } as never);

      // Mock historical interest transactions in 2022
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-2022-001',
          date: new Date('2022-01-15'),
          description: 'Interest Credit',
          amount: new Decimal('50'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-2022-002',
          date: new Date('2022-06-20'),
          description: 'Interest Credit',
          amount: new Decimal('75'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-2022-003',
          date: new Date('2022-12-30'),
          description: 'Interest Credit',
          amount: new Decimal('100'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock cleansing donations for 2022
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-2022-001',
          datePaid: new Date('2022-01-20'),
          amount: new Decimal('50'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity A' },
          individual: null,
          interestTxId: 'tx-2022-001',
          evidence: [],
        } as never,
        {
          id: 'dp-2022-002',
          datePaid: new Date('2022-06-25'),
          amount: new Decimal('75'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'INDIVIDUAL',
          business: null,
          individual: { firstName: 'Jane', lastName: 'Smith' },
          interestTxId: 'tx-2022-002',
          evidence: [],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Validate ANNUAL year window
      expect(result.dateFrom).toBe('2022-01-01');
      expect(result.dateTo).toBe('2022-12-31');

      // Validate totals:  +  +  =  received
      expect(result.yearlySummary.totalReceived).toBe(225);
      // Cleansed:  +  = 
      expect(result.yearlySummary.totalCleansed).toBe(125);
      // Balance:  -  = 
      expect(result.yearlySummary.balance).toBe(100);

      // Validate unlinked interest (tx-2022-003 is not linked to any donation)
      expect(result.unlinkedInterestCount).toBe(1);

      // Validate donations
      expect(result.cleansingDonations).toHaveLength(2);
    });

    // PHASE 3 TEST 2: Historical FISCAL year (Fiscal 2021-22)
    it('should return correct interest/donation totals for historical FISCAL year (Jul 2021 - Jun 2022)', async () => {
      const calendarYearId = 'fiscal-2021-2022';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Setup: Historical fiscal year from Jul 2021 to Jun 2022
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2021,
        fromMonth: 7, // July 2021
        toYear: 2022,
        toMonth: 6, // June 2022
        type: 'FISCAL',
        userId,
      } as never);

      // Mock historical interest transactions across fiscal year
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-fy-001',
          date: new Date('2021-07-10'),
          description: 'Interest Credit',
          amount: new Decimal('60'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-fy-002',
          date: new Date('2021-12-15'),
          description: 'Interest Credit',
          amount: new Decimal('70'),
          type: 'CREDIT',
          category: 'Bank Interest', // Legacy category
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-fy-003',
          date: new Date('2022-03-05'),
          description: 'Interest Credit',
          amount: new Decimal('80'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-fy-004',
          date: new Date('2022-06-20'),
          description: 'Interest Credit',
          amount: new Decimal('90'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock cleansing donations for fiscal year
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-fy-001',
          datePaid: new Date('2021-07-15'),
          amount: new Decimal('60'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity FY1' },
          individual: null,
          interestTxId: 'tx-fy-001',
          evidence: [],
        } as never,
        {
          id: 'dp-fy-002',
          datePaid: new Date('2022-03-10'),
          amount: new Decimal('80'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'INDIVIDUAL',
          business: null,
          individual: { firstName: 'Donor', lastName: 'FY' },
          interestTxId: 'tx-fy-003',
          evidence: [],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Validate FISCAL year window (Jul 2021 - Jun 2022)
      expect(result.dateFrom).toBe('2021-07-01');
      expect(result.dateTo).toBe('2022-06-30');

      // Validate totals:  +  +  +  =  received
      expect(result.yearlySummary.totalReceived).toBe(300);
      // Cleansed:  +  = 
      expect(result.yearlySummary.totalCleansed).toBe(140);
      // Balance:  -  = 
      expect(result.yearlySummary.balance).toBe(160);

      // Validate unlinked interest (tx-fy-002 and tx-fy-004 are not linked)
      expect(result.unlinkedInterestCount).toBe(2);

      // Validate donations
      expect(result.cleansingDonations).toHaveLength(2);
    });

    // PHASE 3 TEST 3: Back-dated CalendarYear includes all matching records within window
    it('should include all transactions and donations within back-dated window (Oct 2022 - Sep 2023)', async () => {
      const calendarYearId = 'backdated-fy-2022-2023';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Setup: Back-dated fiscal year Oct 2022 - Sep 2023
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2022,
        fromMonth: 10, // October 2022
        toYear: 2023,
        toMonth: 9, // September 2023
        type: 'FISCAL',
        userId,
      } as never);

      // Mock interest transactions across the full back-dated window
      prismaMock.transaction.findMany.mockResolvedValue([
        // October 2022
        {
          id: 'tx-bd-001',
          date: new Date('2022-10-05'),
          description: 'Interest Credit',
          amount: new Decimal('15'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        // December 2022
        {
          id: 'tx-bd-002',
          date: new Date('2022-12-10'),
          description: 'Interest Credit',
          amount: new Decimal('20'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        // March 2023
        {
          id: 'tx-bd-003',
          date: new Date('2023-03-15'),
          description: 'Interest Credit',
          amount: new Decimal('25'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        // September 2023 (end of window)
        {
          id: 'tx-bd-004',
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

      // Mock cleansing donations across the back-dated window
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-bd-001',
          datePaid: new Date('2022-10-10'),
          amount: new Decimal('15'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Back-Dated Charity 1' },
          individual: null,
          interestTxId: 'tx-bd-001',
          evidence: [],
        } as never,
        {
          id: 'dp-bd-002',
          datePaid: new Date('2023-03-20'),
          amount: new Decimal('25'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'INDIVIDUAL',
          business: null,
          individual: { firstName: 'Back', lastName: 'Donor' },
          interestTxId: 'tx-bd-003',
          evidence: [],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Validate back-dated fiscal window (Oct 2022 - Sep 2023)
      expect(result.dateFrom).toBe('2022-10-01');
      expect(result.dateTo).toBe('2023-09-30');

      // Validate 12 months are generated
      expect(result.monthlyCredits).toHaveLength(12);

      // Validate first month is October 2022
      expect(result.monthlyCredits[0]?.month).toBe(10);
      expect(result.monthlyCredits[0]?.year).toBe(2022);

      // Validate last month is September 2023
      expect(result.monthlyCredits[11]?.month).toBe(9);
      expect(result.monthlyCredits[11]?.year).toBe(2023);

      // Validate totals:  +  +  +  =  received
      expect(result.yearlySummary.totalReceived).toBe(90);
      // Cleansed:  +  = 
      expect(result.yearlySummary.totalCleansed).toBe(40);
      // Balance:  -  = 
      expect(result.yearlySummary.balance).toBe(50);

      // Validate unlinked interest (tx-bd-002 and tx-bd-004 are not linked)
      expect(result.unlinkedInterestCount).toBe(2);

      // Validate all donations are included
      expect(result.cleansingDonations).toHaveLength(2);
    });

    // PHASE 3 TEST 4: Donations outside window are excluded
    it('should exclude donations outside the back-dated calendar window', async () => {
      const calendarYearId = 'back-dated-2023';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Setup: Back-dated calendar for 2023 only
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2023,
        fromMonth: 1, // January 2023
        toYear: 2023,
        toMonth: 12, // December 2023
        type: 'ANNUAL',
        userId,
      } as never);

      // Mock interest transactions within 2023 only
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-2023-in-window',
          date: new Date('2023-06-15'),
          description: 'Interest Credit',
          amount: new Decimal('100'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock donations: only one inside the 2023 window
      // The service filters by datePaid range, so outside donations would never be returned by Prisma
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-2023-inside',
          datePaid: new Date('2023-06-20'),
          amount: new Decimal('100'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity 2023' },
          individual: null,
          interestTxId: 'tx-2023-in-window',
          evidence: [],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Verify donation query was called with correct window
      const donationCallArg = (prismaMock.interestCleansing.findMany as any)?.mock?.calls?.[0]?.[0];
      const dateFromQuery = donationCallArg?.where?.datePaid?.gte;
      const dateToQuery = donationCallArg?.where?.datePaid?.lte;

      expect(dateFromQuery?.toISOString().slice(0, 10)).toBe('2023-01-01');
      expect(dateToQuery?.toISOString().slice(0, 10)).toBe('2023-12-31');

      // Verify only donations within window are included
      expect(result.cleansingDonations).toHaveLength(1);
      expect(result.cleansingDonations[0].datePaid).toEqual(new Date('2023-06-20'));
      expect(result.yearlySummary.totalCleansed).toBe(100);
    });

    // PHASE 3 TEST 5: Service respects fromMonth/toMonth (no hardcoded Jan-Dec)
    it('should respect custom fromMonth/toMonth, not use hardcoded January-December', async () => {
      const calendarYearId = 'custom-window';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Setup: Custom fiscal window Apr 2022 - Mar 2023 (not Jan-Dec)
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2022,
        fromMonth: 4, // April (NOT January)
        toYear: 2023,
        toMonth: 3, // March (NOT December)
        type: 'FISCAL',
        userId,
      } as never);

      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-custom-001',
          date: new Date('2022-04-10'),
          description: 'Interest Credit',
          amount: new Decimal('50'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-custom-002',
          date: new Date('2023-03-20'),
          description: 'Interest Credit',
          amount: new Decimal('50'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Verify custom window is used (Apr 2022 - Mar 2023), NOT Jan-Dec
      expect(result.dateFrom).toBe('2022-04-01');
      expect(result.dateTo).toBe('2023-03-31');

      // Verify monthly credits are generated from April to March
      expect(result.monthlyCredits).toHaveLength(12);
      expect(result.monthlyCredits[0]?.month).toBe(4); // April
      expect(result.monthlyCredits[11]?.month).toBe(3); // March
    });

    // PHASE 3 TEST 6: Monthly credits span full window with correct months
    it('should generate 12 monthly credits for full fiscal window (Oct 2022 - Sep 2023)', async () => {
      const calendarYearId = 'monthly-test';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2022,
        fromMonth: 10,
        toYear: 2023,
        toMonth: 9,
        type: 'FISCAL',
        userId,
      } as never);

      // Mock one transaction per month to verify all 12 months are captured
      const transactions: any[] = [];
      const startMonth = 10;
      const startYear = 2022;
      for (let i = 0; i < 12; i++) {
        const month = ((startMonth - 1 + i) % 12) + 1;
        const year = startYear + Math.floor((startMonth - 1 + i) / 12);
        const day = 15;
        transactions.push({
          id: `tx-month-${i}`,
          date: new Date(year, month - 1, day),
          description: 'Interest Credit',
          amount: new Decimal('10'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never);
      }
      prismaMock.transaction.findMany.mockResolvedValue(transactions);
      prismaMock.interestCleansing.findMany.mockResolvedValue([]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Verify exactly 12 monthly credits
      expect(result.monthlyCredits).toHaveLength(12);

      // Verify correct months: Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep
      const expectedMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const expectedYears = [2022, 2022, 2022, 2023, 2023, 2023, 2023, 2023, 2023, 2023, 2023, 2023];

      result.monthlyCredits.forEach((credit, index) => {
        expect(credit.month).toBe(expectedMonths[index]);
        expect(credit.year).toBe(expectedYears[index]);
        expect(credit.receivedFromLedger).toBe(10); // One transaction per month
      });

      // Verify total
      expect(result.yearlySummary.totalReceived).toBe(120); // 12 months × 
    });

    // PHASE 3 TEST 7: Validate totals computation (totalReceived, totalCleansed, balance)
    it('should compute correct totals: totalReceived - totalCleansed = balance', async () => {
      const calendarYearId = 'totals-test';
      const userId = 'user-1';
      const institutionId = 'bank-1';

      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValue({
        id: calendarYearId,
        fromYear: 2023,
        fromMonth: 1,
        toYear: 2023,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);

      // Mock multiple transactions with various amounts
      prismaMock.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-t1',
          date: new Date('2023-01-10'),
          description: 'Interest',
          amount: new Decimal('100.50'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-t2',
          date: new Date('2023-06-15'),
          description: 'Interest',
          amount: new Decimal('250.75'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
        {
          id: 'tx-t3',
          date: new Date('2023-12-20'),
          description: 'Interest',
          amount: new Decimal('300.25'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);

      // Mock donations with partial cleansing
      prismaMock.interestCleansing.findMany.mockResolvedValue([
        {
          id: 'dp-t1',
          datePaid: new Date('2023-01-15'),
          amount: new Decimal('100.50'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'BUSINESS',
          business: { name: 'Charity' },
          individual: null,
          interestTxId: 'tx-t1',
          evidence: [],
        } as never,
        {
          id: 'dp-t2',
          datePaid: new Date('2023-06-20'),
          amount: new Decimal('150.00'),
          donationPurpose: 'INTEREST_CLEANSING',
          beneficiaryType: 'INDIVIDUAL',
          business: null,
          individual: { firstName: 'John', lastName: 'Doe' },
          interestTxId: null,
          evidence: [],
        } as never,
      ]);

      const result = await getYearlyCleansingData(institutionId, calendarYearId, userId);

      // Calculate expected values
      // totalReceived = 100.50 + 250.75 + 300.25 = 651.50
      expect(result.yearlySummary.totalReceived).toBe(651.50);

      // totalCleansed = 100.50 + 150.00 = 250.50
      expect(result.yearlySummary.totalCleansed).toBe(250.50);

      // balance = 651.50 - 250.50 = 401.00
      expect(result.yearlySummary.balance).toBe(401.00);
    });

    // PHASE 3 TEST 8: Multiple back-dated years can be queried independently
    it('should support multiple independent back-dated queries (2021, 2022, 2023)', async () => {
      const userId = 'user-1';
      const institutionId = 'bank-1';

      // Test 2021
      const calendarYear2021 = 'annual-2021';
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValueOnce({
        id: calendarYear2021,
        fromYear: 2021,
        fromMonth: 1,
        toYear: 2021,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);

      prismaMock.transaction.findMany.mockResolvedValueOnce([
        {
          id: 'tx-2021-1',
          date: new Date('2021-06-10'),
          description: 'Interest',
          amount: new Decimal('50'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);
      prismaMock.interestCleansing.findMany.mockResolvedValueOnce([]);

      const result2021 = await getYearlyCleansingData(institutionId, calendarYear2021, userId);
      expect(result2021.dateFrom).toBe('2021-01-01');
      expect(result2021.dateTo).toBe('2021-12-31');
      expect(result2021.yearlySummary.totalReceived).toBe(50);

      vi.clearAllMocks();

      // Test 2022
      const calendarYear2022 = 'annual-2022';
      prismaMock.calendarYear.findUniqueOrThrow.mockResolvedValueOnce({
        id: calendarYear2022,
        fromYear: 2022,
        fromMonth: 1,
        toYear: 2022,
        toMonth: 12,
        type: 'ANNUAL',
        userId,
      } as never);

      prismaMock.transaction.findMany.mockResolvedValueOnce([
        {
          id: 'tx-2022-1',
          date: new Date('2022-06-10'),
          description: 'Interest',
          amount: new Decimal('100'),
          type: 'CREDIT',
          category: 'Credit Interest',
          status: 'CONFIRMED',
          userId,
          bankAccountId: institutionId,
        } as never,
      ]);
      prismaMock.interestCleansing.findMany.mockResolvedValueOnce([]);

      const result2022 = await getYearlyCleansingData(institutionId, calendarYear2022, userId);
      expect(result2022.dateFrom).toBe('2022-01-01');
      expect(result2022.dateTo).toBe('2022-12-31');
      expect(result2022.yearlySummary.totalReceived).toBe(100);
    });
  });
});
