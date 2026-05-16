'use client';

import CreatableSelect, {
  type CreatableProps,
} from 'react-select/creatable';
import type { GroupBase } from 'react-select';
import { getSelectStyles } from '@/lib/select-styles';

type AppCreatableSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<CreatableProps<Option, IsMulti, Group>, 'styles'> & {
  /** Override individual style parts; merged on top of the default theme styles. */
  styles?: CreatableProps<Option, IsMulti, Group>['styles'];
};

export function AppCreatableSelect<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({ styles: styleOverrides, ...props }: AppCreatableSelectProps<Option, IsMulti, Group>) {
  const baseStyles = getSelectStyles<Option, IsMulti, Group>();

  return (
    <CreatableSelect
      styles={styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles}
      {...props}
    />
  );
}

export default AppCreatableSelect;
