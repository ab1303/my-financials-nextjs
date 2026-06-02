'use client';

import { Fragment } from 'react';
import { toast } from 'sonner';

interface CharityClassificationMenuProps {
  transactionId: string;
  onSelectDonation: (transactionId: string) => void;
  onSelectZakat: (transactionId: string) => void;
}

/**
 * Small inline menu for users to choose between Donation or Zakat classification.
 * Appears as two buttons in the transaction row actions.
 */
export default function CharityClassificationMenu({
  transactionId,
  onSelectDonation,
  onSelectZakat,
}: CharityClassificationMenuProps) {
  return (
    <Fragment>
      <button
        type="button"
        onClick={() => onSelectDonation(transactionId)}
        className="rounded px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
        title="Classify as Donation"
      >
        🎁 Donation
      </button>
      <button
        type="button"
        onClick={() => onSelectZakat(transactionId)}
        className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
        title="Classify as Zakat"
      >
        🕌 Zakat
      </button>
    </Fragment>
  );
}
