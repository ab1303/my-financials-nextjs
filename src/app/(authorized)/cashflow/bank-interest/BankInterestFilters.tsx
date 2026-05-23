'use client';

import { useId, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { SingleValue } from 'react-select';

import { Label } from '@/components/ui/Label';
import { AppSelect as Select } from '@/components/ui/AppSelect';
import CalendarYearPicker from '@/components/CalendarYearPicker';

import type { OptionType, CalendarYearType } from '@/types';
import type { CalendarEnumType } from '@prisma/client';

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
    router.replace(`${pathname}${query}`);
  };

  return (
    <div className='mb-6 space-y-6'>
      <CalendarYearPicker
        applicableTypes={['ANNUAL', 'FISCAL']}
        calendarYears={yearlyData}
        selectedYearId={yearIdParam || undefined}
        defaultType={defaultType}
        onYearChange={(yearId) => updateURLSearchParams('year', yearId ?? undefined)}
        label='Year'
      />
      <div>
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
    </div>
  );
}
