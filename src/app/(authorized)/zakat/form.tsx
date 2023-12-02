'use client';

import { Label } from 'flowbite-react';
import Select from 'react-select';
import React, { useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { NumericFormat } from 'react-number-format';

import { Card } from '@/components';

import type { SingleValue } from 'react-select';
import type { OptionType, CalendarYearType } from '@/types';
import type { InputAttributes, NumericFormatProps } from 'react-number-format';
import type { FormInput } from './_schema';
import type { ServerActionType } from './_types';
import { BeneficiaryEnumType } from '@prisma/client';

// React Table
type NumericFormatWithIndicatorProps<BaseType> = NumericFormatProps<
  BaseType
> & {
  isWorking: boolean;
  indicatorText: string;
};

function NumericFormatWithIndicator<BaseType = InputAttributes>({
  value,
  indicatorText,
  isWorking,
  onValueChange,
  onBlur,
}: NumericFormatWithIndicatorProps<BaseType>) {
  return (
    <div className='flex items-center'>
      <NumericFormat
        itemRef=''
        prefix='$'
        displayType='input'
        className='w-3/5 mr-2'
        thousandSeparator
        value={value}
        onValueChange={onValueChange}
        onBlur={onBlur}
      />
      {isWorking && (
        <div role='status'>
          <svg
            aria-hidden='true'
            className='w-4 h-4 me-2 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600'
            viewBox='0 0 100 101'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path
              d='M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z'
              fill='currentColor'
            />
            <path
              d='M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z'
              fill='currentFill'
            />
          </svg>
          <span className='sr-only'>{indicatorText}</span>
        </div>
      )}
    </div>
  );
}

type ZakatFormProps = {
  initialData: {
    zakatYearData: Array<CalendarYearType>;
    amountDue: number;
  };
  yearIdParam: string;
  children?: React.ReactNode;
  addZakatCalendarYear: (formData: FormInput) => Promise<ServerActionType>;
};

export default function ZakatForm({
  initialData: { zakatYearData, amountDue },
  yearIdParam,
  addZakatCalendarYear,
  children,
}: ZakatFormProps) {
  const uniqFiscalYearId = useId();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [totalAmountDue, setTotalAmountDue] = useState<number>(amountDue);
  const [isSavingAmount, setIsSavingAmount] = useState<boolean>(false);

  const currentYearData = zakatYearData.find((yd) => yd.id === yearIdParam);
  const currentYearOption = currentYearData
    ? {
        id: currentYearData.id,
        label: currentYearData.description,
      }
    : undefined;

  const [selectedYear, setSelectedYear] = useState<
    SingleValue<OptionType> | undefined
  >(currentYearOption);

  const zakatYearOptions = useMemo(() => {
    return zakatYearData.map((yd) => ({
      id: yd.id,
      label: yd.description,
    }));
  }, [zakatYearData]);

  const updateURLSearchParams = (selectedYear?: CalendarYearType) => {
    const current = new URLSearchParams(searchParams || '');

    if (!selectedYear) {
      current.delete('fromYear');
      current.delete('toYear');
    } else {
      current.set('fromYear', selectedYear.fromYear.toString());
      current.set('toYear', selectedYear.toYear.toString());
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.refresh(); // invalidate client cache so that after navigating back to this route; we get updated state rather than stale state
    router.replace(`${pathname}${query}`); // move to the next path
  };

  const updateTotalZakatAmount = async () => {
    if (!selectedYear) return;
    setIsSavingAmount(true);
    await addZakatCalendarYear({
      calendarYearId: selectedYear.id,
      totalAmount: totalAmountDue,
    });
    setIsSavingAmount(false);
  };

  return (
    <form className='mb-0 space-y-6'>
      <div className='mx-10'>
        <Label>Zakat Year</Label>
        <div className='mt-3'>
          <Select
            isClearable
            className='w-3/5 mr-2'
            value={selectedYear}
            options={zakatYearOptions}
            instanceId={uniqFiscalYearId}
            getOptionValue={(option) => option.id}
            onChange={(option) => {
              setSelectedYear(option);
              const selectedYearData = zakatYearData.find(
                (yd) => yd.id === option?.id
              );

              updateURLSearchParams(selectedYearData);
            }}
          />
        </div>
      </div>
      <div className='mx-10'>
        <Label>Total Amount Due</Label>
        <div className='mt-3'>
          <NumericFormatWithIndicator
            indicatorText='Saving...'
            isWorking={isSavingAmount}
            itemRef=''
            prefix='$'
            displayType='input'
            className='w-3/5 mr-2'
            thousandSeparator
            value={totalAmountDue}
            onValueChange={(values) => {
              setTotalAmountDue(values.floatValue || 0);
            }}
            onBlur={updateTotalZakatAmount}
          />
        </div>
      </div>
      <div className='mt-8'>
        <Card.Body>{children}</Card.Body>
      </div>
    </form>
  );
}
