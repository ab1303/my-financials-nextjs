import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { IncomeEntryType } from '../_types';
import SourceBadge from '../_components/SourceBadge';

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
      header: () => <span>Amount Earned</span>,
      cell: TableCell,
      meta: { type: 'AMOUNT', propName: 'amount' },
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
      cell: EditCell,
    }),
  ];
}
