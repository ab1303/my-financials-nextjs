'use client';

import type { CalendarEnumType } from '@prisma/client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { NumericFormat } from 'react-number-format';
import type { SingleValue } from 'react-select';

import { Card } from '@/components';
import CalendarYearPicker from '@/components/CalendarYearPicker';
import { Label } from '@/components/ui/Label';
import { SelectWrapper as Select } from '@/components/ui/Select';
import type { CalendarYearType, OptionType } from '@/types';

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
  children: ReactNode;
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

  const selectedBank =
    initialData.selectedBankId && initialData.bankOptions?.length
      ? (initialData.bankOptions.find(
          (b) => b.id === initialData.selectedBankId,
        ) ?? null)
      : null;

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
    updateURLSearchParams('bank', option?.id);
  };

  return (
    <div className='mb-0 space-y-6'>
      <div className='mx-10'>
        <div className='flex flex-wrap items-end gap-4'>
          <CalendarYearPicker
            applicableTypes={['FISCAL', 'ANNUAL']}
            calendarYears={initialData.incomeYearData}
            selectedYearId={yearIdParam || undefined}
            defaultType={initialData.defaultCalendarType}
            onYearChange={handleYearChange}
          />
          <div className='flex flex-col space-y-1.5 flex-1 min-w-[280px]'>
            <Label htmlFor={`income-bank-${id}`}>Bank Account</Label>
            <Select<OptionType>
              instanceId={`income-bank-${id}`}
              inputId={`income-bank-${id}`}
              isClearable
              className='w-full'
              value={selectedBank}
              options={initialData.bankOptions || []}
              getOptionValue={(option) => option.id}
              onChange={(option) => handleBankChange(option)}
              placeholder='Select bank…'
            />
          </div>
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
            value={initialData.totalIncome}
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
