import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { ZakatPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType } from '@prisma/client';

const beneficiaryOptions = Object.entries(BeneficiaryEnumType).flatMap<
  OptionType
>(([k, v]) => ({ id: k, label: v }));

const columnHelper = createColumnHelper<ZakatPaymentType>();

export const columns = [
  columnHelper.accessor('datePaid', {
    header: () => <span>Date Paid</span>,
    cell: TableCell,
    meta: {
      type: 'DATE',
      propName: 'datePaid',
    },
  }),
  columnHelper.accessor('amount', {
    size: 220,
    maxSize: 220,
    header: () => <span>Amount Paid</span>,
    cell: TableCell,
    meta: { type: 'AMOUNT', propName: 'amount' },
    footer: (props) => props.column.id,
  }),
  columnHelper.accessor('beneficiaryType', {
    header: () => <span>Beneficiary Type</span>,
    cell: TableCell,
    meta: {
      type: 'SELECT',
      propName: 'beneficiaryType',
      selectOptions: beneficiaryOptions,
    },
    footer: (props) => props.column.id,
  }),
  columnHelper.accessor('beneficiaryId', {
    header: () => <span>Beneficiary</span>,
    cell: ({ row, column, table }) => {
      const { original } = row;
      const columnMeta = column.columnDef.meta;
      const tableMeta = table.options.meta;

      const editedRecord = tableMeta?.editedRows.get(row.id);

      return <span>Create type {editedRecord?.beneficiaryType}</span>;
    },
    footer: (props) => props.column.id,
  }),
  columnHelper.display({
    id: 'edit',
    cell: ({ row, table }) => <EditCell row={row} table={table} />,
  }),
];
