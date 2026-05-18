import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAuth,
  mockGetCalendarYearsHandler,
  mockTotalIncomeHandler,
  mockGetUserFiscalYearType,
  mockGetDefaultCalendarYear,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockGetCalendarYearsHandler: vi.fn(),
  mockTotalIncomeHandler: vi.fn(),
  mockGetUserFiscalYearType: vi.fn(),
  mockGetDefaultCalendarYear: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
  auth: mockAuth,
}));

vi.mock('@/server/controllers/calendar-year.controller', () => ({
  getCalendarYearsHandler: mockGetCalendarYearsHandler,
}));

vi.mock('@/server/controllers/income.controller', () => ({
  totalIncomeHandler: mockTotalIncomeHandler,
}));

vi.mock('@/server/services/user-profile/user-profile.service', () => ({
  getUserFiscalYearType: mockGetUserFiscalYearType,
}));

vi.mock('@/server/utils/prisma', () => ({
  prisma: {},
}));

vi.mock('@/utils/calendar-year-defaults', () => ({
  getDefaultCalendarYear: mockGetDefaultCalendarYear,
}));

vi.mock('@/app/(authorized)/cashflow/income/form', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/app/(authorized)/cashflow/income/IncomeTableServer', () => ({
  default: () => <div data-testid='income-table' />,
}));

import IncomePage from '@/app/(authorized)/cashflow/income/page';

describe('IncomePage fiscal year heading', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetUserFiscalYearType.mockResolvedValue('FISCAL');
    mockGetCalendarYearsHandler.mockResolvedValue([
      {
        id: 'year-1',
        fromYear: 2023,
        toYear: 2024,
        description: 'FY 2023-2024',
      },
    ]);
    mockGetDefaultCalendarYear.mockReturnValue({
      id: 'year-1',
      fromYear: 2023,
      toYear: 2024,
      description: 'FY 2023-2024',
    });
    mockTotalIncomeHandler.mockResolvedValue(0);
  });

  it('renders an h2 containing the fiscal year description text', async () => {
    const page = await IncomePage({
      searchParams: Promise.resolve({ fromYear: '2023', toYear: '2024' }),
    });

    const { container } = render(page);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'FY 2023-2024 Income',
    });

    expect(heading.tagName).toBe('H2');
    expect(container.querySelector('.font-mono')).toBeNull();
  });

  it('does not apply the font-mono class to the fiscal year section label', async () => {
    const page = await IncomePage({
      searchParams: Promise.resolve({ fromYear: '2023', toYear: '2024' }),
    });

    const { container } = render(page);
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'FY 2023-2024 Income',
    });

    expect(heading.className).toContain('text-base');
    expect(heading.className).toContain('font-semibold');
    expect(heading.className).toContain('text-foreground');
    expect(heading.className).toContain('mb-3');
    expect(heading.className).not.toContain('font-mono');
    expect(container.querySelector('.font-mono')).toBeNull();
  });
});