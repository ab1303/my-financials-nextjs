'use client';

import { AppSelect as Select } from '@/components/ui/AppSelect';
import { Label } from '@/components/ui/Label';
import React, { useEffect, useId, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import CalendarYearPicker from '@/components/CalendarYearPicker';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';
import type { CalendarEnumType } from '@prisma/client';

type Props = {
  expenseYearData: Array<CalendarYearType>;
  yearIdParam: string;
  bankOptions: OptionType[];
  selectedBankId: string;
  defaultCalendarType: CalendarEnumType;
};

export default function ExpenseForm({
  expenseYearData,
  yearIdParam,
  bankOptions,
  selectedBankId,
  defaultCalendarType,
}: Props) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedBank, setSelectedBank] = useState<SingleValue<OptionType>>(null);

  // Initialize bank selection from props
  useEffect(() => {
    if (selectedBankId) {
      const currentBank = bankOptions.find((b) => b.id === selectedBankId);
      if (currentBank) {
        setSelectedBank(currentBank);
      }
    } else {
      setSelectedBank(null);
    }
  }, [selectedBankId, bankOptions]);

  const updateURLSearchParams = (key: 'year' | 'bank', value?: string) => {
    const current = new URLSearchParams(searchParams?.toString() ?? '');
    if (!value) current.delete(key);
    else current.set(key, value);
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.replace(`${pathname}${query}`);
  };

  const handleYearChange = (yearId: string | null) => {
    updateURLSearchParams('year', yearId ?? undefined);
  };

  const handleBankChange = (option: SingleValue<OptionType>) => {
    if (!option) setSelectedBank(null);
    else if (option.id) setSelectedBank(option);
    updateURLSearchParams('bank', option?.id);
  };

  return (
    <div className='w-full space-y-6'>
      <div className='flex flex-wrap items-end gap-4'>
        <CalendarYearPicker
          applicableTypes={['FISCAL', 'ANNUAL']}
          calendarYears={expenseYearData}
          selectedYearId={yearIdParam || undefined}
          defaultType={defaultCalendarType}
          onYearChange={handleYearChange}
        />
        <div className='flex flex-col space-y-1.5 flex-1 min-w-[280px]'>
          <Label htmlFor={`expense-bank-${id}`}>Bank Account</Label>
          <Select<OptionType>
            instanceId={`expense-bank-${id}`}
            inputId={`expense-bank-${id}`}
            isClearable
            className='w-full'
            value={selectedBank}
            options={bankOptions}
            getOptionValue={(option) => option.id}
            onChange={(option) => handleBankChange(option)}
            placeholder='Select bank…'
          />
        </div>
      </div>
    </div>
  );
}
