'use client';

import dynamic from 'next/dynamic';
import type { SingleValue } from 'react-select';
import { Label } from '@/components/ui/Label';
import { Suspense } from 'react';
import type { OptionType } from '@/types';
import AppSelect from '@/components/ui/AppSelect';

interface YearSnapshotSelectorsProps {
  yearOptions: OptionType[];
  selectedYear: SingleValue<OptionType>;
  onYearChange: (option: SingleValue<OptionType>) => void;
  snapshotOptions: OptionType[];
  selectedSnapshot: SingleValue<OptionType>;
  onSnapshotChange: (option: SingleValue<OptionType>) => void;
}

function YearSnapshotSelectorsContent({
  yearOptions,
  selectedYear,
  onYearChange,
  snapshotOptions,
  selectedSnapshot,
  onSnapshotChange,
}: YearSnapshotSelectorsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="year-select">Fiscal Year</Label>
        <AppSelect
          inputId="year-select"
          options={yearOptions}
          value={selectedYear}
          onChange={onYearChange}
          getOptionValue={(option: OptionType) => option.id}
          isDisabled={yearOptions.length === 0}
          className="mt-1"
        />
      </div>

      {snapshotOptions.length > 0 && (
        <div>
          <Label htmlFor="snapshot-select">Snapshot Date</Label>
          <AppSelect
            inputId="snapshot-select"
            options={snapshotOptions}
            value={selectedSnapshot}
            onChange={onSnapshotChange}
            getOptionValue={(option: OptionType) => option.id}
            className="mt-1"
          />
        </div>
      )}
    </div>
  );
}

// Wrap with dynamic import to avoid hydration mismatch
const DynamicYearSnapshotSelectors = dynamic(
  () => Promise.resolve(YearSnapshotSelectorsContent),
  {
    ssr: false,
    loading: () => <div className="h-20 bg-muted rounded animate-pulse" />,
  }
);

export function YearSnapshotSelectors(props: YearSnapshotSelectorsProps) {
  return (
    <Suspense fallback={<div className="h-20 bg-muted rounded animate-pulse" />}>
      <DynamicYearSnapshotSelectors {...props} />
    </Suspense>
  );
}
