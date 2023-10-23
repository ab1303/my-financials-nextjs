'use client';

import { useState } from 'react';
import { NumericFormat } from 'react-number-format';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'react-toastify';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';

import PaymentHistoryModal from './_components/PaymentHistoryModal';
import EditableTableCell from './_components/EditableTableCell';

import type { BankInterestType, PaymentHistoryType } from '@/types';
import { trpcClient } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';
import { useBankInterestState } from './StateProvider';

const columnHelper = createColumnHelper<BankInterestType>();

type BankInterestTableClientProps = {
  bankId: string;
  year: number;
};

type EditedRowType = {
  rowIndex: number;
  updatedValue: number | null;
};

export default function BankInterestTableClient({
  bankId,
  year,
}: BankInterestTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<string, EditedRowType>>(
    new Map()
  );

  const {
    state: { data },
    dispatch,
  } = useBankInterestState();

  const [selectedBankInterestId, setSelectedBankInterestId] = useState<
    string | null
  >(null);

  const columns = [
    columnHelper.accessor('month', {
      header: () => <span>Month</span>,
      cell: (info) => MONTHS_MAP.get(info.getValue()),
    }),
    columnHelper.accessor('amountDue', {
      size: 220,
      maxSize: 220,
      header: () => <span>Amount Due</span>,
      cell: ({ row, renderValue }) => {
        let hasEditedRow = false;
        let renderedValue = renderValue();

        if (editedRows.has(row.original.id)) {
          hasEditedRow = true;
          renderedValue = editedRows.get(row.original.id)?.updatedValue || 0;
        }

        return (
          <EditableTableCell
            inProgress={hasEditedRow}
            originalValue={renderedValue}
            OnValueChange={(value) => {
              console.log('updated value', value);
              updateEditRows(row.original.id, {
                rowIndex: row.index,
                updatedValue: value,
              });
              // update details
              updateBankInterestDetailsMutation.mutate({
                bankId,
                amount: value || 0,
                bankInterestId: row.original.id,
                year,
              });
            }}
          />
        );
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('amountPaid', {
      header: () => <span>Amount Paid</span>,
      cell: ({ row }) => {
        const totalPaid = row.original.paymentHistory.reduce(
          (total, { amount }) => (total += amount),
          0
        );

        return (
          <NumericFormat
            prefix='$'
            displayType='text'
            thousandSeparator
            value={totalPaid}
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
                setSelectedBankInterestId(original.id);
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
    meta: {},
  });

  const updateBankInterestDetailsMutation = trpcClient.bankInterest.updateBankInterestDetail.useMutation(
    {
      onError(error: unknown, { bankInterestId }) {
        if (error instanceof TRPCError) {
          toast.error(error.message);
        }
        updateEditRows(bankInterestId);
      },

      onSuccess(_, { bankInterestId, amount }) {
        toast.success('Interest payment detail updated!');
        updateEditRows(bankInterestId);

        dispatch({
          type: 'BANK_INTEREST/UPDATE_INTEREST_PAYMENT',
          payload: {
            amount,
            bankInterestId,
          },
        });
      },
    }
  );

  const updateEditRows = (id: string, record?: EditedRowType) => {
    setEditedRows((prev) => {
      const result = new Map(prev);
      if (!record) {
        result.delete(id);
      } else {
        result.set(id, record);
      }

      return result;
    });
  };

  return (
    <>
      {selectedBankInterestId && (
        <PaymentHistoryModal
          bankInterestId={selectedBankInterestId}
          paymentHistory={
            data.find((d) => d.id === selectedBankInterestId)?.paymentHistory ||
            []
          }
          onClose={() => {
            setSelectedBankInterestId(null);
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
