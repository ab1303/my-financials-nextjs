import Link from 'next/link';

interface TransferExclusionSummaryProps {
  count: number;
  totalAmount: number;
  href: string;
}

export function TransferExclusionSummary({
  count,
  totalAmount,
  href,
}: TransferExclusionSummaryProps) {
  if (count === 0) return null;

  return (
    <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
      ↔{' '}
      <span className='font-medium'>
        {count} transfer{count > 1 ? 's' : ''}
      </span>{' '}
      excluded from totals — $
      {totalAmount.toLocaleString('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}{' '}
      moved between accounts.{' '}
      <Link
        href={href}
        className='underline hover:text-gray-700 dark:hover:text-gray-200'
      >
        View or reclassify →
      </Link>
    </p>
  );
}
