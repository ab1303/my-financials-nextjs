import type { CellContext } from '@tanstack/react-table';
import { NumericFormat } from 'react-number-format';
import { tableCellStyles } from '@/styles/theme';
import type { ZakatPaymentType } from '../../_types';

type ZakatAmountCellProps = {
  row: CellContext<ZakatPaymentType, unknown>['row'];
  table: CellContext<ZakatPaymentType, unknown>['table'];
};

export default function ZakatAmountCell({ row, table }: ZakatAmountCellProps) {
  const meta = table.options.meta;
  const editedRecord = meta?.editedRows?.get(row.original.id);
  const initialValue = row.original.amount;
  const value = editedRecord ? editedRecord.amount : initialValue;

  if (editedRecord) {
    return (
      <NumericFormat
        className={tableCellStyles.input.amount}
        prefix='$'
        displayType='input'
        thousandSeparator
        value={value}
        onValueChange={(values) => {
          meta?.setEditedRows((prev) => {
            const next = new Map(prev);
            next.set(row.original.id, {
              ...editedRecord,
              amount: values.floatValue || 0,
            });
            return next;
          });
        }}
      />
    );
  }

  return (
    <div className='text-right'>
      {new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
      }).format(value)}
    </div>
  );
}
