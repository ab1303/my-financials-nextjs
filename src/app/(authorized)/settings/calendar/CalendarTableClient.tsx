'use client';

import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';
import type { CalendarYearType } from './_types';

const columnHelper = createColumnHelper<CalendarYearType>();

type CalendarTableClientProps = {
  tableData: Array<CalendarYearType>;
};

export default function CalendarTableClient({
  tableData,
}: CalendarTableClientProps) {
  const columns = [
    columnHelper.accessor('fromYear', {
      header: () => <span>From Year</span>,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('fromMonth', {
      header: () => <span>From Month</span>,
      cell: (info) => MONTHS_MAP.get(info.getValue()),
    }),
    columnHelper.accessor('toYear', {
      header: () => <span>To Year</span>,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('toMonth', {
      header: () => <span>To Month</span>,
      cell: (info) => MONTHS_MAP.get(info.getValue()),
    }),
    columnHelper.accessor('description', {
      size: 220,
      maxSize: 220,
      header: () => <span>Display</span>,
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('type', {
      header: () => <span>Type</span>,
      cell: (info) => info.getValue(),
    }),
  ];

  const table = useReactTable<CalendarYearType>({
    data: tableData,
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
