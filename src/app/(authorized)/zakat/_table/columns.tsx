import { createColumnHelper } from '@tanstack/react-table';
import { Lock, Unlink } from 'lucide-react';

import { TableCell } from '@/components/react-table';
import { getTaxCategoryLabel } from '../../cashflow/_utils/charity-tax';
import type { ZakatPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType } from '@prisma/client';

const beneficiaryOptions = Object.entries(BeneficiaryEnumType).map<OptionType>(
  ([k]) => ({
    id: k,
    label: k.charAt(0).toUpperCase() + k.slice(1).toLowerCase(),
  }),
);

const columnHelper = createColumnHelper<ZakatPaymentType>();

export function getTableColumns(
  individualsOptions: OptionType[],
  businessesOptions?: OptionType[],
) {
  return [
    columnHelper.accessor('datePaid', {
      size: 140,
      header: () => <span>Date Paid</span>,
      cell: TableCell,
      meta: {
        type: 'DATE',
        propName: 'datePaid',
      },
    }),
    columnHelper.accessor('amount', {
      size: 130,
      header: () => <span>Amount Paid</span>,
      cell: TableCell,
      meta: { type: 'AMOUNT', propName: 'amount', align: 'right' },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('isDeductible', {
      size: 150,
      header: () => <span>Deductible Status</span>,
      cell: ({ row }) => {
        return (
          <span className='text-sm'>
            {getTaxCategoryLabel(row.original.isDeductible)}
          </span>
        );
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('beneficiaryType', {
      size: 160,
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
      cell: ({ row }) => {
        const { original } = row;

        if (original.beneficiaryType === 'BUSINESS') {
          const selectedOption = businessesOptions?.find(
            (b) => b.id === original.beneficiaryId,
          );
          return <span>{selectedOption?.label || 'Unknown Business'}</span>;
        }

        const selectedOption = individualsOptions.find(
          (i) => i.id === original.beneficiaryId,
        );

        return <span>{selectedOption?.label || 'Unknown Individual'}</span>;
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.display({
      id: 'edit',
      header: () => <span>Actions</span>,
      cell: ({ row, table }) => {
        const hasLinkedTransaction = Boolean(row.original.transactionId);

        return (
          <div className='flex justify-center items-center gap-1'>
            <span
              title='Linked record — read only'
              className='text-gray-400 dark:text-gray-500'
            >
              <Lock size={14} />
            </span>
            {hasLinkedTransaction ? (
              <button
                type='button'
                title='Unlink transaction'
                aria-label='Unlink transaction'
                className='rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20'
                onClick={() => table.options.meta?.removeRow?.(row.index)}
              >
                <Unlink size={14} />
              </button>
            ) : null}
          </div>
        );
      },
    }),
  ];
}
