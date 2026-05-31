import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock } from '@/__tests__/mocks/prisma.mock';
import { mockSession, mockUnauthenticatedSession } from '@/__tests__/mocks/auth.mock';
import type { DashboardSummaryResponse } from '@/server/models/dashboard';

// Mock the auth module before importing GET
vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

// Mock the services
vi.mock('@/server/services/asset-dashboard.service', () => ({
  getNetWorthTrend: vi.fn(),
}));

vi.mock('@/server/services/calendar-year.service', () => ({
  getCalendarYears: vi.fn(),
}));

vi.mock('@/server/services/income.service', () => ({
  getTotalIncome: vi.fn(),
}));

vi.mock('@/server/services/expense.service', () => ({
  getTotalExpenses: vi.fn(),
}));

vi.mock('@/server/services/dashboard.service', () => ({
  getMonthlyIncomeExpenseTrend: vi.fn().mockResolvedValue([]),
  getTopExpenseCategories: vi.fn().mockResolvedValue([]),
}));

// Import after mocking
import { auth } from '@/server/auth';
import { getNetWorthTrend } from '@/server/services/asset-dashboard.service';
import { getCalendarYears } from '@/server/services/calendar-year.service';
import { getTotalIncome } from '@/server/services/income.service';
import { getTotalExpenses } from '@/server/services/expense.service';
import { GET } from '@/app/api/dashboard/summary/route';

describe('Dashboard Summary API (GET /api/dashboard/summary)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test 1: API returns 401 when unauthenticated
   * Verifies that the auth guard rejects requests without a valid session
   */
  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(mockUnauthenticatedSession);

    const request = new Request('http://localhost:3000/api/dashboard/summary');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  /**
   * Test 2: API returns netWorth.latestTotal = 0 when no snapshots
   * Verifies empty state handling when no net worth data exists
   */
  it('should return netWorth.latestTotal = 0 when no snapshots exist', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(getNetWorthTrend).mockResolvedValue({
      dataPoints: [],
      latestCashTotal: 0,
      latestStockTotal: 0,
      latestNetWorth: 0,
      latestCashDate: null,
      latestStockDate: null,
    });
    vi.mocked(getCalendarYears).mockResolvedValue([]);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/dashboard/summary');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardSummaryResponse;
    expect(body.netWorth.latestTotal).toBe(0);
    expect(body.netWorth.sparklinePoints).toEqual([]);
  });

  /**
   * Test 3: API returns sparklinePoints with max 6 entries
   * Verifies that sparkline is correctly sliced to last 6 data points
   */
  it('should return sparklinePoints with max 6 entries', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    // Create mock data points - 10 data points total
    const mockDataPoints = Array.from({ length: 10 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      cashTotal: 1000 + i * 100,
      stockTotal: 2000 + i * 200,
      netWorthTotal: 3000 + i * 300,
      cashSnapshotId: `cash-${i}`,
      stockSnapshotId: `stock-${i}`,
      isStockStale: false,
    }));

    vi.mocked(getNetWorthTrend).mockResolvedValue({
      dataPoints: mockDataPoints,
      latestCashTotal: 1900,
      latestStockTotal: 3800,
      latestNetWorth: 5700,
      latestCashDate: '2024-01-10',
      latestStockDate: '2024-01-10',
    });

    vi.mocked(getCalendarYears).mockResolvedValue([]);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/dashboard/summary');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardSummaryResponse;

    // Verify sparkline has max 6 entries (last 6 of 10)
    expect(body.netWorth.sparklinePoints.length).toBeLessThanOrEqual(6);
    expect(body.netWorth.sparklinePoints.length).toBe(6);

    // Verify sparkline contains the last 6 data points
    const expectedDates = ['2024-01-05', '2024-01-06', '2024-01-07', '2024-01-08', '2024-01-09', '2024-01-10'];
    expect(body.netWorth.sparklinePoints.map((p) => p.date)).toEqual(expectedDates);
  });

  /**
   * Test 4: API returns cashflowYTD = null when no calendar year exists
   * Verifies null guard when user has no fiscal year configured
   */
  it('should return cashflowYTD = null when no calendar year exists', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);
    vi.mocked(getNetWorthTrend).mockResolvedValue({
      dataPoints: [],
      latestCashTotal: 1000,
      latestStockTotal: 2000,
      latestNetWorth: 3000,
      latestCashDate: '2024-01-15',
      latestStockDate: '2024-01-15',
    });
    vi.mocked(getCalendarYears).mockResolvedValue([]);
    prismaMock.transaction.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/dashboard/summary');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardSummaryResponse;
    expect(body.cashflowYTD).toBeNull();
  });

  /**
   * Test 5: API returns recentTransactions filtered to CONFIRMED status
   * Verifies that transactions are properly filtered and exclude Transfer category
   */
  it('should return recentTransactions filtered to CONFIRMED status and exclude Transfer', async () => {
    vi.mocked(auth).mockResolvedValue(mockSession);

    vi.mocked(getNetWorthTrend).mockResolvedValue({
      dataPoints: [],
      latestCashTotal: 1000,
      latestStockTotal: 2000,
      latestNetWorth: 3000,
      latestCashDate: '2024-01-15',
      latestStockDate: '2024-01-15',
    });

    vi.mocked(getCalendarYears).mockResolvedValue([]);

    // Mock transactions - only CONFIRMED status, exclude Transfer
    const mockTransactions = [
      {
        id: 'txn-1',
        date: new Date('2024-01-15'),
        description: 'Grocery store',
        amount: 50,
        type: 'DEBIT' as const,
        category: 'Groceries',
        userId: 'test-user-id',
        status: 'CONFIRMED' as const,
        financialAccount: { name: 'Checking Account' },
        bankAccountId: 'bank-1',
        source: 'USER_MANUAL' as const,
        checkNumber: null,
        referenceNumber: null,
        notes: null,
      },
      {
        id: 'txn-2',
        date: new Date('2024-01-14'),
        description: 'Salary',
        amount: 5000,
        type: 'CREDIT' as const,
        category: 'Employment',
        userId: 'test-user-id',
        status: 'CONFIRMED' as const,
        financialAccount: { name: 'Checking Account' },
        bankAccountId: 'bank-1',
        source: 'USER_MANUAL' as const,
        checkNumber: null,
        referenceNumber: null,
        notes: null,
      },
    ];

    prismaMock.transaction.findMany.mockResolvedValue(mockTransactions as any);

    const request = new Request('http://localhost:3000/api/dashboard/summary');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as DashboardSummaryResponse;

    // Verify transactions are present
    expect(body.recentTransactions.length).toBe(2);

    // Verify transaction filters were applied
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'test-user-id',
          status: 'CONFIRMED',
          category: { not: 'Transfer' },
        }),
        orderBy: { date: 'desc' },
        take: 5,
      }),
    );

    // Verify response structure
    expect(body.recentTransactions[0]?.id).toBe('txn-1');
    expect(body.recentTransactions[0]?.category).toBe('Groceries');
    expect(body.recentTransactions[0]?.type).toBe('DEBIT');
  });
});

