'use client';

import type { User } from 'next-auth';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Header from './Header';

type AppShellProps = {
  user: User;
  children: React.ReactNode;
};

export default function AppShell({ user, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  return (
    <div className='min-h-screen bg-background'>
      <Header
        user={user}
        sidebarCollapsed={collapsed}
        onToggleSidebar={toggleCollapsed}
      />
      <main
        className={cn(
          'flex flex-col transition-[margin] duration-300 ease-in-out',
          collapsed ? 'lg:ml-16' : 'lg:ml-64',
        )}
      >
        {children}
      </main>
    </div>
  );
}
