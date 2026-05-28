'use client';

import { Label } from '@/components/ui/Label';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import React, { useEffect, useId, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';
import CalendarYearPicker from '@/components/CalendarYearPicker';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';
import type { CalendarEnumType } from '@prisma/client';

type InitialDataType = {
  incomeYearData: Array<CalendarYearType>;
  totalIncome: number;
  defaultCalendarType: CalendarEnumType;
  bankOptions?: OptionType[];
  selectedBankId?: string;
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

  const [selectedBank, setSelectedBank] = useState<SingleValue<OptionType>>(null);
  const [totalIncome, setTotalIncome] = useState(initialData.totalIncome);

  // Initialize bank selection from props
  useEffect(() => {
    const bankOptions = initialData.bankOptions || [];
    const selectedBankId = initialData.selectedBankId || '';

    if (selectedBankId) {
      const currentBank = bankOptions.find((b) => b.id === selectedBankId);
      if (currentBank) {
        setSelectedBank(currentBank);
      }
    } else {
      setSelectedBank(null);
    }
  }, [initialData.bankOptions, initialData.selectedBankId]);

  // Update total income when year changes
  useEffect(() => {
    setTotalIncome(initialData.totalIncome);
  }, [initialData.totalIncome]);

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
    updateURLSearchParams('bank', option?.label);
  };

  return (
    <div className='mb-0 space-y-6'>
      <div className='mx-10'>
        <CalendarYearPicker
          applicableTypes={['FISCAL', 'ANNUAL']}
          calendarYears={initialData.incomeYearData}
          selectedYearId={yearIdParam || undefined}
          defaultType={initialData.defaultCalendarType}
          onYearChange={handleYearChange}
        />
      </div>

      <div className='mx-10'>
        <Label htmlFor={`income-bank-${id}`}>Bank Account</Label>
        <div className='mt-3'>
          <Select<OptionType>
            instanceId={`income-bank-${id}`}
            isClearable
            className='w-3/5'
            value={selectedBank}
            options={initialData.bankOptions || []}
            getOptionValue={(option) => option.id}
            onChange={(option) => handleBankChange(option)}
            placeholder='Select bank...'
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
            decimalScale={2}
            fixedDecimalScale
            value={totalIncome}
            readOnly
          />
        </div>
      </div>
      <div className='mt-8'>
        <Card.Body>{children}</Card.Body>
      </div>
    </div>
  );
}

