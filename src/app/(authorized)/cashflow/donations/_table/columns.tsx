import { BeneficiaryEnumType, DonationPurposeEnum } from '@prisma/client';
import { createColumnHelper } from '@tanstack/react-table';
import { Lock, Unlink } from 'lucide-react';

import { TableCell } from '@/components/react-table';
import type { OptionType } from '@/types';

import { getTaxCategoryLabel } from '../../_utils/charity-tax';
import type { DonationPaymentType } from '../_types';

const beneficiaryOptions = Object.entries(
  BeneficiaryEnumType,
).flatMap<OptionType>(([k, v]) => ({ id: k, label: v }));
const donationPurposeOptions = Object.entries(DonationPurposeEnum).map(
  ([k, v]) => ({ id: v, label: k === 'VOLUNTARY' ? 'Voluntary' : k === 'INTEREST_CLEANSING' ? 'Interest Cleansing' : k })
);

const columnHelper = createColumnHelper<DonationPaymentType>();

export function getTableColumns(
  individualsOptions: OptionType[],
  businessesOptions?: OptionType[],
) {
  return [
    columnHelper.accessor('datePaid', {
      size: 150,
      header: () => <span>Date Paid</span>,
      cell: TableCell,
      meta: {
        type: 'DATE',
        propName: 'datePaid',
      },
    }),
    columnHelper.accessor('amount', {
      size: 180,
      maxSize: 200,
      header: () => <span>Amount Donated</span>,
      cell: TableCell,
      meta: { type: 'AMOUNT', propName: 'amount', align: 'right' },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('donationPurpose', {
      size: 150,
      header: () => <span>Purpose</span>,
      cell: TableCell,
      meta: {
        type: 'SELECT',
        propName: 'donationPurpose',
        selectOptions: donationPurposeOptions,
      },
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
      size: 200,
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
      id: 'actions',
      size: 100,
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
