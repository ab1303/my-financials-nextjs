'use client';

import { Label } from '@/components/ui/Label';
import Select from 'react-select';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';

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
    } else if (donationYearOptions.length > 0 && !fromYear && !toYear) {
      // Auto-select the first year and update URL if no params exist
      const firstYear = donationYearOptions[0];
      if (firstYear) {
        setSelectedDonationYear(firstYear);

        // Find the year data to get fromYear and toYear
        const selectedYearData = initialData.donationYearData.find(
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
    donationYearOptions,
    searchParams,
    initialData.donationYearData,
    router,
    pathname,
  ]);

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
          <Select
            isClearable
            className='w-3/5'
            value={selectedDonationYear}
            options={donationYearOptions}
            instanceId={id}
            getOptionValue={(option) => option.id}
            onChange={onYearChange}
            placeholder='Select fiscal year...'
            styles={{
              control: (provided, state) =>
                ({
                  ...provided,
                  borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
                  boxShadow: state.isFocused ? '0 0 0 1px #14b8a6' : 'none',
                  '&:hover': {
                    borderColor: '#14b8a6',
                  },
                }) as typeof provided,
              option: (provided, state) =>
                ({
                  ...provided,
                  backgroundColor: state.isSelected
                    ? '#14b8a6'
                    : state.isFocused
                      ? '#f0fdfa'
                      : 'white',
                  color: state.isSelected ? 'white' : '#374151',
                }) as typeof provided,
            }}
          />
        </div>
      </div>
      <div className='mx-10'>
        <Label>Total Donations</Label>
        <div className='mt-3'>
          <NumericFormat
            id={`${id}-total-donations`}
            className='w-3/5 block px-3 py-2 text-sm border border-gray-300 bg-gray-50 text-gray-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-medium'
            prefix='$'
            displayType='text'
            thousandSeparator
            value={totalDonations}
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
