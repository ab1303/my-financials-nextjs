'use client';

import { useEffect, useState } from 'react';
import { NumericFormat } from 'react-number-format';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';
import PaymentHistoryModal from './_components/PaymentHistoryModal';

import type { BankInterestType, PaymentHistoryType } from '@/types';

const columnHelper = createColumnHelper<BankInterestType>();

type BankInterestTableClientProps = {
  data: Array<BankInterestType>;
};

export default function BankInterestTableClient({
  data: defaultData,
}: BankInterestTableClientProps) {
  const [data, setData] = useState(() => [...defaultData]);

  useEffect(() => {
    setData(defaultData);
  }, [defaultData]);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const columns = [
    columnHelper.accessor('month', {
      header: () => <span>Month</span>,
      cell: (info) => MONTHS_MAP.get(info.getValue()),
    }),
    columnHelper.accessor('amountDue', {
      size: 220,
      maxSize: 220,
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
      size: 100,
      maxSize: 100,
      header: () => <span>Payment(s)</span>,
      cell: ({ row }) => {
        const { original } = row;

        return (
          <div className='flex flex-row content-around justify-between px-4 '>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-4 w-4 cursor-pointer'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              onClick={() => {
                setSelectedMonth(original.month);
              }}
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
              />
            </svg>
          </div>
        );
      },
      footer: (info) => info.column.id,
    }),
  ];

  const table = useReactTable<BankInterestType>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handlePaymentHistoryUpdate = (
    updatedPaymentHistory: Array<PaymentHistoryType>
  ) => {
    const updatedTableData = data.map((td) => {
      if (td.month !== selectedMonth) return td;

      return {
        ...td,
        amountPaid: updatedPaymentHistory.reduce(
          (total, { amount }) => (total += amount),
          0
        ),
        paymentHistory: [...updatedPaymentHistory],
      };
    });

    setData([...updatedTableData]);
  };

  return (
    <>
      {selectedMonth && (
        <PaymentHistoryModal
          selectedMonth={selectedMonth}
          paymentHistory={
            data.find((d) => d.month === selectedMonth)?.paymentHistory || []
          }
          onPaymentHistoryUpdate={handlePaymentHistoryUpdate}
          onClose={() => {
            setSelectedMonth(null);
          }}
        />
      )}

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
                    <Table.TBody.TD
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
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
        <Table.TFoot>
          {!!data.length &&
            table.getFooterGroups().map((footerGroup) => {
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
    </>
  );
}
