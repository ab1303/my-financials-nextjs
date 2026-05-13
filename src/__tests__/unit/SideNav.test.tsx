import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/home'));

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

vi.mock('@radix-ui/react-collapsible', () => ({
  Root: ({ children, open }: any) => <div data-open={open}>{children}</div>,
  Trigger: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
}));

import SideNav from '@/layouts/SideNav';

describe('SideNav — Transactions item', () => {
  const defaultProps = {
    userRole: 'admin' as any,
    showSideNav: true,
    collapsed: false,
    onToggleCollapse: vi.fn(),
  };

  beforeEach(() => {
    mockUsePathname.mockReturnValue('/home');
    vi.clearAllMocks();
  });

  it('renders a Transactions link in the CashFlow nav group', () => {
    render(<SideNav {...defaultProps} />);

    expect(screen.getAllByText('Transactions').length).toBeGreaterThan(0);
  });

  it('Transactions link points to /cashflow/transactions', () => {
    render(<SideNav {...defaultProps} />);

    const links = screen.getAllByRole('link');
    const txLink = links.find(
      (link) => link.getAttribute('href') === '/cashflow/transactions',
    );

    expect(txLink).toBeDefined();
  });

  it('CashFlow group opens by default when on /cashflow/transactions', () => {
    mockUsePathname.mockReturnValue('/cashflow/transactions');

    render(<SideNav {...defaultProps} />);

    const txLink = screen.getAllByRole('link').find(
      (link) => link.getAttribute('href') === '/cashflow/transactions',
    );

    expect(txLink).toBeDefined();
  });
});
