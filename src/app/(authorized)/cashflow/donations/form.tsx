'use client';

import React, { useId } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';
import CalendarYearPicker from '@/components/CalendarYearPicker';
import { Label } from '@/components/ui/Label';

import type { CalendarYearType } from '@/types';

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

  const totalDonations = initialData.totalDonations;

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
    <form className='mb-0 space-y-6'>
      <CalendarYearPicker
        applicableTypes={['FISCAL']}
        calendarYears={initialData.donationYearData}
        selectedYearId={yearIdParam || undefined}
        onYearChange={handleYearChange}
        label='Fiscal Year'
        className='mx-10'
      />
      <div className='mx-10'>
        <Label>Total Donations</Label>
        <div className='mt-3'>
          <NumericFormat
            id={`${id}-total-donations`}
            className='w-3/5 block px-3 py-2 text-sm border border-input bg-muted/50 text-foreground rounded-lg font-medium'
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
