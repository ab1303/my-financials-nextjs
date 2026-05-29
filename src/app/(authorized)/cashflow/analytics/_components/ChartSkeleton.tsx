import { Skeleton } from '@/components/ui/skeleton';

type ChartSkeletonProps = {
  height?: number;
  className?: string;
};

export function ChartSkeleton({ height = 300, className }: ChartSkeletonProps) {
  return (
    <Skeleton
      className={className}
      style={{ height: `${height}px` }}
    />
  );
}
