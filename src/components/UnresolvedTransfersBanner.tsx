import Link from 'next/link';
import { HiExclamationTriangle } from 'react-icons/hi2';

interface UnresolvedTransfersBannerProps {
  count: number;
  href: string;
}

export function UnresolvedTransfersBanner({ count, href }: UnresolvedTransfersBannerProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 mb-4 dark:border-yellow-800 dark:bg-yellow-950">
      <HiExclamationTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
      <p className="text-sm text-yellow-800 dark:text-yellow-200">
        <span className="font-medium">
          {count} unresolved transfer{count > 1 ? 's' : ''}
        </span>{' '}
        may be inflating your figures.{' '}
        <Link href={href} className="underline font-medium hover:text-yellow-900 dark:hover:text-yellow-100">
          Review now →
        </Link>
      </p>
    </div>
  );
}
