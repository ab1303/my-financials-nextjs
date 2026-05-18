'use client';

import Select, { type Props as SelectProps, type GroupBase } from 'react-select';
import { getSelectStyles, getCompactSelectStyles } from '@/lib/select-styles';

type AppSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<SelectProps<Option, IsMulti, Group>, 'styles'> & {
  /** Use compact sizing (reduced height) for table cells and inline editors. */
  compact?: boolean;
  /** Override individual style parts; merged on top of the default theme styles. */
  styles?: SelectProps<Option, IsMulti, Group>['styles'];
};

export function AppSelect<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({ compact = false, styles: styleOverrides, ...props }: AppSelectProps<Option, IsMulti, Group>) {
  const baseStyles = compact
    ? getCompactSelectStyles<Option, IsMulti, Group>()
    : getSelectStyles<Option, IsMulti, Group>();

  return (
    <Select
      // menuPosition:'fixed' escapes overflow-y:auto clipping without needing
      // a React portal. Works because dialog.tsx uses transform-free centering
      // (inset-0 + margin:auto), so position:fixed is relative to the viewport.
      menuPosition='fixed'
      styles={styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles}
      {...props}
    />
  );
}

export default AppSelect;
