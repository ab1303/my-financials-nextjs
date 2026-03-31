'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROUTE_LABELS: Record<string, string> = {
  home: 'Dashboard',
  cashflow: 'Cashflow',
  income: 'Income',
  donations: 'Donations',
  expense: 'Expenses',
  bank: 'Bank Assets',
  'bank-interest': 'Bank Interest',
  stocks: 'Stocks',
  reports: 'Reports',
  'income-summary': 'Income Summary',
  settings: 'Settings',
  profile: 'Profile',
  banks: 'Banks',
  calendar: 'Calendar',
  relation: 'Relations',
  business: 'Business',
  individual: 'Individual',
  zakat: 'Zakat',
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const label = ROUTE_LABELS[segment] ?? segment;
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label='Breadcrumb' className='hidden md:flex items-center gap-1 text-sm'>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className='flex items-center gap-1'>
          {i > 0 && <ChevronRight className='h-3.5 w-3.5 text-muted-foreground/50' />}
          {crumb.isLast ? (
            <span className='text-foreground font-medium'>{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className={cn(
                'text-muted-foreground hover:text-foreground transition-colors',
              )}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
