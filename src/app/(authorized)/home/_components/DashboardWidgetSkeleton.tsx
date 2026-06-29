import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * DashboardWidgetSkeleton - Skeleton/Fallback Component
 * Shared Suspense fallback for dashboard widgets
 * Renders an animated pulse skeleton matching the card structure
 * Used with Suspense boundaries while widgets fetch their data
 */
export function DashboardWidgetSkeleton() {
  return (
    <Card className='dark:border-slate-700'>
      <CardHeader className='pb-2'>
        <div className='h-4 w-32 rounded bg-muted animate-pulse dark:bg-slate-700' />
      </CardHeader>
      <CardContent className='space-y-2'>
        <div className='h-6 w-24 rounded bg-muted animate-pulse dark:bg-slate-700' />
        <div className='h-3 w-20 rounded bg-muted animate-pulse dark:bg-slate-700' />
        <div className='h-3 w-28 rounded bg-muted animate-pulse dark:bg-slate-700' />
      </CardContent>
    </Card>
  );
}
