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
import { HiPencil, HiTrash } from 'react-icons/hi2';

const columnHelper = createColumnHelper<CalendarYearType>();

type CalendarTableClientProps = {
  tableData: Array<CalendarYearType>;
  onEdit: (row: CalendarYearType) => void;
  onDelete: (row: CalendarYearType) => void;
};
export default function CalendarTableClient(props: CalendarTableClientProps) {
  const { tableData, onEdit, onDelete } = props;
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
    columnHelper.display({
      id: 'actions',
      header: () => <span>Actions</span>,
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className='flex gap-2'>
            <button
              type='button'
              aria-label='Edit'
              className='p-1 rounded hover:bg-gray-100'
              onClick={() => onEdit(row)}
            >
              <HiPencil className='w-3 h-3 text-blue-500' />
            </button>
            <button
              type='button'
              aria-label='Delete'
              className='p-1 rounded hover:bg-gray-100'
              onClick={() => onDelete(row)}
            >
              <HiTrash className='w-3 h-3 text-red-500' />
            </button>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable<CalendarYearType>({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
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
                    header.getContext(),
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
                        cell.getContext(),
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
