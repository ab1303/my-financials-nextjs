import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
};

const mockSearchParams = {
  get: vi.fn(() => null),
  entries: vi.fn(() => [][Symbol.iterator]()),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/cashflow/income',
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/components/ui/Label', () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/AppSelect', () => ({
  AppSelect: () => <div data-testid='income-year-select' />,
}));

vi.mock('@/components', () => ({
  Card: {
    Body: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));

import IncomeForm from '@/app/(authorized)/cashflow/income/form';

describe('IncomeForm decimal formatting', () => {
  const baseInitialData = {
    incomeYearData: [
      {
        id: 'year-1',
        description: 'FY 2024',
        fromYear: 2024,
        toYear: 2025,
      },
    ],
    defaultCalendarYearId: 'year-1',
  };

  it('renders Total Earned as $15.80 for value 15.8', () => {
    render(
      <IncomeForm initialData={{ ...baseInitialData, totalIncome: 15.8 }} yearIdParam='year-1'>
        <div>Children</div>
      </IncomeForm>,
    );

    expect(screen.getByText('$15.80')).toBeDefined();
  });

  it('renders Total Earned with thousands separator and 2 decimals', () => {
    render(
      <IncomeForm initialData={{ ...baseInitialData, totalIncome: 149210.26 }} yearIdParam='year-1'>
        <div>Children</div>
      </IncomeForm>,
    );

    expect(screen.getByText('$149,210.26')).toBeDefined();
  });
});
