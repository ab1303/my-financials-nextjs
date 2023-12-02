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
    meta: { type: 'DATE' },
  }),
  columnHelper.accessor('amount', {
    size: 220,
    maxSize: 220,
    header: () => <span>Amount Paid</span>,
    cell: TableCell,
    meta: { type: 'AMOUNT' },
    footer: (props) => props.column.id,
  }),
  columnHelper.accessor('beneficiaryType', {
    header: () => <span>Beneficiary</span>,
    cell: TableCell,
    meta: { type: 'SELECT', selectOptions: beneficiaryOptions },
    footer: (props) => props.column.id,
  }),
  columnHelper.display({
    id: 'edit',
    cell: ({ row, table }) => <EditCell row={row} table={table} />,
  }),
];
