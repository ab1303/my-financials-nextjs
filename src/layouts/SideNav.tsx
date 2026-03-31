'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import type { RoleEnumType } from '@prisma/client';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Gift,
  Receipt,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Landmark,
  CandlestickChart,
  Users,
  User,
  Calendar,
  CircleDollarSign,
  X,
  Percent,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import useOutsideAlerter from '@/hooks/useOutsideAlerter';
import { APP_NAME } from '@/constants';

type SideNavProps = {
  userRole: RoleEnumType | null;
  showSideNav: boolean;
  notifyCloseSideNav?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  name: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

const cashflowItems: NavItem[] = [
  { name: 'Income', href: '/cashflow/income', icon: DollarSign },
  { name: 'Donations', href: '/cashflow/donations', icon: Gift },
  { name: 'Expenses', href: '/cashflow/expense', icon: Receipt },
  { name: 'Bank Interest', href: '/cashflow/bank-interest', icon: Percent },
];

const assetItems: NavItem[] = [
  { name: 'Bank(s)', href: '/cashflow/bank', icon: Landmark },
  { name: 'Stock(s)', href: '/cashflow/stocks', icon: CandlestickChart },
];

const relationItems: NavItem[] = [
  { name: 'Business', href: '/relation/business', icon: Building2 },
  { name: 'Individual', href: '/relation/individual', icon: User },
];

const reportItems: NavItem[] = [
  { name: 'Income Summary', href: '/reports/income-summary', icon: BarChart3 },
];

const settingsItems: NavItem[] = [
  { name: 'Profile', href: '/settings/profile', icon: User },
  { name: 'Bank(s)', href: '/settings/banks', icon: Landmark },
  { name: 'Calendar Year(s)', href: '/settings/calendar', icon: Calendar },
];

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
  const isActive = group.items.some((item) => pathname === item.href);
  const [open, setOpen] = useState(isActive || group.defaultOpen || false);
  const GroupIcon = group.icon;

  // Icon-only collapsed mode: show clickable group icon that expands sidebar
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
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    itemActive
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <ItemIcon className='h-3.5 w-3.5' />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

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

  const navGroups: NavGroup[] = [
    {
      name: 'CashFlow',
      icon: Wallet,
      items: cashflowItems,
      defaultOpen:
        pathname.startsWith('/cashflow/income') ||
        pathname.startsWith('/cashflow/donations') ||
        pathname.startsWith('/cashflow/expense') ||
        pathname.startsWith('/cashflow/bank-interest'),
    },
    {
      name: 'Asset(s)',
      icon: Building2,
      items: assetItems,
      defaultOpen:
        pathname.startsWith('/cashflow/bank') ||
        pathname.startsWith('/cashflow/stocks'),
    },
    {
      name: 'Relation(s)',
      icon: Users,
      items: relationItems,
      defaultOpen: pathname.startsWith('/relation'),
    },
    {
      name: 'Reports',
      icon: BarChart3,
      items: reportItems,
      defaultOpen: pathname.startsWith('/reports'),
    },
  ];

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
        {/* Home */}
        {isCollapsed && !isMobile ? (
          <Link
            href='/home'
            title='Home'
            className={cn(
              'flex items-center justify-center rounded-md p-2 transition-colors',
              pathname === '/home'
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <Home className='h-5 w-5' />
          </Link>
        ) : (
          <Link
            href='/home'
            onClick={isMobile ? handleCloseSideNav : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/home'
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <Home className='h-4 w-4' />
            Home
          </Link>
        )}

        {/* Nav Groups */}
        {navGroups.map((group) => (
          <div
            key={group.name}
            className={cn(isCollapsed && !isMobile && 'w-full')}
          >
            <NavGroupItem
              group={group}
              pathname={pathname}
              collapsed={isCollapsed && !isMobile}
              onExpand={onToggleCollapse}
              onClose={isMobile ? handleCloseSideNav : () => {}}
            />
          </div>
        ))}

        {/* Zakat */}
        {isCollapsed && !isMobile ? (
          <Link
            href='/zakat'
            title='Zakat'
            className={cn(
              'flex items-center justify-center rounded-md p-2 transition-colors',
              pathname === '/zakat'
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <CircleDollarSign className='h-5 w-5' />
          </Link>
        ) : (
          <Link
            href='/zakat'
            onClick={isMobile ? handleCloseSideNav : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/zakat'
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <CircleDollarSign className='h-4 w-4' />
            Zakat
          </Link>
        )}

        {/* Settings (admin only) */}
        {userRole === 'admin' && (
          <div className={cn(isCollapsed && !isMobile && 'w-full')}>
            <NavGroupItem
              group={{
                name: 'Settings',
                icon: Settings,
                items: settingsItems,
                defaultOpen: pathname.startsWith('/settings'),
              }}
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

import { cn } from '@/lib/utils';
import useOutsideAlerter from '@/hooks/useOutsideAlerter';
import { APP_NAME } from '@/constants';

type SideNavProps = {
  userRole: RoleEnumType | null;
  showSideNav: boolean;
  notifyCloseSideNav?: () => void;
};

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  name: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

const cashflowItems: NavItem[] = [
  { name: 'Income', href: '/cashflow/income', icon: DollarSign },
  { name: 'Donations', href: '/cashflow/donations', icon: Gift },
  { name: 'Expenses', href: '/cashflow/expense', icon: Receipt },
  { name: 'Bank Interest', href: '/cashflow/bank-interest', icon: Percent },
];

const assetItems: NavItem[] = [
  { name: 'Bank(s)', href: '/cashflow/bank', icon: Landmark },
  { name: 'Stock(s)', href: '/cashflow/stocks', icon: CandlestickChart },
];

const relationItems: NavItem[] = [
  { name: 'Business', href: '/relation/business', icon: Building2 },
  { name: 'Individual', href: '/relation/individual', icon: User },
];

const reportItems: NavItem[] = [
  { name: 'Income Summary', href: '/reports/income-summary', icon: BarChart3 },
];

const settingsItems: NavItem[] = [
  { name: 'Profile', href: '/settings/profile', icon: User },
  { name: 'Bank(s)', href: '/settings/banks', icon: Landmark },
  { name: 'Calendar Year(s)', href: '/settings/calendar', icon: Calendar },
];

function NavGroupItem({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const isActive = group.items.some((item) => pathname === item.href);
  const [open, setOpen] = useState(isActive || group.defaultOpen || false);
  const GroupIcon = group.icon;

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
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    itemActive
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-foreground/70 hover:bg-accent hover:text-foreground',
                  )}
                >
                  <ItemIcon className='h-3.5 w-3.5' />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export default function SideNav({
  userRole,
  showSideNav,
  notifyCloseSideNav,
}: SideNavProps) {
  const [openNav, setOpenNav] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useOutsideAlerter(wrapperRef, handleCloseSideNav);

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

  const navGroups: NavGroup[] = [
    {
      name: 'CashFlow',
      icon: Wallet,
      items: cashflowItems,
      defaultOpen:
        pathname.startsWith('/cashflow/income') ||
        pathname.startsWith('/cashflow/donations') ||
        pathname.startsWith('/cashflow/expense') ||
        pathname.startsWith('/cashflow/bank-interest'),
    },
    {
      name: 'Asset(s)',
      icon: Building2,
      items: assetItems,
      defaultOpen:
        pathname.startsWith('/cashflow/bank') ||
        pathname.startsWith('/cashflow/stocks'),
    },
    {
      name: 'Relation(s)',
      icon: Users,
      items: relationItems,
      defaultOpen: pathname.startsWith('/relation'),
    },
    {
      name: 'Reports',
      icon: BarChart3,
      items: reportItems,
      defaultOpen: pathname.startsWith('/reports'),
    },
  ];

  return (
    <>
      {/* Overlay */}
      {openNav && (
        <div
          className='fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden'
          onClick={handleCloseSideNav}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={wrapperRef}
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out',
          openNav ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Sidebar Header */}
        <div className='flex h-14 items-center justify-between px-4 border-b border-sidebar-border'>
          <span className='font-extrabold font-serif text-lg text-primary'>
            {APP_NAME}
          </span>
          <button
            onClick={handleCloseSideNav}
            className='rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
            aria-label='Close navigation'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        {/* Navigation */}
        <nav className='flex-1 overflow-y-auto p-3 space-y-1'>
          {/* Home */}
          <Link
            href='/home'
            onClick={handleCloseSideNav}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/home'
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <Home className='h-4 w-4' />
            Home
          </Link>

          {/* Nav Groups */}
          {navGroups.map((group) => (
            <div key={group.name} onClick={handleCloseSideNav}>
              <NavGroupItem group={group} pathname={pathname} />
            </div>
          ))}

          {/* Zakat */}
          <Link
            href='/zakat'
            onClick={handleCloseSideNav}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === '/zakat'
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            <CircleDollarSign className='h-4 w-4' />
            Zakat
          </Link>

          {/* Settings (admin only) */}
          {userRole === 'admin' && (
            <div onClick={handleCloseSideNav}>
              <NavGroupItem
                group={{
                  name: 'Settings',
                  icon: Settings,
                  items: settingsItems,
                  defaultOpen: pathname.startsWith('/settings'),
                }}
                pathname={pathname}
              />
            </div>
          )}
        </nav>

        {/* Sidebar Footer - Logout */}
        <div className='border-t border-sidebar-border p-3'>
          <button
            type='button'
            onClick={handleSignOut}
            className='flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors'
          >
            <LogOut className='h-4 w-4' />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
