'use client';

import clsx from 'clsx';
import Select from 'react-select';
import { useId, useMemo, useState } from 'react';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { NumericFormat } from 'react-number-format';

import useBankInterestTableData from './_hooks/useBankInterestTableData';

import type { SingleValue } from 'react-select';
import type { OptionType } from '@/types';
import type {
  BankInterestType,
  PaymentHistoryType,
} from './_hooks/useBankInterestTableData';
import { Card } from '@/components';
import Table from '@/components/table';
import React from 'react';
import PaymentHistoryModal from './_components/PaymentHistoryModal';
import { Label } from 'flowbite-react';

type BankInterestFormProps = {
  initialData: {
    bankOptions: OptionType[];
  };
};

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

const columnHelper = createColumnHelper<BankInterestType>();

export default function BankInterestForm(props: BankInterestFormProps) {
  const [selectedBank, setSelectedBank] = useState<
    SingleValue<OptionType> | undefined
  >();

  const [selectedYear, setSelectedYear] = useState<
    SingleValue<OptionType> | undefined
  >();

  const uniqSelectBankId = useId();
  const uniqFiscalYearId = useId();

  const {
    initialData: { bankOptions },
  } = props;

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

  const [selectedMonth, setSelectedMonth] = useState<{
    paymentHistory: Array<PaymentHistoryType>;
    id: number | null;
  }>({ id: null, paymentHistory: [] });

  const columns = [
    columnHelper.accessor('month', {
      header: () => <span>Month</span>,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor((row) => row.year, {
      id: 'year',
      cell: (info) => <i>{info.getValue()}</i>,
      header: () => <span>Year</span>,
    }),
    columnHelper.accessor('amountDue', {
      header: () => <span>Amount Due</span>,
      cell: (info) => {
        return (
          <NumericFormat
            prefix='$'
            displayType='text'
            thousandSeparator
            value={info.renderValue()}
          />
        );
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('amountPaid', {
      header: () => <span>Amount Paid</span>,
      cell: (info) => {
        return (
          <NumericFormat
            prefix='$'
            displayType='text'
            thousandSeparator
            value={info.renderValue()}
          />
        );
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('paymentHistory', {
      header: () => <span>Payment History</span>,
      cell: ({ row }) => {
        const { original } = row;

        return (
          <div className='flex flex-row content-around justify-between px-4 '>
            {!!original.paymentHistory && original.paymentHistory.length > 0 && (
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className='h-4 w-4 cursor-pointer'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                onClick={() => {
                  setSelectedMonth({
                    paymentHistory: original.paymentHistory || [],
                    id: original.month,
                  });
                }}
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                />
              </svg>
            )}
          </div>
        );
      },
      footer: (info) => info.column.id,
    }),
  ];

  const data = useBankInterestTableData(1, 2023, 12, 2023);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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

  const handlePaymentHistoryModalClose = (
    updatedPaymentHistory: Array<PaymentHistoryType>
  ) => {
    // update selected month
    const monthToUpdate = data.find((r) => r.month === selectedMonth.id);

    if (!monthToUpdate) {
      // Should not happen
      throw 'should not happen';
    }

    monthToUpdate.paymentHistory = [...updatedPaymentHistory];

    // TODO Later
    const updatedTableData = data.map((td) => {
      return td.month === selectedMonth.id ? monthToUpdate : td;
    });

    // setTableData(updatedTableData);

    setSelectedMonth({
      paymentHistory: [],
      id: null,
    });
  };

  return (
    <form className='mb-0 space-y-6'>
      <div className='mx-10'>
        <Label>Financial Year</Label>
        <div className='mt-3'>
          <Select
            instanceId={uniqFiscalYearId}
            isClearable
            className='w-2/5 mr-2'
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
            className='w-2/5 mr-2'
            value={selectedBank}
            options={bankOptions}
            onChange={(option) => handleOptionChange(option)}
          />
        </div>
      </div>
      <div className='mt-8 overflow-x-scroll'>
        <Card.Body>
          <PaymentHistoryModal
            selectedMonth={selectedMonth.id}
            paymentHistory={selectedMonth.paymentHistory}
            onClose={handlePaymentHistoryModalClose}
          />
          <Table>
            <Table.THead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.THead.TR key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <Table.THead.TH key={header.id}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </Table.THead.TH>
                  ))}
                </Table.THead.TR>
              ))}
            </Table.THead>
            <Table.TBody>
              {table.getRowModel().rows.map((row) => {
                return (
                  <Table.TBody.TR key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <Table.TBody.TD key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </Table.TBody.TD>
                      );
                    })}
                  </Table.TBody.TR>
                );
              })}
            </Table.TBody>
            {/* // Think about making TFoot as a RSC */}
            <Table.TFoot>
              {table.getFooterGroups().map((footerGroup) => {
                console.log('Footer group', footerGroup);
                return (
                  <Table.TFoot.TR key={footerGroup.id}>
                    {footerGroup.headers.map((header) => {
                      switch (header.id) {
                        case 'amountDue':
                          const totalAmountDue = data.reduce(
                            (total, { amountDue }) => (total += amountDue),
                            0
                          );
                          return (
                            <Table.TFoot.TH key={header.id}>
                              <NumericFormat
                                prefix='$'
                                displayType='text'
                                thousandSeparator
                                value={totalAmountDue}
                              />
                            </Table.TFoot.TH>
                          );
                        case 'amountPaid':
                          const totalAmountPaid = data.reduce(
                            (total, { amountPaid }) => (total += amountPaid),
                            0
                          );
                          return (
                            <Table.TFoot.TH key={header.id}>
                              <NumericFormat
                                prefix='$'
                                displayType='text'
                                thousandSeparator
                                value={totalAmountPaid}
                              />
                            </Table.TFoot.TH>
                          );
                        default:
                          return (
                            <Table.TFoot.TH key={header.id}></Table.TFoot.TH>
                          );
                      }
                    })}
                  </Table.TFoot.TR>
                );
              })}
            </Table.TFoot>
          </Table>
        </Card.Body>
      </div>
    </form>
  );
}
