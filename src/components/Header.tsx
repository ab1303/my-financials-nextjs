'use client';

import type { User } from 'next-auth';
import * as React from 'react';
import { useState } from 'react';

import SideNav from '../layouts/SideNav';
import { APP_NAME } from '@/constants';
import { ThemeToggle } from './ui/theme-toggle';
import Breadcrumb from './Breadcrumb';
import { Menu } from 'lucide-react';

type HeaderProps = {
  user: User;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export default function Header({
  user,
  sidebarCollapsed,
  onToggleSidebar,
}: HeaderProps) {
  const [showSideNav, setShowSideNav] = useState(false);

  return (
    <div>
      <header className='sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex justify-between h-14 px-4'>
          {/* Mobile hamburger — only shown on mobile */}
          <button
            className='p-2 lg:hidden'
            onClick={() => setShowSideNav(true)}
            aria-label='Open navigation'
          >
            <Menu className='w-6 h-6 text-foreground' />
          </button>
          {/* Desktop: breadcrumb in left area */}
          <div className='hidden lg:flex items-center'>
            <Breadcrumb />
          </div>
          <span className='flex-grow flex items-center justify-center font-extrabold font-serif text-xl text-primary'>
            {APP_NAME}
          </span>
          <div className='flex items-center gap-3'>
            <ThemeToggle />
            <span className='text-muted-foreground text-sm'>
              Hi,
              <span className='font-semibold mx-1 text-foreground'>
                {user.name}
              </span>
            </span>
          </div>
        </div>
      </header>

      <SideNav
        userRole={user.role}
        showSideNav={showSideNav}
        notifyCloseSideNav={() => setShowSideNav(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
    </div>
  );
}
