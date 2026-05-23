'use client';

import { Label } from '@/components/ui/Label';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import React, { useId, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

import { Card } from '@/components';
import CalendarYearPicker from '@/components/CalendarYearPicker';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';
import type { CalendarEnumType } from '@prisma/client';

type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
    yearlyData: Array<CalendarYearType>;
  };
  bankIdParam: string;
  yearIdParam: string;
  defaultType?: CalendarEnumType;
  children?: React.ReactNode;
};

export default function BankInterestForm({
  initialData: { bankOptions, yearlyData },
  bankIdParam,
  yearIdParam,
  defaultType,
  children,
}: BankInterestFormProps) {
  const uniqSelectBankId = useId();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentBank = bankOptions.find((b) => b.id === bankIdParam);

  const [selectedBank, setSelectedBank] = useState<
    SingleValue<OptionType> | undefined
  >(currentBank);

  const handleOptionChange = (option: SingleValue<OptionType>) => {
    if (!option) {
      setSelectedBank(null);
    } else if (option.id) {
      setSelectedBank(option);
    }

    updateURLSearchParams('bank', option?.label);
  };

  const updateURLSearchParams = (
    selection: 'bank' | 'year',
    value?: string,
  ) => {
    const current = new URLSearchParams(searchParams || '');

    if (!value) {
      current.delete(selection);
    } else {
      current.set(selection, value);
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.refresh(); // invalidate client cache so that after navigating back to this route; we get updated state rather than stale state
    router.replace(`${pathname}${query}`); // move to the next path
  };

  return (
    <form className='mb-0 space-y-6'>
      <CalendarYearPicker
        applicableTypes={['ANNUAL', 'FISCAL']}
        calendarYears={yearlyData}
        selectedYearId={yearIdParam || undefined}
        defaultType={defaultType}
        onYearChange={(yearId) => updateURLSearchParams('year', yearId ?? undefined)}
        className='mx-10'
      />
      <div className='mx-10'>
        <Label>Bank</Label>
        <div className='mt-1'>
          <Select<OptionType>
            instanceId={uniqSelectBankId}
            isClearable
            className='w-3/5 mr-2'
            value={selectedBank}
            options={bankOptions}
            getOptionValue={(option) => option.id}
            onChange={(option) => handleOptionChange(option)}
          />
        </div>
      </div>
      <div className='mt-8 overflow-x-scroll'>
        <Card.Body>{children}</Card.Body>
      </div>
    </form>
  );
}
