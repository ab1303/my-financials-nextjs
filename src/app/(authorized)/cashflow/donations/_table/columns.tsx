import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { DonationPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType } from '@prisma/client';
import { castDraft, produce } from 'immer';

const beneficiaryOptions = Object.entries(
  BeneficiaryEnumType,
).flatMap<OptionType>(([k, v]) => ({ id: k, label: v }));

const columnHelper = createColumnHelper<DonationPaymentType>();

export function getTableColumns(
  individualsOptions: OptionType[],
  businessesOptions: OptionType[],
) {
  return [
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
      header: () => <span>Amount Donated</span>,
      cell: TableCell,
      meta: { type: 'AMOUNT', propName: 'amount' },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('taxCategory', {
      header: () => <span>Tax Category</span>,
      cell: TableCell,
      meta: {
        type: 'INPUT',
        propName: 'taxCategory',
      },
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
      cell: TableCell,
      meta: {
        type: 'SELECT',
        propName: 'beneficiaryId',
        selectOptions: individualsOptions.concat(businessesOptions),
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span>Actions</span>,
      cell: EditCell,
    }),
  ];
}
