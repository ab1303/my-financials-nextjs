import type { BeneficiaryEnumType } from '@prisma/client';
import type { CellContext } from '@tanstack/react-table';

import { SelectCell } from '@/components/table/cells/SelectCell';
import type { OptionType } from '@/types';

import type { ZakatPaymentType } from '../../_types';

type ZakatTypeCellProps = {
  row: CellContext<ZakatPaymentType, unknown>['row'];
  table: CellContext<ZakatPaymentType, unknown>['table'];
  options: OptionType[];
};

export default function ZakatTypeCell({
  row,
  table,
  options,
}: ZakatTypeCellProps) {
  const meta = table.options.meta;
  const editedRecord = meta?.editedRows?.get(row.original.id);
  const isEditing = !!editedRecord;
  const value = editedRecord
    ? editedRecord.beneficiaryType
    : row.original.beneficiaryType;

  return (
    <SelectCell
      value={value}
      options={options}
      isEditing={isEditing}
      placeholder='Select beneficiary type...'
      onChange={(newValue) => {
        if (editedRecord && newValue) {
          meta?.setEditedRows((prev) => {
            const next = new Map(prev);
            next.set(row.original.id, {
              ...editedRecord,
              beneficiaryType: newValue as BeneficiaryEnumType,
              beneficiaryId: '', // Reset beneficiary on type change
            });
            return next;
          });
        }
      }}
    />
  );
}
