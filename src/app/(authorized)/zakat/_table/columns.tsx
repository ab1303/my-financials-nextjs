import { createColumnHelper } from '@tanstack/react-table';
import type { ZakatPaymentType } from '../_types';
import { EditCell } from '@/components/react-table/EditCell';

const columnHelper = createColumnHelper<ZakatPaymentType>();

export const columns = [
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
  columnHelper.display({
    id: 'edit',
    cell: ({ row, table }) => <EditCell row={row} table={table} />,
  }),
];
