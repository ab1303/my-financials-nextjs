'use client';

import type { GroupBase } from 'react-select';
import CreatableSelect, { type CreatableProps } from 'react-select/creatable';

import { getCompactSelectStyles, getSelectStyles } from '@/lib/select-styles';

type CreatableAppSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<CreatableProps<Option, IsMulti, Group>, 'styles'> & {
  compact?: boolean;
  styles?: CreatableProps<Option, IsMulti, Group>['styles'];
};

export function CreatableSelectWrapper<
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
