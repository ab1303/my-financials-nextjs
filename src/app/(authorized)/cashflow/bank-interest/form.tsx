'use client';

import { Label } from '@/components/ui/Label';
import Select from 'react-select';
import { getSelectStyles } from '@/lib/select-styles';
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

  // State for switching between calendar types
  const [currentYearType, setCurrentYearType] =
    useState<CalendarYearType['type']>('ANNUAL');

  // Get available year types from the data
  const availableYearTypes = useMemo(
    () => Array.from(new Set(yearlyData.map((yd) => yd.type))),
    [yearlyData],
  );

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
      {/* Calendar Type Toggle */}
      {availableYearTypes.length > 1 && (
        <div className='mx-10'>
          <Label>Calendar Type</Label>
          <div className='mt-3 flex gap-2'>
            {availableYearTypes.map((type) => (
              <button
                key={type}
                type='button'
                onClick={() => {
                  setCurrentYearType(type);
                  setSelectedYear(undefined); // Clear selection when switching types
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentYearType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className='mx-10'>
        <Label>Financial Year</Label>
        <div className='mt-3'>
          <Select<OptionType>
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
            styles={getSelectStyles<OptionType>()}
          />
        </div>
      </div>
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
            styles={getSelectStyles<OptionType>()}
          />
        </div>
      </div>
      <div className='mt-8 overflow-x-scroll'>
        <Card.Body>{children}</Card.Body>
      </div>
    </form>
  );
}
