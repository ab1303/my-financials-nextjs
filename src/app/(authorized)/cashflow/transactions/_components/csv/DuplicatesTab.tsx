import { useState } from 'react';

import type { ClassifiedMonth } from './_types';
import DuplicatesReviewTable from './DuplicatesReviewTable';

interface DuplicatesTabProps {
  debitMonths: ClassifiedMonth[];
  forceCreateIds: string[];
  onToggleForceCreateId: (id: string) => void;
}

export default function DuplicatesTab({
  debitMonths,
  forceCreateIds,
  onToggleForceCreateId,
}: DuplicatesTabProps) {
  // Aggregate duplicates from all months
  const candidates = debitMonths.flatMap((m) => m.duplicates ?? []);

  if (candidates.length === 0) return <div>No duplicates found.</div>;

  return (
    <div className='flex h-full flex-col'>
      <h2 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
        Duplicates
      </h2>
      <p className='text-sm text-gray-500'>
        Review potential duplicates and force-create if needed.
      </p>
      <DuplicatesReviewTable
        candidates={candidates}
        selectedIds={forceCreateIds}
        onToggleId={onToggleForceCreateId}
      />
    </div>
  );
}
