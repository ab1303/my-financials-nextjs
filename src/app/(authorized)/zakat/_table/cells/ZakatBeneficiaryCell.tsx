import type { CellContext } from '@tanstack/react-table';

import { SelectWrapper as Select } from '@/components/ui/Select';
import type { OptionType } from '@/types';

import type { ZakatPaymentType } from '../../_types';

type ZakatBeneficiaryCellProps = {
  row: CellContext<ZakatPaymentType, unknown>['row'];
  table: CellContext<ZakatPaymentType, unknown>['table'];
  individualsOptions: OptionType[];
  businessesOptions: OptionType[];
};

export default function ZakatBeneficiaryCell({
  row,
  table,
  individualsOptions,
  businessesOptions,
}: ZakatBeneficiaryCellProps) {
  const meta = table.options.meta;
  const editedRecord = meta?.editedRows?.get(row.original.id);

  // Use edited record if available, otherwise fallback to original
  const beneficiaryType = editedRecord
    ? editedRecord.beneficiaryType
    : row.original.beneficiaryType;

  const beneficiaryId = editedRecord
    ? editedRecord.beneficiaryId
    : row.original.beneficiaryId;

  const options =
    beneficiaryType === 'BUSINESS' ? businessesOptions : individualsOptions;

  const selectedOption = options.find((o) => o.id === beneficiaryId);

  return (
    <Select<OptionType>
      isClearable
      value={selectedOption || null}
      options={options}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.label}
      onChange={(option) => {
        if (editedRecord) {
          meta?.setEditedRows((prev) => {
            const next = new Map(prev);
            next.set(row.original.id, {
              ...editedRecord,
              beneficiaryId: option?.id || '',
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
