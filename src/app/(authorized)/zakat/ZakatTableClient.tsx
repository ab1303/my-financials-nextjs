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
import { trpcClient } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';
import { useZakatPaymentState } from './StateProvider';

import type { ZakatPaymentType } from './_types';

type ZakatTableClientProps = {};

type EditedRowType = {
  rowIndex: number;
  updatedValue: number | null;
};

const columnHelper = createColumnHelper<ZakatPaymentType>();

export default function ZakatTableClient({}: ZakatTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<string, EditedRowType>>(
    new Map()
  );

  const {
    state: { data },
    dispatch,
  } = useZakatPaymentState();

  const [selectedZakatPaymentId, setSelectedZakatPaymentId] = useState<
    string | null
  >(null);

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

  const columns = [
    columnHelper.accessor('datePaid', {
      header: () => <span>Date Paid</span>,
      cell: (info) => info.getValue().toDateString(),
    }),
    columnHelper.accessor('amount', {
      size: 220,
      maxSize: 220,
      header: () => <span>Amount Paid</span>,
      cell: (info) => info.getValue(),
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('beneficiaryType', {
      header: () => <span>Beneficiary</span>,
      cell: (info) => info.getValue(),
      footer: (props) => props.column.id,
    }),
  ];

  const table = useReactTable<ZakatPaymentType>({
    data: data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {},
  });

  return (
    <>
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
      </Table>
    </>
  );
}
