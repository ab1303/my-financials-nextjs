import { createColumnHelper } from '@tanstack/react-table';

import { TableCell, EditCell } from '@/components/react-table';
import type { ZakatPaymentType } from '../_types';
import type { OptionType } from '@/types';
import { BeneficiaryEnumType } from '@prisma/client';
import BeneficiarySelectionCell from './BeneficiarySelectionCell';
import { castDraft, produce } from 'immer';

const beneficiaryOptions = Object.entries(BeneficiaryEnumType).flatMap<
  OptionType
>(([k, v]) => ({ id: k, label: v }));

const columnHelper = createColumnHelper<ZakatPaymentType>();

export function getTableColumns(individualsOptions: OptionType[]) {
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
      cell: ({ row, table }) => {
        const { original } = row;
        const tableMeta = table.options.meta;

        const updateRecord = (
          editedRecord: ZakatPaymentType,
          beneficiaryId: string
        ) => {
          const updatedRecord = {
            ...editedRecord,
            beneficiaryId,
          };

          tableMeta?.setEditedRows(
            produce((draft) => {
              draft.set(row.id, castDraft(updatedRecord));
            })
          );
        };

        const editedRecord = tableMeta?.editedRows.get(row.id);

        if (!editedRecord) return <span>{original.beneficiaryId}</span>;

        if (editedRecord.beneficiaryType == 'BUSINESS') {
          return <span>Create type {editedRecord.beneficiaryType}</span>;
        }

        return (
          <BeneficiarySelectionCell
            defaultOptions={individualsOptions}
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
      cell: ({ row, table }) => <EditCell row={row} table={table} />,
    }),
  ];
}
