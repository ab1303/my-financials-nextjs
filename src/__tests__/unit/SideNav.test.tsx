import type { RoleEnumType } from '@prisma/client';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SideNav from '@/layouts/SideNav';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/home'));

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

vi.mock('@radix-ui/react-collapsible', () => ({
  Root: ({ children, open }: { children: ReactNode; open?: boolean }) => (
    <div data-open={open}>{children}</div>
  ),
  Trigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('SideNav cashflow navigation', () => {
  const defaultProps = {
    userRole: 'admin' as RoleEnumType,
    showSideNav: true,
    collapsed: false,
    onToggleCollapse: vi.fn(),
  };

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/home');
    vi.clearAllMocks();
  });

  it('renders the Transactions group and its Ledger child link', () => {
    render(<SideNav {...defaultProps} />);

    expect(
      screen.getAllByRole('button', { name: 'Transactions' }),
    ).toHaveLength(2);
    const ledgerLinks = screen.getAllByRole('link', { name: 'Ledger' });
    expect(ledgerLinks).toHaveLength(2);
    ledgerLinks.forEach((link) =>
      expect(link).toHaveAttribute('href', '/cashflow/transactions'),
    );
    screen.getAllByRole('link', { name: 'Analytics' }).forEach((link) =>
      expect(link).toHaveAttribute('href', '/cashflow/analytics'),
    );
    screen.getAllByRole('link', { name: 'Transfer Rules' }).forEach((link) =>
      expect(link).toHaveAttribute('href', '/cashflow/transfer-rules'),
    );
    screen.getAllByRole('link', { name: 'Category Rules' }).forEach((link) =>
      expect(link).toHaveAttribute('href', '/cashflow/category-rules'),
    );
  });

  it('keeps Zakat inside the CashFlow navigation tree', () => {
    render(<SideNav {...defaultProps} />);

    const zakatLinks = screen.getAllByRole('link', { name: 'Zakat' });
    expect(zakatLinks).toHaveLength(2);
    zakatLinks.forEach((link) => expect(link).toHaveAttribute('href', '/zakat'));
  });

  it('opens CashFlow by default when on a cashflow route', () => {
    mockUsePathname.mockReturnValue('/cashflow/transactions');

    render(<SideNav {...defaultProps} />);

    expect(document.querySelectorAll('[data-open="true"]').length).toBeGreaterThan(
      0,
    );
  });
});
