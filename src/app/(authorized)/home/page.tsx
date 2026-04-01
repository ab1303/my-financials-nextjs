import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  CircleDollarSign,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { auth } from '@/server/auth';
import {
  AIUsageDashboardCard,
  AIUsageDashboardCardSkeleton,
} from './_components/AIUsageDashboardCard';

export const metadata: Metadata = {
  title: 'Dashboard — My Financials',
  description: 'Financial overview dashboard',
  icons: { icon: '/favicon.ico' },
};

export default async function HomePage() {
  // Auth is lightweight — check once, cheap condition before expensive fetches
  const session = await auth();
  const userId = session?.user?.id;

  // Current calendar month for dashboard AI usage scope
  const now = new Date();
  const dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return (
    <main className='px-4 sm:px-6 lg:px-8 py-8'>
      <div className='mb-8'>
        <h1 className='text-2xl font-bold tracking-tight text-foreground'>
          Dashboard
        </h1>
        <p className='text-muted-foreground mt-1'>
          Your financial overview at a glance
        </p>
      </div>

      {/* Quick Action Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        <Card className='hover:shadow-md transition-shadow'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <div className='p-2 rounded-lg bg-primary/10'>
                <TrendingUp className='h-4 w-4 text-primary' />
              </div>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Income
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href='/cashflow/income'>
              <Button variant='outline' size='sm' className='w-full'>
                View Income
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className='hover:shadow-md transition-shadow'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <div className='p-2 rounded-lg bg-destructive/10'>
                <Receipt className='h-4 w-4 text-destructive' />
              </div>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Expenses
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href='/cashflow/expense'>
              <Button variant='outline' size='sm' className='w-full'>
                View Expenses
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className='hover:shadow-md transition-shadow'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <div className='p-2 rounded-lg bg-green-100 dark:bg-green-900/20'>
                <DollarSign className='h-4 w-4 text-green-600 dark:text-green-400' />
              </div>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Assets
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href='/cashflow/bank'>
              <Button variant='outline' size='sm' className='w-full'>
                View Assets
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className='hover:shadow-md transition-shadow'>
          <CardHeader className='pb-2'>
            <div className='flex items-center gap-2'>
              <div className='p-2 rounded-lg bg-amber-100 dark:bg-amber-900/20'>
                <CircleDollarSign className='h-4 w-4 text-amber-600 dark:text-amber-400' />
              </div>
              <CardTitle className='text-sm font-medium text-muted-foreground'>
                Zakat
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Link href='/zakat'>
              <Button variant='outline' size='sm' className='w-full'>
                View Zakat
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Reports Section */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Track your latest financial transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              <Link href='/cashflow/income'>
                <Button
                  variant='ghost'
                  className='w-full justify-start gap-3 text-muted-foreground hover:text-foreground'
                >
                  <TrendingUp className='h-4 w-4 text-primary' />
                  View Income Transactions
                </Button>
              </Link>
              <Link href='/cashflow/donations'>
                <Button
                  variant='ghost'
                  className='w-full justify-start gap-3 text-muted-foreground hover:text-foreground'
                >
                  <DollarSign className='h-4 w-4 text-primary' />
                  View Donations
                </Button>
              </Link>
              <Link href='/cashflow/expense'>
                <Button
                  variant='ghost'
                  className='w-full justify-start gap-3 text-muted-foreground hover:text-foreground'
                >
                  <Receipt className='h-4 w-4 text-destructive' />
                  View Expenses
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
            <CardDescription>
              Jump to key sections of your finances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              <Link href='/reports/income-summary'>
                <Button
                  variant='ghost'
                  className='w-full justify-start gap-3 text-muted-foreground hover:text-foreground'
                >
                  <TrendingUp className='h-4 w-4' />
                  Income Summary Report
                </Button>
              </Link>
              <Link href='/cashflow/bank'>
                <Button
                  variant='ghost'
                  className='w-full justify-start gap-3 text-muted-foreground hover:text-foreground'
                >
                  <DollarSign className='h-4 w-4' />
                  Bank Assets
                </Button>
              </Link>
              <Link href='/cashflow/stocks'>
                <Button
                  variant='ghost'
                  className='w-full justify-start gap-3 text-muted-foreground hover:text-foreground'
                >
                  <TrendingUp className='h-4 w-4' />
                  Stock Portfolio
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Usage This Month — each card is an independent async RSC behind Suspense */}
      {userId ? (
        <section className='mt-8' aria-labelledby='ai-usage-heading'>
          <div className='mb-4 flex items-center gap-2'>
            <Sparkles className='h-5 w-5 text-primary' aria-hidden='true' />
            <h2
              id='ai-usage-heading'
              className='text-lg font-semibold tracking-tight text-foreground'
            >
              AI Import Cost —{' '}
              {now.toLocaleString('en-AU', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <Suspense fallback={<AIUsageDashboardCardSkeleton />}>
              <AIUsageDashboardCard
                userId={userId}
                importType='EXPENSE'
                dateFrom={dateFrom}
                dateTo={dateTo}
              />
            </Suspense>
            <Suspense fallback={<AIUsageDashboardCardSkeleton />}>
              <AIUsageDashboardCard
                userId={userId}
                importType='BANK_ASSET'
                dateFrom={dateFrom}
                dateTo={dateTo}
              />
            </Suspense>
            <Suspense fallback={<AIUsageDashboardCardSkeleton />}>
              <AIUsageDashboardCard
                userId={userId}
                importType='STOCK'
                dateFrom={dateFrom}
                dateTo={dateTo}
              />
            </Suspense>
          </div>
        </section>
      ) : null}
    </main>
  );
}
