'use client';

import CreatableSelect, { type CreatableProps } from 'react-select/creatable';
import { getSelectStyles, getCompactSelectStyles } from '@/lib/select-styles';
import type { GroupBase } from 'react-select';

type CreatableAppSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<CreatableProps<Option, IsMulti, Group>, 'styles'> & {
  compact?: boolean;
  styles?: CreatableProps<Option, IsMulti, Group>['styles'];
};

export function CreatableAppSelect<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({ compact = false, styles: styleOverrides, ...props }: CreatableAppSelectProps<Option, IsMulti, Group>) {
  const baseStyles = compact
    ? getCompactSelectStyles<Option, IsMulti, Group>()
    : getSelectStyles<Option, IsMulti, Group>();

  return (
    <CreatableSelect
      menuPosition='fixed'
      styles={styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles}
      {...props}
    />
  );
}

export default CreatableAppSelect;
