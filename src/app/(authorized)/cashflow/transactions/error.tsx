'use client';

import TransactionsUnavailable from './TransactionsUnavailable';

interface TransactionsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TransactionsError(_: TransactionsErrorProps) {
  return (
    <TransactionsUnavailable
      title='Page unavailable'
      message='The page is not available right now. Please try again later.'
    />
  );
}
