import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { ZakatPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType } from '@prisma/client';
import BeneficiarySelectionCell from './BeneficiarySelectionCell';
import { castDraft, produce } from 'immer';

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
      cell: ({ row, table }) => {
        const { original } = row;
        const tableMeta = table.options.meta;

        const updateRecord = (
          editedRecord: ZakatPaymentType,
          beneficiaryId: string,
        ) => {
          const updatedRecord = {
            ...editedRecord,
            beneficiaryId,
          };

          tableMeta?.setEditedRows(
            produce((draft) => {
              draft.set(row.index, castDraft(updatedRecord));
            }),
          );
        };

        const editedRecord = tableMeta?.editedRows.get(row.index);

        // Display
        if (!editedRecord) {
          // Display business or individual name based on beneficiary type
          if (original.beneficiaryType == 'BUSINESS') {
            const selectedOption = businessesOptions?.find(
              (b) => b.id === original.beneficiaryId,
            );
            return <span>{selectedOption?.label || 'Unknown Business'}</span>;
          }

          const selectedOption = individualsOptions.find(
            (i) => i.id === original.beneficiaryId,
          );

          return <span>{selectedOption?.label}</span>;
        }

        // Edit mode - always show the BeneficiarySelectionCell for both INDIVIDUAL and BUSINESS
        return (
          <BeneficiarySelectionCell
            defaultIndividualOptions={individualsOptions}
            beneficiaryId={editedRecord.beneficiaryId}
            beneficiaryType={editedRecord.beneficiaryType}
            onSelectionChange={(beneficiaryId) => {
              updateRecord(editedRecord, beneficiaryId || '');
              return;
            }}
          />
        );
      },
      footer: (props) => props.column.id,
    }),
    columnHelper.display({
      id: 'edit',
      header: () => <span>Actions</span>,
      cell: ({ row, table }) => <EditCell row={row} table={table} />,
    }),
  ];
}
