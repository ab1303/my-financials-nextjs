import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auth } from '@/server/auth';
import { redirect, notFound } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import {
  getUserCategoryBreakdown,
  getExchangeRate,
} from '@/server/services/ai-usage-queries';
import AdminDateRangeFilter from '../_components/AdminDateRangeFilter';
import UserDrillDownTable from './_components/UserDrillDownTable';

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]!;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { userId } = await params;
  return { title: `User AI Spend (${userId.slice(0, 8)}…) | Settings` };
}

async function DrillDownData({
  userId,
  dateFrom,
  dateTo,
  dateFromStr,
  dateToStr,
}: {
  userId: string;
  dateFrom: Date;
  dateTo: Date;
  dateFromStr: string;
  dateToStr: string;
}) {
  let breakdown;
  try {
    breakdown = await getUserCategoryBreakdown(userId, dateFrom, dateTo);
  } catch {
    notFound();
  }

  const rate = await getExchangeRate();

  return (
    <UserDrillDownTable
      userName={breakdown.user.name ?? breakdown.user.email ?? userId}
      categories={breakdown.categories}
      exchangeRate={rate}
      backHref={`/settings/ai-usage?from=${dateFromStr}&to=${dateToStr}`}
    />
  );
}

export default async function AIUsageUserPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();

  if (session?.user?.role !== 'admin') {
    redirect('/home');
  }

  const { userId } = await params;
  const sp = await searchParams;

  const now = new Date();
  const defaultFrom = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = toDateStr(
    new Date(now.getFullYear(), now.getMonth() + 1, 0),
  );

  const dateFromStr = sp.from ?? defaultFrom;
  const dateToStr = sp.to ?? defaultTo;

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
          Per-category breakdown for this user.
        </p>
      </div>

      <AdminDateRangeFilter dateFrom={dateFromStr} dateTo={dateToStr} />

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
        <DrillDownData
          userId={userId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          dateFromStr={dateFromStr}
          dateToStr={dateToStr}
        />
      </Suspense>
    </main>
  );
}
