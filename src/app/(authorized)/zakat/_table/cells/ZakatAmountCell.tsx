import type { CellContext } from '@tanstack/react-table';

import { AmountCell } from '@/components/table/cells/AmountCell';

import type { ZakatPaymentType } from '../../_types';

type ZakatAmountCellProps = {
  row: CellContext<ZakatPaymentType, unknown>['row'];
  table: CellContext<ZakatPaymentType, unknown>['table'];
};

export default function ZakatAmountCell({ row, table }: ZakatAmountCellProps) {
  const meta = table.options.meta;
  const editedRecord = meta?.editedRows?.get(row.original.id);
  const isEditing = !!editedRecord;
  const value = editedRecord ? editedRecord.amount : row.original.amount;

  return (
    <AmountCell
      value={value}
      isEditing={isEditing}
      onChange={(newValue) => {
        if (editedRecord) {
          meta?.setEditedRows((prev) => {
            const next = new Map(prev);
            next.set(row.original.id, {
              ...editedRecord,
              amount: newValue,
            });
            return next;
          });
        }
      }}
    />
  );
}
