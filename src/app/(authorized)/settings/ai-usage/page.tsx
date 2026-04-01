import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import AdminDateRangeFilter from './_components/AdminDateRangeFilter';
import AdminUsageData from './_components/AdminUsageData';

export const metadata: Metadata = {
  title: 'AI Spend Overview | Settings',
};

type PageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]!;
}

export default async function AIUsageAdminPage({ searchParams }: PageProps) {
  const session = await auth();

  // Server-side role guard — redirect non-admins instantly
  if (session?.user?.role !== 'admin') {
    redirect('/home');
  }

  const params = await searchParams;

  const now = new Date();
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = toDateStr(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );

  const dateFromStr = params.from ?? defaultFrom;
  const dateToStr = params.to ?? defaultTo;

  const dateFrom = new Date(`${dateFromStr}T00:00:00`);
  const dateTo = new Date(`${dateToStr}T23:59:59`);

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-8 space-y-6'>
      <div>
        <div className='flex items-center gap-2 mb-1'>
          <Sparkles className='h-5 w-5 text-primary' aria-hidden='true' />
          <h1 className='text-2xl font-bold tracking-tight text-foreground'>
            AI Spend
          </h1>
        </div>
        <p className='text-sm text-muted-foreground'>
          Aggregated AI import costs across all users.
        </p>
      </div>

      {/* Date filter — client component for useTransition */}
      <AdminDateRangeFilter dateFrom={dateFromStr} dateTo={dateToStr} />

      {/* Data table — async RSC wrapped in Suspense for streaming */}
      <Suspense
        fallback={
          <div className='space-y-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className='h-12 w-full rounded-md bg-muted animate-pulse'
              />
            ))}
          </div>
        }
      >
        <AdminUsageData
          dateFrom={dateFrom}
          dateTo={dateTo}
          dateFromStr={dateFromStr}
          dateToStr={dateToStr}
        />
      </Suspense>
    </main>
  );
}
