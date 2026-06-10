import { BeneficiaryEnumType } from '@prisma/client';
import { createColumnHelper } from '@tanstack/react-table';
import { Check, Lock, Trash2, Unlink, X } from 'lucide-react';

import { TableCell } from '@/components/react-table';
import type { OptionType } from '@/types';

import { getTaxCategoryLabel } from '../../cashflow/_utils/charity-tax';
import type { ZakatPaymentType } from '../_types';
import ZakatAmountCell from './cells/ZakatAmountCell';
import ZakatBeneficiaryCell from './cells/ZakatBeneficiaryCell';
import ZakatTypeCell from './cells/ZakatTypeCell';

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
      cell: ({ row, table }) => {
        // Keeping DateCell generic or using existing TableCell if DatePicker is complex
        // For now, retaining TableCell usage as it's already functional for Date
        // but importing it locally is safer.
        return <TableCell row={row} table={table} column={row.getAllCells().find(c => c.column.id === 'datePaid')!.column} getValue={() => row.original.datePaid} />;
      },
      meta: {
        type: 'DATE',
        propName: 'datePaid',
      },
    }),
    columnHelper.accessor('amount', {
      size: 130,
      header: () => <span>Amount Paid</span>,
      cell: ZakatAmountCell,
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
      cell: ({ row, table }) => (
        <ZakatTypeCell 
          row={row}
          table={table}
          options={beneficiaryOptions}
        />
      ),
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('beneficiaryId', {
      header: () => <span>Beneficiary</span>,
      cell: ({ row, table }) => {
        const meta = table.options.meta;
        const editedRecord = meta?.editedRows?.get(row.original.id);
        const isEdited = !!editedRecord;

        if (isEdited) {
          return (
            <ZakatBeneficiaryCell
              row={row}
              table={table}
              individualsOptions={individualsOptions}
              businessesOptions={businessesOptions || []}
            />
          );
        }

        const beneficiaryType = row.original.beneficiaryType;

        if (beneficiaryType === 'BUSINESS') {
          const selectedOption = businessesOptions?.find(
            (b) => b.id === row.original.beneficiaryId,
          );
          return <span>{selectedOption?.label || 'Unknown Business'}</span>;
        }

        const selectedOption = individualsOptions.find(
          (i) => i.id === row.original.beneficiaryId,
        );

        return <span>{selectedOption?.label || 'Unknown Individual'}</span>;
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.display({
      id: 'edit',
      header: () => <span>Actions</span>,
      cell: ({ row, table }) => {
        const meta = table.options.meta;
        const isEdited = meta?.editedRows?.has(row.original.id);
        const hasLinkedTransaction = Boolean(row.original.transactionId);

        if (isEdited) {
          return (
            <div className='flex justify-center items-center gap-2'>
              <button
                type='button'
                title='Save changes'
                aria-label='Save changes'
                className='rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                onClick={() => meta?.updateRow?.(row.index)}
              >
                <Check size={16} />
              </button>
              <button
                type='button'
                title='Revert changes'
                aria-label='Revert changes'
                className='rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                onClick={() => meta?.revertData?.(row.index)}
              >
                <X size={16} />
              </button>
            </div>
          );
        }

        return (
          <div className='flex justify-center items-center gap-1'>
            {hasLinkedTransaction ? (
              <>
                <span
                  title='Linked record — read only'
                  className='text-gray-400 dark:text-gray-500'
                >
                  <Lock size={14} />
                </span>
                <button
                  type='button'
                  title='Unlink transaction'
                  aria-label='Unlink transaction'
                  className='rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20'
                  onClick={() => meta?.removeRow?.(row.index)}
                >
                  <Unlink size={14} />
                </button>
              </>
            ) : (
              <button
                type='button'
                title='Delete'
                aria-label='Delete'
                className='rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20'
                onClick={() => meta?.removeRow?.(row.index)}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      },
    }),
  ];
}
