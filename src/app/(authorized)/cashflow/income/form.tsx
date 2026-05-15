'use client';

import { Label } from '@/components/ui/Label';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';

type InitialDataType = {
  incomeYearData: Array<CalendarYearType>;
  totalIncome: number;
};

type Props = {
  initialData: InitialDataType;
  yearIdParam: string;
  children: React.ReactNode;
};

export default function IncomeForm({
  initialData,
  yearIdParam,
  children,
}: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedIncomeYear, setSelectedIncomeYear] =
    useState<SingleValue<OptionType>>(null);
  const [totalIncome, setTotalIncome] = useState(initialData.totalIncome);

  const incomeYearOptions: Array<OptionType> = useMemo(
    () =>
      initialData.incomeYearData.map((iy) => ({
        id: iy.id,
        label: iy.description,
      })),
    [initialData.incomeYearData],
  );

  // Set selected year based on URL params
  useEffect(() => {
    const fromYear = searchParams?.get('fromYear');
    const toYear = searchParams?.get('toYear');

    if (fromYear && toYear) {
      const yearData = initialData.incomeYearData.find(
        (yd) => yd.fromYear === +fromYear && yd.toYear === +toYear,
      );
      const yearOption = yearData
        ? {
            id: yearData.id,
            label: yearData.description,
          }
        : null;
      setSelectedIncomeYear(yearOption);
    } else if (incomeYearOptions.length > 0 && !fromYear && !toYear) {
      // Auto-select the first year and update URL if no params exist
      const firstYear = incomeYearOptions[0];
      if (firstYear) {
        setSelectedIncomeYear(firstYear);

        // Find the year data to get fromYear and toYear
        const selectedYearData = initialData.incomeYearData.find(
          (yd) => yd.id === firstYear.id,
        );

        if (selectedYearData) {
          const current = new URLSearchParams();
          current.set('fromYear', selectedYearData.fromYear.toString());
          current.set('toYear', selectedYearData.toYear.toString());

          const search = current.toString();
          const query = search ? `?${search}` : '';

          router.replace(`${pathname}${query}`);
        }
      }
    }
  }, [
    incomeYearOptions,
    searchParams,
    initialData.incomeYearData,
    router,
    pathname,
  ]);

  // Update total income when year changes
  useEffect(() => {
    if (yearIdParam) {
      setTotalIncome(initialData.totalIncome);
    }
  }, [yearIdParam, initialData.totalIncome]);

  const onYearChange = (selectedOption: SingleValue<OptionType>) => {
    setSelectedIncomeYear(selectedOption);

    const selectedYearData = selectedOption
      ? initialData.incomeYearData.find((yd) => yd.id === selectedOption.id)
      : undefined;

    const current = new URLSearchParams(
      Array.from(searchParams?.entries() || []),
    );

    if (selectedYearData) {
      current.set('fromYear', selectedYearData.fromYear.toString());
      current.set('toYear', selectedYearData.toYear.toString());
    } else {
      // Clear the parameters when no year is selected
      current.delete('fromYear');
      current.delete('toYear');
    }

    const search = current.toString();
    const query = search ? `?${search}` : '';

    router.push(`${pathname}${query}`);
  };

  return (
    <form className='mb-0 space-y-6'>
      <div className='mx-10'>
        <Label>Fiscal Year</Label>
        <div className='mt-3'>
          <Select<OptionType>
            isClearable
            className='w-3/5'
            value={selectedIncomeYear}
            options={incomeYearOptions}
            instanceId={id}
            getOptionValue={(option) => option.id}
            onChange={onYearChange}
            placeholder='Select fiscal year...'
          />
        </div>
      </div>
      <div className='mx-10'>
        <Label>Total Earned</Label>
        <div className='mt-3'>
          <NumericFormat
            id={`${id}-total-income`}
            className='w-3/5 block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
            prefix='$'
            displayType='text'
            thousandSeparator
            value={totalIncome}
            readOnly
          />
        </div>
      </div>
      <div className='mt-8'>
        <Card.Body>{children}</Card.Body>
      </div>
    </form>
  );
}
