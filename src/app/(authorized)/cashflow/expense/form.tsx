'use client';

import { AppSelect as Select } from '@/components/ui/AppSelect';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';

type Props = {
  expenseYearData: Array<CalendarYearType>;
  selectedCalendarYear: CalendarYearType | undefined;
};

export default function ExpenseForm({
  expenseYearData,
  selectedCalendarYear,
}: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedExpenseYear, setSelectedExpenseYear] =
    useState<SingleValue<OptionType>>(null);

  const expenseYearOptions: Array<OptionType> = useMemo(
    () =>
      expenseYearData.map((ey) => ({
        id: ey.id,
        label: ey.description,
      })),
    [expenseYearData],
  );

  // Set selected year based on URL params or default
  useEffect(() => {
    if (selectedCalendarYear) {
      setSelectedExpenseYear({
        id: selectedCalendarYear.id,
        label: selectedCalendarYear.description,
      });
    } else if (expenseYearOptions.length > 0) {
      // Auto-select the first year if no selection
      const firstYear = expenseYearOptions[0];
      if (firstYear) {
        setSelectedExpenseYear(firstYear);

        // Update URL with first year
        const yearData = expenseYearData[0];
        if (yearData) {
          const params = new URLSearchParams(searchParams?.toString());
          params.set('fromYear', yearData.fromYear.toString());
          params.set('toYear', yearData.toYear.toString());
          router.replace(`${pathname}?${params.toString()}`);
        }
      }
    }
  }, [
    selectedCalendarYear,
    expenseYearOptions,
    expenseYearData,
    pathname,
    router,
    searchParams,
  ]);

  const handleYearChange = (newValue: SingleValue<OptionType>) => {
    setSelectedExpenseYear(newValue);

    if (newValue) {
      const yearData = expenseYearData.find((yd) => yd.id === newValue.id);
      if (yearData) {
        const params = new URLSearchParams(searchParams?.toString());
        params.set('fromYear', yearData.fromYear.toString());
        params.set('toYear', yearData.toYear.toString());
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  };

  return (
    <div className='w-full max-w-md'>
      <label
        htmlFor={`expense-year-${id}`}
        className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 cursor-default'
      >
        Fiscal Year
      </label>
      <Select<OptionType>
        instanceId={`expense-year-${id}`}
        options={expenseYearOptions}
        value={selectedExpenseYear}
        onChange={handleYearChange}
        getOptionValue={(option) => option.id}
        placeholder='Select fiscal year...'
        isClearable={false}
      />
    </div>
  );
}
