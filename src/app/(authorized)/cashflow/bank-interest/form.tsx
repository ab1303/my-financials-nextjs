'use client';

import Select from 'react-select';
import React, { Suspense, useId, useMemo, useState } from 'react';
import { Label } from 'flowbite-react';
import { Card } from '@/components';
import PaymentHistoryModal from './_components/PaymentHistoryModal';

import type { SingleValue } from 'react-select';

import type { OptionType } from '@/types';
import type {
  BankInterestType,
  PaymentHistoryType,
} from './_hooks/useBankInterestTableData';

// TODO Refactor Section

type YearType = {
  id: string;
  type: 'fiscal' | 'annual';
  description: string;
  fromYear: number;
  fromMonth: number;
  toYear: number;
  toMonth: number;
};

const yearlyData: Array<YearType> = [
  {
    id: '2021',
    type: 'annual',
    description: '2021',
    fromYear: 2021,
    fromMonth: 1,
    toYear: 2021,
    toMonth: 12,
  },
  {
    id: '2022',
    type: 'annual',
    description: '2022',
    fromYear: 2022,
    fromMonth: 1,
    toYear: 2022,
    toMonth: 12,
  },
  {
    id: '2021-2022',
    type: 'fiscal',
    description: '2021-2022',
    fromMonth: 7,
    fromYear: 2021,
    toMonth: 6,
    toYear: 2022,
  },
  {
    id: '2022-2023',
    type: 'fiscal',
    description: '2021-2022',
    fromMonth: 7,
    fromYear: 2022,
    toMonth: 6,
    toYear: 2023,
  },
];

// const fiscalYearOptions: OptionType[] = [
//   { id: '2021-2022', label: '2021-2022' },
//   { id: '2022-2023', label: '2022-2023' },
// ];

// TODO Refactor Section End

// React Table

type BankInterestRenderProps = {
  renderTableProp: (bankId: string, year: number) => Promise<JSX.Element>;
};

type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
  };
} & BankInterestRenderProps;

export default function BankInterestForm(props: BankInterestFormProps) {
  const uniqSelectBankId = useId();
  const uniqFiscalYearId = useId();

  const {
    initialData: { bankOptions },
    renderTableProp,
  } = props;

  const [selectedBank, setSelectedBank] = useState<
    SingleValue<OptionType> | undefined
  >();

  const [selectedYear, setSelectedYear] = useState<
    SingleValue<OptionType> | undefined
  >();

  // const [data, setData] = React.useState(() => [...bankInterestData]);

  // TODO: use a Toggle control to set current year
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentYearType, setCurrentYearType] = useState<YearType['type']>(
    'annual'
  );

  const fiscalYearOptions = useMemo(() => {
    return yearlyData
      .filter((yd) => yd.type === currentYearType)
      .map((yd) => ({
        id: yd.id,
        label: yd.description,
      }));
  }, [currentYearType]);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const handleOptionChange = (option: SingleValue<OptionType>) => {
    if (!option) {
      setSelectedBank(null);
      return;
    }

    if (option.id) {
      setSelectedBank(option);
    }

    return;
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

  const handlePaymentHistoryModalClose = () => {
    setSelectedMonth(null);
  };

  const selectedBankValue = selectedBank?.id;
  const selectedYearValue = selectedYear ? +selectedYear.id : undefined;

  return (
    <form className='mb-0 space-y-6'>
      <div className='mx-10'>
        <Label>Financial Year</Label>
        <div className='mt-3'>
          <Select
            instanceId={uniqFiscalYearId}
            isClearable
            className='w-3/5 mr-2'
            value={selectedYear}
            options={fiscalYearOptions}
            onChange={(option) => setSelectedYear(option)}
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
              onClose={handlePaymentHistoryModalClose}
            />
          )} */}
          {selectedBankValue && selectedYearValue && (
            <Suspense fallback={<p>Loading...</p>}>
              {renderTableProp(selectedBankValue, selectedYearValue)}
            </Suspense>
          )}
        </Card.Body>
      </div>
    </form>
  );
}
