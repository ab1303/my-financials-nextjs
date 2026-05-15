'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import LinkTransactionsDrawer from './LinkTransactionsDrawer';

interface LinkTransactionsDrawerTriggerProps {
  dateFrom: string;
  dateTo: string;
  calendarYearId: string;
}

export default function LinkTransactionsDrawerTrigger({
  dateFrom,
  dateTo,
  calendarYearId,
}: LinkTransactionsDrawerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleClose = () => {
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="ml-4 shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
      >
        Link Transactions
      </button>
      {isOpen ? (
        <LinkTransactionsDrawer
          isOpen={isOpen}
          onClose={handleClose}
          dateFrom={dateFrom}
          dateTo={dateTo}
          calendarYearId={calendarYearId}
        />
      ) : null}
    </>
  );
}
