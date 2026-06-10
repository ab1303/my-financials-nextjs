import type { BeneficiaryEnumType } from '@prisma/client';
import type { CellContext } from '@tanstack/react-table';

import { AppSelect as Select } from '@/components/ui/AppSelect';
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
  const value = editedRecord ? editedRecord.beneficiaryType : row.original.beneficiaryType;

  const selectedOptionValue = options.find((o) => o.id === value);

  return (
    <Select<OptionType>
      value={selectedOptionValue || null}
      options={options}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
      onChange={(option) => {
        if (editedRecord && option) {
          meta?.setEditedRows((prev) => {
            const next = new Map(prev);
            next.set(row.original.id, {
              ...editedRecord,
              beneficiaryType: option.id as BeneficiaryEnumType,
              beneficiaryId: '', // Reset beneficiary on type change
            });
            return next;
          });
        }
      }}
      menuPortalTarget={document.body}
      menuPosition='fixed'
      compact
      styles={{
        menuPortal: (provided) => ({
          ...provided,
          zIndex: 9999,
        }),
      }}
    />
  );
}
