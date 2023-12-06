'use client';
import { enableMapSet } from 'immer';

enableMapSet();

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { toast } from 'react-toastify';

import Table from '@/components/table';
import { trpcClient } from '@/server/trpc/client';
import { TRPCError } from '@trpc/server';
import { useZakatPaymentState } from './StateProvider';

import { getTableColumns } from './_table/columns';

import type { ZakatPaymentType } from './_types';
import type { OptionType } from '@/types';

type ZakatTableClientProps = {
  individualsOptions: OptionType[];
};

export default function ZakatTableClient({
  individualsOptions,
}: ZakatTableClientProps) {
  const [editedRows, setEditedRows] = useState<Map<string, ZakatPaymentType>>(
    new Map()
  );
  const [validRows, setValidRows] = useState({});

  const {
    state: { data },
    dispatch,
  } = useZakatPaymentState();

  const columns = useMemo(() => getTableColumns(individualsOptions), [
    individualsOptions,
  ]);

  const table = useReactTable<ZakatPaymentType>({
    data: data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editedRows,
      validRows,
      setEditedRows,
      revertData: (rowIndex: number) => {
        // TODO
        // setData((old) =>
        //   old.map((row, index) =>
        //     index === rowIndex ? originalData[rowIndex] : row
        //   )
        // );
      },
      updateRow: (rowIndex: number) => {
        // TODO
        // updateRow(data[rowIndex].id, data[rowIndex]);
      },
      removeRow: (rowIndex: number) => {
        //deleteRow(data[rowIndex].id);
      },
    },
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
