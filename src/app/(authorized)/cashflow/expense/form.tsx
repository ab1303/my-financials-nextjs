'use client';

import type { CalendarEnumType } from '@prisma/client';
import { usePathname, useRouter,useSearchParams } from 'next/navigation';
import { useId } from 'react';
import type { SingleValue } from 'react-select';

import CalendarYearPicker from '@/components/CalendarYearPicker';
import { SelectWrapper as Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import type { CalendarYearType,OptionType } from '@/types';

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

  const selectedBank = selectedBankId
    ? bankOptions.find((b) => b.id === selectedBankId) ?? null
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
