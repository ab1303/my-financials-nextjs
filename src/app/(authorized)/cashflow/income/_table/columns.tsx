import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { IncomeEntryType } from '../_types';
import type { OptionType } from '@/types';
import { IncomeSourceEnumType } from '@prisma/client';
import { INCOME_SOURCE_LABELS } from '../_types';

const incomeSourceOptions: OptionType[] = Object.entries(
  IncomeSourceEnumType,
).map(([, value]) => ({
  id: value,
  label: INCOME_SOURCE_LABELS[value as IncomeSourceEnumType],
}));

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
    columnHelper.accessor('source', {
      size: 180,
      header: () => <span>Income Source</span>,
      cell: TableCell,
      meta: {
        type: 'SELECT',
        propName: 'source',
        selectOptions: incomeSourceOptions,
      },
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
