'use client';

import { useState } from 'react';
import {
  useReactTable,
  createColumnHelper,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';

import Table from '@/components/table';
import MONTHS_MAP from '@/constants/map';
import type { CalendarYearType } from './_types';
import { HiPencil, HiTrash, HiCheck, HiXMark } from 'react-icons/hi2';

const columnHelper = createColumnHelper<CalendarYearType>();

type CalendarTableClientProps = {
  tableData: Array<CalendarYearType>;
  onEdit: (row: CalendarYearType) => void;
  onDelete: (row: CalendarYearType) => void;
};
export default function CalendarTableClient(props: CalendarTableClientProps) {
  const { tableData, onEdit, onDelete } = props;
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
        const isDeleting = deletingId === row.id;

        return (
          <div className='flex gap-2'>
            {!isDeleting && (
              <button
                type='button'
                aria-label='Edit'
                title='Edit calendar year'
                className='p-1 rounded hover:bg-gray-100 transition-colors'
                onClick={() => onEdit(row)}
              >
                <HiPencil className='w-4 h-4 text-blue-500' />
              </button>
            )}

            {isDeleting ? (
              <>
                <button
                  type='button'
                  aria-label='Confirm delete'
                  title='Confirm delete'
                  className='p-1 rounded hover:bg-green-100 transition-colors'
                  onClick={() => {
                    onDelete(row);
                    setDeletingId(null);
                  }}
                >
                  <HiCheck className='w-4 h-4 text-green-600' />
                </button>
                <button
                  type='button'
                  aria-label='Cancel delete'
                  title='Cancel delete'
                  className='p-1 rounded hover:bg-gray-100 transition-colors'
                  onClick={() => setDeletingId(null)}
                >
                  <HiXMark className='w-4 h-4 text-gray-500' />
                </button>
              </>
            ) : (
              <button
                type='button'
                aria-label='Delete'
                title='Delete calendar year'
                className='p-1 rounded hover:bg-red-100 transition-colors'
                onClick={() => setDeletingId(row.id)}
              >
                <HiTrash className='w-4 h-4 text-red-500' />
              </button>
            )}
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
