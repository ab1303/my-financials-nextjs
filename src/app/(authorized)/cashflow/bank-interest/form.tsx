'use client';

import { Label } from 'flowbite-react';
import Select from 'react-select';
import React, { useId, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

import { Card } from '@/components';
import PaymentHistoryModal from './_components/PaymentHistoryModal';

import type { SingleValue } from 'react-select';

import type { OptionType, YearType } from '@/types';

// TODO Refactor Section

// const fiscalYearOptions: OptionType[] = [
//   { id: '2021-2022', label: '2021-2022' },
//   { id: '2022-2023', label: '2022-2023' },
// ];

// TODO Refactor Section End

// React Table

type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
    yearlyData: Array<YearType>;
  };
  bankIdParam: string;
  yearParam: string;
  children?: React.ReactNode;
};

export default function BankInterestForm({
  initialData: { bankOptions, yearlyData },
  bankIdParam,
  yearParam,
  children,
}: BankInterestFormProps) {
  const uniqSelectBankId = useId();
  const uniqFiscalYearId = useId();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // TODO: use a Toggle control to set current year
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentYearType, setCurrentYearType] = useState<YearType['type']>(
    'annual'
  );

  const currentYearData = yearlyData.find((yd) => yd.id === yearParam);
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

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

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
    value?: string
  ) => {
    const current = new URLSearchParams(searchParams || '');

    if (!value) {
      current.delete(selection);
    } else {
      current.set(selection, value);
    }
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  };

  // const handlePaymentHistoryUpdate = (
  //   updatedPaymentHistory: Array<PaymentHistoryType>
  // ) => {
  //   const updatedTableData = data.map((td) => {
  //     if (td.month !== selectedMonth) return td;

  //     return {
  //       ...td,
  //       amountPaid: updatedPaymentHistory.reduce(
  //         (total, { amount }) => (total += amount),
  //         0
  //       ),
  //       paymentHistory: [...updatedPaymentHistory],
  //     };
  //   });

  //   setData([...updatedTableData]);
  // };

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
              updateURLSearchParams('year', option?.id);
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
        <Card.Body>
          {/* {selectedMonth && (
            <PaymentHistoryModal
              selectedMonth={selectedMonth}
              paymentHistory={
                data.find((d) => d.month === selectedMonth)?.paymentHistory ||
                []
              }
              onPaymentHistoryUpdate={handlePaymentHistoryUpdate}
              onClose={() => {
                setSelectedMonth(null);
              }}
            />
          )} */}

          {children}
        </Card.Body>
      </div>
    </form>
  );
}
