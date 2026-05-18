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
      // menuPosition:'fixed' escapes overflow-y:auto clipping without needing
      // a React portal. Works because dialog.tsx uses transform-free centering
      // (inset-0 + margin:auto), so position:fixed is relative to the viewport.
      menuPosition='fixed'
      styles={{
        ...(styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles),
        menuPortal: (base) => ({ ...base, zIndex: 9999 }),
      }}
      {...props}
    />
  );
}

export default AppCreatableSelect;
