'use client';

import type { RoleEnumType } from '@prisma/client';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  ArrowLeftRight,
  BarChart2,
  BarChart3,
  Book,
  Building2,
  Calendar,
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  DollarSign,
  Gift,
  GitMerge,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Receipt,
  Settings,
  Sparkles,
  Tag,
  User,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';

import { APP_NAME } from '@/constants';
import useOutsideAlerter from '@/hooks/useOutsideAlerter';
import { cn } from '@/lib/utils';

type SideNavProps = {
  userRole: RoleEnumType | null;
  showSideNav: boolean;
  notifyCloseSideNav?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

type NavItem = {
  kind: 'link';
  name: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  kind: 'group';
  name: string;
  icon: React.ElementType;
  items: NavNode[];
  defaultOpen?: boolean;
};

type NavNode = NavItem | NavGroup;

function isNavGroup(node: NavNode): node is NavGroup {
  return node.kind === 'group';
}

function navNodeMatchesPath(node: NavNode, pathname: string): boolean {
  if (isNavGroup(node)) {
    return node.items.some((child) => navNodeMatchesPath(child, pathname));
  }

  return pathname === node.href || pathname.startsWith(`${node.href}/`);
}

function NavLinkItem({
  item,
  pathname,
  collapsed,
  onClose,
  className,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onClose: () => void;
  className?: string;
}) {
  const ItemIcon = item.icon;
  const isActive = pathname === item.href;

  if (collapsed) {
    return (
      <Link
        href={item.href}
        title={item.name}
        onClick={onClose}
        className={cn(
          'flex items-center justify-center rounded-md p-2 transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          className,
        )}
      >
        <ItemIcon className='h-5 w-5' />
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-foreground/70 hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      <ItemIcon className='h-4 w-4' />
      {item.name}
    </Link>
  );
}

function NavGroupItem({
  group,
  pathname,
  collapsed,
  onExpand,
  onClose,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  onExpand: () => void;
  onClose: () => void;
}) {
  const isActive = navNodeMatchesPath(group, pathname);
  const [open, setOpen] = useState(isActive || group.defaultOpen || false);
  const GroupIcon = group.icon;

  if (collapsed) {
    return (
      <button
        type='button'
        title={group.name}
        onClick={onExpand}
        className={cn(
          'flex w-full items-center justify-center rounded-md p-2 transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        )}
      >
        <GroupIcon className='h-5 w-5' />
      </button>
    );
  }

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-foreground/70 hover:bg-accent hover:text-foreground',
          )}
        >
          <span className='flex items-center gap-3'>
            <GroupIcon className='h-4 w-4' />
            {group.name}
          </span>
          {open ? (
            <ChevronDown className='h-3.5 w-3.5 text-muted-foreground' />
          ) : (
            <ChevronRight className='h-3.5 w-3.5 text-muted-foreground' />
          )}
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <ul className='mt-1 ml-4 space-y-1 border-l border-border pl-3'>
          {group.items.map((item) => (
            <li key={item.name}>
              {isNavGroup(item) ? (
                <NavGroupItem
                  group={item}
                  pathname={pathname}
                  collapsed={false}
                  onExpand={onExpand}
                  onClose={onClose}
                />
              ) : (
                <NavLinkItem
                  item={item}
                  pathname={pathname}
                  collapsed={false}
                  onClose={onClose}
                />
              )}
            </li>
          ))}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

const transactionItems: NavNode[] = [
  {
    kind: 'link',
    name: 'Analytics',
    href: '/cashflow/analytics',
    icon: BarChart2,
  },
  {
    kind: 'link',
    name: 'Ledger',
    href: '/cashflow/transactions',
    icon: Book,
  },
  {
    kind: 'link',
    name: 'Transfer Rules',
    href: '/cashflow/transfer-rules',
    icon: GitMerge,
  },
  {
    kind: 'link',
    name: 'Category Rules',
    href: '/cashflow/category-rules',
    icon: Tag,
  },
  {
    kind: 'link',
    name: 'Category Groups',
    href: '/cashflow/category-groups',
    icon: Tag,
  },
];

const cashflowItems = (): NavNode[] => [
  { kind: 'link', name: 'Income', href: '/cashflow/income', icon: DollarSign },
  { kind: 'link', name: 'Donations', href: '/cashflow/donations', icon: Gift },
  { kind: 'link', name: 'Expenses', href: '/cashflow/expense', icon: Receipt },
  {
    kind: 'link',
    name: 'Bank Interest',
    href: '/cashflow/bank-interest',
    icon: Percent,
  },
  { kind: 'link', name: 'Zakat', href: '/zakat', icon: CircleDollarSign },
];

const transactionsGroup = (pathname: string): NavGroup => ({
  kind: 'group',
  name: 'Transactions',
  icon: ArrowLeftRight,
  items: transactionItems,
  defaultOpen: transactionItems.some((item) =>
    navNodeMatchesPath(item, pathname),
  ),
});

const assetItems: Array<Omit<NavItem, 'kind'>> = [
  { name: 'Overview', href: '/assets', icon: LayoutDashboard },
  { name: 'Bank(s)', href: '/assets/bank', icon: Landmark },
  { name: 'Stock(s)', href: '/assets/stocks', icon: CandlestickChart },
];

const relationItems: Array<Omit<NavItem, 'kind'>> = [
  { name: 'Business', href: '/relation/business', icon: Building2 },
  { name: 'Individual', href: '/relation/individual', icon: User },
];

const reportItems: Array<Omit<NavItem, 'kind'>> = [
  { name: 'Income Summary', href: '/reports/income-summary', icon: BarChart3 },
];

const settingsItems: Array<Omit<NavItem, 'kind'>> = [
  { name: 'Calendar Year(s)', href: '/settings/calendar', icon: Calendar },
  { name: 'AI Spend', href: '/settings/ai-usage', icon: Sparkles },
  { name: 'Categories', href: '/settings/categories', icon: Tag },
  { name: 'Bank Institutions', href: '/settings/banks', icon: Landmark },
  {
    name: 'Brokerage Institutions',
    href: '/settings/brokerages',
    icon: CandlestickChart,
  },
];

const accountItems: Array<Omit<NavItem, 'kind'>> = [
  { name: 'Profile', href: '/account/profile', icon: User },
  { name: 'Bank Accounts', href: '/account/bank-accounts', icon: Landmark },
];

export default function SideNav({
  userRole,
  showSideNav,
  notifyCloseSideNav,
  collapsed,
  onToggleCollapse,
}: SideNavProps) {
  const [openNav, setOpenNav] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useOutsideAlerter(wrapperRef, handleCloseSideNav);

  const navNodes: NavNode[] = [
    { kind: 'link', name: 'Home', href: '/home', icon: Home },
    {
      kind: 'group',
      name: 'CashFlow',
      icon: Wallet,
      items: cashflowItems(),
      defaultOpen: pathname.startsWith('/cashflow') || pathname === '/zakat',
    },
    transactionsGroup(pathname),
    {
      kind: 'group',
      name: 'Asset(s)',
      icon: Building2,
      items: assetItems.map((item) => ({ kind: 'link', ...item })),
      defaultOpen:
        pathname.startsWith('/assets/bank') ||
        pathname.startsWith('/assets/stocks'),
    },
    {
      kind: 'group',
      name: 'Relation(s)',
      icon: Users,
      items: relationItems.map((item) => ({ kind: 'link', ...item })),
      defaultOpen: pathname.startsWith('/relation'),
    },
    {
      kind: 'group',
      name: 'Reports',
      icon: BarChart3,
      items: reportItems.map((item) => ({ kind: 'link', ...item })),
      defaultOpen: pathname.startsWith('/reports'),
    },
    {
      kind: 'group',
      name: 'Account',
      icon: User,
      items: accountItems.map((item) => ({ kind: 'link', ...item })),
      defaultOpen: pathname.startsWith('/account'),
    },
  ];

  const adminNavNode: NavGroup = {
    kind: 'group',
    name: 'Settings',
    icon: Settings,
    items: settingsItems.map((item) => ({ kind: 'link', ...item })),
    defaultOpen: pathname.startsWith('/settings'),
  };

  useEffect(() => {
    setOpenNav(showSideNav);
  }, [showSideNav]);

  function handleCloseSideNav() {
    setOpenNav(false);
    if (notifyCloseSideNav) notifyCloseSideNav();
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: '/' });
  }

  const sidebarContent = (isCollapsed: boolean, isMobile: boolean) => (
    <>
      {/* Sidebar Header */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-sidebar-border',
          isCollapsed && !isMobile
            ? 'justify-center px-2'
            : 'justify-between px-4',
        )}
      >
        {(!isCollapsed || isMobile) && (
          <span className='font-extrabold font-serif text-lg text-primary truncate'>
            {APP_NAME}
          </span>
        )}
        {isMobile ? (
          <button
            onClick={handleCloseSideNav}
            className='rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
            aria-label='Close navigation'
          >
            <X className='h-4 w-4' />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            className='rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className='h-4 w-4' />
            ) : (
              <PanelLeftClose className='h-4 w-4' />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'flex-1 overflow-y-auto p-2 space-y-1',
          isCollapsed && !isMobile && 'flex flex-col items-center',
        )}
      >
        {navNodes.map((node) => (
          <div
            key={`${node.kind}-${node.name}${'href' in node ? node.href : ''}`}
            className={cn(isCollapsed && !isMobile && 'w-full')}
          >
            {isNavGroup(node) ? (
              <NavGroupItem
                group={node}
                pathname={pathname}
                collapsed={isCollapsed && !isMobile}
                onExpand={onToggleCollapse}
                onClose={isMobile ? handleCloseSideNav : () => {}}
              />
            ) : (
              <NavLinkItem
                item={node}
                pathname={pathname}
                collapsed={isCollapsed && !isMobile}
                onClose={isMobile ? handleCloseSideNav : () => {}}
              />
            )}
          </div>
        ))}

        {/* Settings (admin only) */}
        {userRole === 'admin' && (
          <div className={cn(isCollapsed && !isMobile && 'w-full')}>
            <NavGroupItem
              group={adminNavNode}
              pathname={pathname}
              collapsed={isCollapsed && !isMobile}
              onExpand={onToggleCollapse}
              onClose={isMobile ? handleCloseSideNav : () => {}}
            />
          </div>
        )}
      </nav>

      {/* Sidebar Footer - Logout */}
      <div className='border-t border-sidebar-border p-2'>
        {isCollapsed && !isMobile ? (
          <button
            type='button'
            title='Logout'
            onClick={handleSignOut}
            className='flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
          >
            <LogOut className='h-5 w-5' />
          </button>
        ) : (
          <button
            type='button'
            onClick={handleSignOut}
            className='flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
          >
            <LogOut className='h-4 w-4' />
            Logout
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {openNav && (
        <div
          className='fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden'
          onClick={handleCloseSideNav}
        />
      )}

      {/* Mobile Drawer (< lg) */}
      <aside
        ref={wrapperRef}
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:hidden',
          openNav ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent(false, true)}
      </aside>

      {/* Desktop Persistent Sidebar (lg+) */}
      <aside
        className={cn(
          'hidden lg:flex fixed top-0 left-0 z-30 h-full flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {sidebarContent(collapsed, false)}
      </aside>
    </>
  );
}
