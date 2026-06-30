'use client';

import TransactionsUnavailable from './TransactionsUnavailable';

export default function TransactionsError() {
  return (
    <TransactionsUnavailable
      title='Page unavailable'
      message='The page is not available right now. Please try again later.'
    />
  );
}
