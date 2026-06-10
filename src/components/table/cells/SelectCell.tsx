import { AppSelect as Select } from '@/components/ui/AppSelect';
import type { OptionType } from '@/types';

interface SelectCellProps {
  value: string;
  options: OptionType[];
  onChange: (value: string | undefined) => void;
  isEditing: boolean;
  placeholder?: string;
}

export const SelectCell = ({
  value,
  options,
  onChange,
  isEditing,
  placeholder,
}: SelectCellProps) => {
  const selectedOption = options.find((o) => o.id === value);

  if (isEditing) {
    return (
      <Select<OptionType>
        isClearable
        value={selectedOption || null}
        options={options}
        getOptionValue={(option) => option.id}
        getOptionLabel={(option) => option.label}
        onChange={(option) => onChange(option?.id)}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition='fixed'
        placeholder={placeholder}
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

  return <span>{selectedOption?.label ?? value}</span>;
};
