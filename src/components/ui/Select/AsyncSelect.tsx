'use client';

import AsyncSelect, { type AsyncProps } from 'react-select/async';
import { type GroupBase } from 'react-select';

import { getCompactSelectStyles, getSelectStyles } from '@/lib/select-styles';

type AsyncAppSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<AsyncProps<Option, IsMulti, Group>, 'styles'> & {
  compact?: boolean;
  styles?: AsyncProps<Option, IsMulti, Group>['styles'];
  usePortal?: boolean;
  /** Optional width (px) to apply to portaled menu so it matches the control */
  menuWidth?: number;
};

export function AsyncSelectWrapper<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({
  compact = false,
  styles: styleOverrides,
  usePortal = false,
  ...props
}: AsyncAppSelectProps<Option, IsMulti, Group>) {
  const baseStyles = compact
    ? getCompactSelectStyles<Option, IsMulti, Group>()
    : getSelectStyles<Option, IsMulti, Group>();

  const portalTarget =
    typeof document !== 'undefined' ? document.body : undefined;

  return (
    <AsyncSelect
      menuPosition={usePortal ? 'fixed' : undefined}
      menuPortalTarget={usePortal ? portalTarget : undefined}
      styles={
        styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles
      }
      {...props}
    />
  );
}
