import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { DonationPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType } from '@prisma/client';
import { castDraft, produce } from 'immer';
import BeneficiarySelectionCell from './BeneficiarySelectionCell';

const beneficiaryOptions = Object.entries(
  BeneficiaryEnumType,
).flatMap<OptionType>(([k, v]) => ({ id: k, label: v }));

const taxCategoryOptions: OptionType[] = [
  { id: 'RELIGIOUS', label: 'Religious Organizations' },
  { id: 'EDUCATIONAL', label: 'Educational Institutions' },
  { id: 'HEALTHCARE', label: 'Healthcare/Medical' },
  { id: 'ENVIRONMENTAL', label: 'Environmental Causes' },
  { id: 'SOCIAL', label: 'Social Services' },
  { id: 'ARTS', label: 'Arts & Culture' },
  { id: 'OTHER', label: 'Other/General Charity' },
];

const columnHelper = createColumnHelper<DonationPaymentType>();

export function getTableColumns(individualsOptions: OptionType[]) {
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
      meta: { type: 'AMOUNT', propName: 'amount' },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('taxCategory', {
      size: 160,
      header: () => <span>Tax Category</span>,
      cell: TableCell,
      meta: {
        type: 'SELECT',
        propName: 'taxCategory',
        selectOptions: taxCategoryOptions,
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
      cell: ({ row, table }) => {
        const { original } = row;
        const tableMeta = table.options.meta;

        const updateRecord = (
          editedRecord: DonationPaymentType,
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
          // case business - we need to fetch the business name to display
          if (original.beneficiaryType == 'BUSINESS') {
            return <span>Loading...</span>; // TODO: We need business data to display name instead of ID
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
            onSelectionChange={(beneficiaryId?: string) => {
              updateRecord(editedRecord, beneficiaryId || '');
              return;
            }}
          />
        );
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
