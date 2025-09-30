'use client';

import { Label } from '@/components/ui/Label';
import Select from 'react-select';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';
import type { FormInput } from './_schema';

type InitialDataType = {
  donationYearData: Array<CalendarYearType>;
  totalDonations: number;
};

type Props = {
  initialData: InitialDataType;
  yearIdParam: string;
  children: React.ReactNode;
};

export default function DonationForm({
  initialData,
  yearIdParam,
  children,
}: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedDonationYear, setSelectedDonationYear] =
    useState<SingleValue<OptionType>>(null);
  const [totalDonations, setTotalDonations] = useState(
    initialData.totalDonations,
  );

  const donationYearOptions: Array<OptionType> = useMemo(
    () =>
      initialData.donationYearData.map((zy) => ({
        id: zy.id,
        label: zy.description,
      })),
    [initialData.donationYearData],
  );

  // Set selected year based on URL params
  useEffect(() => {
    const fromYear = searchParams?.get('fromYear');
    const toYear = searchParams?.get('toYear');

    if (fromYear && toYear) {
      const yearData = initialData.donationYearData.find(
        (yd) => yd.fromYear === +fromYear && yd.toYear === +toYear,
      );
      const yearOption = yearData
        ? {
            id: yearData.id,
            label: yearData.description,
          }
        : null;
      setSelectedDonationYear(yearOption);
    } else if (donationYearOptions.length > 0) {
      // Default to the first year if no params
      setSelectedDonationYear(donationYearOptions[0] || null);
    }
  }, [donationYearOptions, searchParams, initialData.donationYearData]);

  // Update total donations when year changes
  useEffect(() => {
    if (yearIdParam) {
      setTotalDonations(initialData.totalDonations);
    }
  }, [yearIdParam, initialData.totalDonations]);

  const onYearChange = (selectedOption: SingleValue<OptionType>) => {
    setSelectedDonationYear(selectedOption);

    const selectedYearData = selectedOption
      ? initialData.donationYearData.find((yd) => yd.id === selectedOption.id)
      : undefined;

    if (selectedYearData) {
      const current = new URLSearchParams(
        Array.from(searchParams?.entries() || []),
      );
      current.set('fromYear', selectedYearData.fromYear.toString());
      current.set('toYear', selectedYearData.toYear.toString());

      const search = current.toString();
      const query = search ? `?${search}` : '';

      router.push(`${pathname}${query}`);
    }
  };

  return (
    <div className='bg-white py-6 px-4 space-y-6 sm:p-6'>
      <div>
        <h3 className='text-lg leading-6 font-medium text-gray-900'>
          Donation Management
        </h3>
        <p className='mt-1 text-sm text-gray-500'>
          Track your charitable donations for tax reporting purposes.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6'>
        <div className='sm:col-span-3'>
          <Label htmlFor={`${id}-donation-year`}>Fiscal Year</Label>
          <div className='mt-1'>
            <Select
              inputId={`${id}-donation-year`}
              value={selectedDonationYear}
              onChange={onYearChange}
              options={donationYearOptions}
              isSearchable={false}
              placeholder='Select fiscal year...'
              className='react-select-container'
              classNamePrefix='react-select'
            />
          </div>
        </div>

        <div className='sm:col-span-3'>
          <Label htmlFor={`${id}-total-donations`}>Total Donations</Label>
          <div className='mt-1'>
            <NumericFormat
              id={`${id}-total-donations`}
              className='shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md bg-gray-50'
              prefix='$'
              displayType='text'
              thousandSeparator
              value={totalDonations}
              readOnly
            />
          </div>
          <p className='mt-1 text-xs text-gray-500'>
            Calculated from individual donation records
          </p>
        </div>
      </div>

      <div className='pt-6'>
        <Card>{children}</Card>
      </div>
    </div>
  );
}
