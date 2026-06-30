import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/cashflow/analytics/route';
import { auth } from '@/server/auth';
import * as expenseService from '@/server/services/expense.service';
import * as incomeService from '@/server/services/income.service';

// Mock dependencies
vi.mock('@/server/auth');
vi.mock('@/server/services/income.service');
vi.mock('@/server/services/expense.service');
vi.mock('@/server/db/client', () => ({
  prisma: {
    calendarYear: {
      findUnique: vi.fn(),
    },
  },
}));

describe('GET /api/cashflow/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000/api/cashflow/analytics?calendarYearId=year-1',
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 400 when calendarYearId is missing', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never);

    const request = new Request('http://localhost:3000/api/cashflow/analytics');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Missing calendarYearId');
  });

  it('should accept incomeGroupIds query parameter', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never);

    const { prisma } = await import('@/server/db/client');
    vi.mocked(prisma.calendarYear.findUnique).mockResolvedValueOnce({
      fromYear: 2024,
      fromMonth: 7,
      toYear: 2025,
      toMonth: 6,
    } as never);

    vi.mocked(incomeService.getTotalIncome).mockResolvedValueOnce(50000);
    vi.mocked(
      incomeService.getMonthlyIncomeSummaryFiltered,
    ).mockResolvedValueOnce([]);
    vi.mocked(
      incomeService.getIncomeSourceBreakdownForYear,
    ).mockResolvedValueOnce([]);
    vi.mocked(expenseService.getTotalExpenses).mockResolvedValueOnce(30000);
    vi.mocked(expenseService.getMonthlyExpenseSummaries).mockResolvedValueOnce(
      [],
    );
    vi.mocked(
      expenseService.getExpenseCategoryBreakdownForYear,
    ).mockResolvedValueOnce([]);

    const request = new Request(
      'http://localhost:3000/api/cashflow/analytics?calendarYearId=year-1&incomeGroupIds=group-1,group-2',
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kpis).toBeDefined();
  });

  it('should accept expenseGroupIds query parameter', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { id: 'user-1' } } as never);

    const { prisma } = await import('@/server/db/client');
    vi.mocked(prisma.calendarYear.findUnique).mockResolvedValueOnce({
      fromYear: 2024,
      fromMonth: 7,
      toYear: 2025,
      toMonth: 6,
    } as never);

    vi.mocked(incomeService.getTotalIncome).mockResolvedValueOnce(50000);
    vi.mocked(
      incomeService.getMonthlyIncomeSummaryFiltered,
    ).mockResolvedValueOnce([]);
    vi.mocked(
      incomeService.getIncomeSourceBreakdownForYear,
    ).mockResolvedValueOnce([]);
    vi.mocked(expenseService.getTotalExpenses).mockResolvedValueOnce(30000);
    vi.mocked(expenseService.getMonthlyExpenseSummaries).mockResolvedValueOnce(
      [],
    );
    vi.mocked(
      expenseService.getExpenseCategoryBreakdownForYear,
    ).mockResolvedValueOnce([]);

    const request = new Request(
      'http://localhost:3000/api/cashflow/analytics?calendarYearId=year-1&expenseGroupIds=group-1',
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kpis).toBeDefined();
  });
});
