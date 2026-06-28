'use client';

import type { GroupBase, MultiValue } from 'react-select';

import { Label } from '@/components/ui/Label';
import { SelectWrapper as Select } from '@/components/ui/Select';
import type { OptionType } from '@/types';

type Props = {
  label: string;
  instanceId: string;
  options: GroupBase<OptionType>[];
  value: OptionType[];
  onChange: (values: MultiValue<OptionType>) => void;
  placeholder: string;
  hideSelectedValues?: boolean;
  hideLabel?: boolean;
  searchable?: boolean;
};

export function GroupedCategorySelect({
  label,
  instanceId,
  options,
  value,
  onChange,
  placeholder,
  hideSelectedValues = false,
  hideLabel = false,
  searchable = true,
}: Props) {
  return (
    <div className='space-y-1.5'>
      {!hideLabel && <Label htmlFor={instanceId}>{label}</Label>}
      <Select<OptionType, true, GroupBase<OptionType>>
        instanceId={instanceId}
        inputId={instanceId}
        options={options}
        value={value}
        onChange={onChange}
        isMulti
        isClearable
        closeMenuOnSelect={false}
        hideSelectedOptions={false}
        isSearchable={searchable}
        placeholder={placeholder}
        aria-label={label}
        controlShouldRenderValue={!hideSelectedValues}
        className='w-full'
        getOptionValue={(opt) => opt.id}
        getOptionLabel={(opt) => opt.label}
        formatGroupLabel={(group) => (
          <div className='py-2 text-sm font-semibold text-foreground'>
            {group.label}
          </div>
        )}
      />
    </div>
  );
}
