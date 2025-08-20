'use client';

import { Label } from '@/components/ui/Label';
import Select from 'react-select';
import React, { useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

import { Card } from '@/components';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';

type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
    yearlyData: Array<CalendarYearType>;
  };
  bankIdParam: string;
  yearIdParam: string;
  children?: React.ReactNode;
};

export default function BankInterestForm({
  initialData: { bankOptions, yearlyData },
  bankIdParam,
  yearIdParam,
  children,
}: BankInterestFormProps) {
  const uniqSelectBankId = useId();
  const uniqFiscalYearId = useId();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // TODO: use a Toggle control to set current year
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentYearType, setCurrentYearType] =
    useState<CalendarYearType['type']>('ANNUAL');

  const currentYearData = yearlyData.find((yd) => yd.id === yearIdParam);
  const currentYearOption = currentYearData
    ? {
        id: currentYearData.id,
        label: currentYearData.description,
      }
    : undefined;

  const [selectedYear, setSelectedYear] = useState<
    SingleValue<OptionType> | undefined
  >(currentYearOption);

  const currentBank = bankOptions.find((b) => b.id === bankIdParam);

  const [selectedBank, setSelectedBank] = useState<
    SingleValue<OptionType> | undefined
  >(currentBank);

  // const [data, setData] = React.useState(() => [...bankInterestData]);

  const fiscalYearOptions = useMemo(() => {
    return yearlyData
      .filter((yd) => yd.type === currentYearType)
      .map((yd) => ({
        id: yd.id,
        label: yd.description,
      }));
  }, [currentYearType, yearlyData]);

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
      <div className='mx-10'>
        <Label>Financial Year</Label>
        <div className='mt-3'>
          <Select
            isClearable
            className='w-3/5 mr-2'
            value={selectedYear}
            options={fiscalYearOptions}
            instanceId={uniqFiscalYearId}
            getOptionValue={(option) => option.id}
            onChange={(option) => {
              setSelectedYear(option);
              updateURLSearchParams('year', option?.label);
            }}
          />
        </div>
      </div>
      <div className='mx-10'>
        <Label>Bank</Label>
        <div className='mt-1'>
          <Select
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
