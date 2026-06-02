import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { DonationPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType, DonationPurposeEnum } from '@prisma/client';
import { castDraft, produce } from 'immer';
import BeneficiarySelectionCell from './BeneficiarySelectionCell';

const beneficiaryOptions = Object.entries(
  BeneficiaryEnumType,
).flatMap<OptionType>(([k, v]) => ({ id: k, label: v }));

// Tax category display options (read-only, derived from beneficiary DGR status)
const taxCategoryDisplayMap: Record<string, string> = {
  'DEDUCTIBLE': 'Deductible (DGR)',
  'NON_DEDUCTIBLE': 'Non-Deductible',
};

// Donation purpose options (user-editable)
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
      meta: { type: 'AMOUNT', propName: 'amount' },
      footer: (props) => props.column.id,
    }),
    columnHelper.accessor('donationPurpose', {
      size: 150,
      header: () => <span>Purpose</span>,
      cell: ({ row, table }) => {
        const tableMeta = table.options.meta;
        const editedRecord = tableMeta?.editedRows.get(row.index);
        const purpose = editedRecord?.donationPurpose || row.original.donationPurpose || 'VOLUNTARY';
        
        if (editedRecord) {
          return (
            <TableCell
              cell={row.getContext()}
              colType="SELECT"
              selectOptions={donationPurposeOptions}
            />
          );
        }

        const purposeLabel = {
          'VOLUNTARY': 'Voluntary',
          'INTEREST_CLEANSING': 'Interest Cleansing',
          'ZAKAT': 'Zakat',
        }[purpose] || purpose;

        return <span>{purposeLabel}</span>;
      },
      meta: {
        type: 'SELECT',
        propName: 'donationPurpose',
        selectOptions: donationPurposeOptions,
      },
    }),
    columnHelper.accessor('taxCategory', {
      size: 150,
      header: () => <span>Deductible Status</span>,
      // Tax category is read-only (derived from beneficiary DGR status)
      cell: ({ row }) => {
        const taxStatus = row.original.taxCategory || 'NON_DEDUCTIBLE';
        const label = taxCategoryDisplayMap[taxStatus] || taxStatus;
        return <span className="text-sm">{label}</span>;
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
