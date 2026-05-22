"use client";

import { useState } from "react";
import LinkZakatTransactionsDrawer from "./LinkZakatTransactionsDrawer";

type LinkZakatTransactionsDrawerTriggerProps = {
  dateFrom: string;
  dateTo: string;
  calendarYearId: string;
};

export default function LinkZakatTransactionsDrawerTrigger({
  dateFrom,
  dateTo,
  calendarYearId,
}: LinkZakatTransactionsDrawerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Review & Link
      </button>
      <LinkZakatTransactionsDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        calendarYearId={calendarYearId}
      />
    </>
  );
}
