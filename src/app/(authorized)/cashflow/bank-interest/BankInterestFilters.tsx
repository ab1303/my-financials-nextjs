'use client';

import type { CalendarEnumType } from '@prisma/client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import type { SingleValue } from 'react-select';

import CalendarYearPicker from '@/components/CalendarYearPicker';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import { Label } from '@/components/ui/Label';
import type { CalendarYearType,OptionType } from '@/types';

type BankInterestFiltersProps = {
  initialData: {
    bankOptions: OptionType[];
    yearlyData: Array<CalendarYearType>;
  };
  bankIdParam: string;
  yearIdParam: string;
  defaultType?: CalendarEnumType;
};

export default function BankInterestFilters({
  initialData: { bankOptions, yearlyData },
  bankIdParam,
  yearIdParam,
  defaultType,
}: BankInterestFiltersProps) {
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

    updateURLSearchParams('bank', option?.id);
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
    router.replace(`${pathname}${query}`);
  };

  return (
    <div className='mb-6'>
      <div className='flex flex-wrap items-end gap-4'>
        <CalendarYearPicker
          applicableTypes={['ANNUAL', 'FISCAL']}
          calendarYears={yearlyData}
          selectedYearId={yearIdParam || undefined}
          defaultType={defaultType}
          onYearChange={(yearId) => updateURLSearchParams('year', yearId ?? undefined)}
          label='Year'
        />
        <div className='flex flex-col space-y-1.5 flex-1 min-w-[280px]'>
          <Label htmlFor={uniqSelectBankId}>Bank</Label>
          <Select<OptionType>
            instanceId={uniqSelectBankId}
            inputId={uniqSelectBankId}
            isClearable
            className='w-full'
            value={selectedBank}
            options={bankOptions}
            getOptionValue={(option) => option.id}
            onChange={(option) => handleOptionChange(option)}
          />
        </div>
      </div>
    </div>
  );
}
