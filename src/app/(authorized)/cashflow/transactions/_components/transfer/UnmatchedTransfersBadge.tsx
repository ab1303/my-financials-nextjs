'use client';

import type { UnmatchedTransfersBadgeProps } from './_types';

export default function UnmatchedTransfersBadge({ count }: UnmatchedTransfersBadgeProps) {
  if (count === 0) return null;

  return (
    <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white dark:bg-amber-600">
      {count} unmatched
    </span>
  );
}
