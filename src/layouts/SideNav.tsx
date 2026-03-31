'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import type { RoleEnumType } from '@prisma/client';
import { signOut } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  TrendingUp,
  Gift,
  Receipt,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
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
} from 'lucide-react';
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
