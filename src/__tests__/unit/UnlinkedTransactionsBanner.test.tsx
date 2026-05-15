import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { authMock, countUnlinkedDonationTransactionsMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  countUnlinkedDonationTransactionsMock: vi.fn(),
}));

vi.mock('@/server/auth', () => ({
  auth: authMock,
}));

vi.mock('@/server/services/transactions/donation-link.service', () => ({
  countUnlinkedDonationTransactions: countUnlinkedDonationTransactionsMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

import UnlinkedTransactionsBanner from '@/app/(authorized)/cashflow/donations/_components/UnlinkedTransactionsBanner';

describe('UnlinkedTransactionsBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('renders with the correct count message when count > 0', async () => {
    countUnlinkedDonationTransactionsMock.mockResolvedValue(2);

    const element = await UnlinkedTransactionsBanner({
      fromYear: 2024,
      toYear: 2025,
      dateFrom: '2024-07-01',
      dateTo: '2025-06-30',
      calendarYearId: 'cal-1',
    });

    render(element);

    expect(
      screen.getByText((_, node) =>
        node?.textContent ===
        '🔗 2 "Gifts & donations" transactions from your bank import need recipient details.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /link transactions/i })).toBeDefined();
  });

  it('returns null when count === 0', async () => {
    countUnlinkedDonationTransactionsMock.mockResolvedValue(0);

    const element = await UnlinkedTransactionsBanner({
      fromYear: 2024,
      toYear: 2025,
      dateFrom: '2024-07-01',
      dateTo: '2025-06-30',
      calendarYearId: 'cal-1',
    });

    expect(element).toBeNull();
  });

  it('shows singular message when only one transaction is unlinked', async () => {
    countUnlinkedDonationTransactionsMock.mockResolvedValue(1);

    const element = await UnlinkedTransactionsBanner({
      fromYear: 2024,
      toYear: 2025,
      dateFrom: '2024-07-01',
      dateTo: '2025-06-30',
      calendarYearId: 'cal-1',
    });

    render(element);

    expect(
      screen.getByText((_, node) =>
        node?.textContent ===
        '🔗 1 "Gifts & donations" transaction from your bank import need recipient details.',
      ),
    ).toBeDefined();
  });
});
