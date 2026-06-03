'use client';

import React, { useId } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

import CalendarYearPicker from '@/components/CalendarYearPicker';
import { Label } from '@/components/ui/Label';

import type { CalendarYearType } from '@/types';

type InitialDataType = {
  donationYearData: Array<CalendarYearType>;
  donationTotals: {
    voluntaryTotal: number;
    interestCleansingTotal: number;
    deductibleTotal: number;
    nonDeductibleTotal: number;
  };
};

type Props = {
  initialData: InitialDataType;
  yearIdParam: string;
};

const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

export default function DonationFilters({
  initialData,
  yearIdParam,
}: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { voluntaryTotal, interestCleansingTotal, deductibleTotal, nonDeductibleTotal } = initialData.donationTotals;
  const totalDonations = deductibleTotal + nonDeductibleTotal;

  const handleYearChange = (yearId: string | null) => {
    const current = new URLSearchParams(searchParams || '');
    if (!yearId) {
      current.delete('year');
    } else {
      current.set('year', yearId);
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.replace(`${pathname}${query}`);
  };

  return (
    <div className='mb-6 space-y-6'>
      <CalendarYearPicker
        applicableTypes={['FISCAL', 'ANNUAL']}
        calendarYears={initialData.donationYearData}
        selectedYearId={yearIdParam || undefined}
        onYearChange={handleYearChange}
        label='Year'
      />

      {/* Total Donations */}
      <div>
        <Label>Total Donations</Label>
        <div className='mt-3'>
          <div
            id={`${id}-total-donations`}
            className='w-3/5 block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
            aria-readonly='true'
          >
            {formatCurrency(totalDonations)}
          </div>
        </div>
      </div>

      {/* Breakdown by Purpose */}
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label>Voluntary Donations</Label>
          <div className='mt-3'>
            <div
              id={`${id}-voluntary-total`}
              className='block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
              aria-readonly='true'
            >
              {formatCurrency(voluntaryTotal)}
            </div>
          </div>
        </div>

        <div>
          <Label>Interest Cleansing</Label>
          <div className='mt-3'>
            <div
              id={`${id}-cleansing-total`}
              className='block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
              aria-readonly='true'
            >
              {formatCurrency(interestCleansingTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Deductibility */}
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label>Deductible (DGR)</Label>
          <div className='mt-3'>
            <div
              id={`${id}-deductible-total`}
              className='block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
              aria-readonly='true'
            >
              {formatCurrency(deductibleTotal)}
            </div>
          </div>
        </div>

        <div>
          <Label>Non-Deductible</Label>
          <div className='mt-3'>
            <div
              id={`${id}-nondeductible-total`}
              className='block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
              aria-readonly='true'
            >
              {formatCurrency(nonDeductibleTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
