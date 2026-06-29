import { createColumnHelper } from '@tanstack/react-table';
import { Lock } from 'lucide-react';

import { EditCell, TableCell } from '@/components/react-table';

import SourceBadge from '../_components/SourceBadge';
import type { IncomeEntryType } from '../_types';

const columnHelper = createColumnHelper<IncomeEntryType>();

export function getTableColumns() {
  return [
    columnHelper.accessor('dateEarned', {
      size: 150,
      header: () => <span>Date Earned</span>,
      cell: TableCell,
      meta: {
        type: 'DATE',
        propName: 'dateEarned',
      },
    }),
    columnHelper.accessor('amount', {
      size: 180,
      maxSize: 200,
      header: () => <span className='block text-right'>Amount Earned</span>,
      cell: TableCell,
      meta: { type: 'AMOUNT', propName: 'amount', align: 'right' },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('incomeSourceName', {
      size: 180,
      header: () => <span>Income Source</span>,
      cell: ({ getValue }) => <SourceBadge sourceName={getValue()} />,
      footer: (props) => props.column.id,
    }),
    columnHelper.display({
      id: 'actions',
      size: 100,
      header: () => <span>Actions</span>,
      cell: (props) => {
        if (props.row.original.source !== 'USER_MANUAL') {
          return (
            <div className='flex justify-center items-center'>
              <span
                title='Imported from Transaction Ledger — read only'
                className='text-gray-400 dark:text-gray-500'
              >
                <Lock size={14} />
              </span>
            </div>
          );
        }
        return <EditCell {...props} />;
      },
    }),
  ];
}
