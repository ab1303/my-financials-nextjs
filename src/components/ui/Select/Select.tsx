'use client';

import Select, { type GroupBase, type Props as SelectProps } from 'react-select';

import { getCompactSelectStyles, getSelectStyles } from '@/lib/select-styles';

type AppSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<SelectProps<Option, IsMulti, Group>, 'styles'> & {
  compact?: boolean;
  styles?: SelectProps<Option, IsMulti, Group>['styles'];
  usePortal?: boolean;
};

export function SelectWrapper<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({ compact = false, styles: styleOverrides, usePortal = false, ...props }: AppSelectProps<Option, IsMulti, Group>) {
  const baseStyles = compact
    ? getCompactSelectStyles<Option, IsMulti, Group>()
    : getSelectStyles<Option, IsMulti, Group>();

  return (
    <Select
      menuPosition={usePortal ? undefined : 'fixed'}
      menuPortalTarget={usePortal && typeof document !== 'undefined' ? document.body : undefined}
      styles={styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles}
      {...props}
    />
  );
}
