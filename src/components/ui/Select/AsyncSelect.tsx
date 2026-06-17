'use client';

import AsyncSelect, { type AsyncProps } from 'react-select/async';
import { type GroupBase } from 'react-select';

import { getCompactSelectStyles, getSelectStyles } from '@/lib/select-styles';
import { PopperMenu } from './PopperMenu';
import { components as selectComponents } from 'react-select';

/**
 * Custom Option component that adds a title attribute for native browser tooltips on hover.
 */
function CustomOption(props: any) {
  const label = (props.data as { label?: string }).label;
  return (
    <selectComponents.Option {...props} innerProps={{ ...props.innerProps, title: label }}>
      {props.children}
    </selectComponents.Option>
  );
}

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
  components: componentOverrides,
  ...props
}: AsyncAppSelectProps<Option, IsMulti, Group>) {
  const baseStyles = compact
    ? getCompactSelectStyles<Option, IsMulti, Group>()
    : getSelectStyles<Option, IsMulti, Group>();

  const portalTarget =
    typeof document !== 'undefined' ? document.body : undefined;

  const components = usePortal
    ? { Menu: PopperMenu, Option: CustomOption, ...componentOverrides }
    : componentOverrides;

  return (
    <AsyncSelect
      menuPosition={usePortal ? 'fixed' : undefined}
      menuPortalTarget={usePortal ? portalTarget : undefined}
      menuPlacement="auto"
      styles={
        styleOverrides ? { ...baseStyles, ...styleOverrides } : baseStyles
      }
      components={components}
      {...props}
    />
  );
}
