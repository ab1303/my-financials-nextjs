'use client';

import type { User } from 'next-auth';
import * as React from 'react';
import { useState } from 'react';

import SideNav from '../layouts/SideNav';
import { APP_NAME } from '@/constants';
import { ThemeToggle } from './ui/theme-toggle';

type HeaderProps = {
  user: User;
};

export default function Header({ user }: HeaderProps) {
  const [showSideNav, setShowSideNav] = useState(false);

  return (
    <div>
      <header className='sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='flex justify-between h-14 px-4'>
          <button className='p-2' onClick={() => setShowSideNav(true)} aria-label='Open navigation'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 512 512'
              className='w-6 h-6 text-foreground'
            >
              <rect width='352' height='32' x='80' y='96'></rect>
              <rect width='352' height='32' x='80' y='240'></rect>
              <rect width='352' height='32' x='80' y='384'></rect>
            </svg>
          </button>
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
      />
    </div>
  );
}

