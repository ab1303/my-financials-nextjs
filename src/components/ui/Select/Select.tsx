'use client';

import Select, {
  type GroupBase,
  type Props as SelectProps,
} from 'react-select';

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

type AppSelectProps<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> = Omit<SelectProps<Option, IsMulti, Group>, 'styles'> & {
  compact?: boolean;
  styles?: SelectProps<Option, IsMulti, Group>['styles'];
  usePortal?: boolean;
  /** Optional width (px) to apply to portaled menu so it matches the control */
  menuWidth?: number;
};

export function SelectWrapper<
  Option = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>({
  compact = false,
  styles: styleOverrides,
  usePortal = false,
  components: componentOverrides,
  ...props
}: AppSelectProps<Option, IsMulti, Group>) {
  const baseStyles = compact
    ? getCompactSelectStyles<Option, IsMulti, Group>()
    : getSelectStyles<Option, IsMulti, Group>();

  const portalTarget =
    typeof document !== 'undefined' ? document.body : undefined;

  const components = usePortal
    ? { Menu: PopperMenu, Option: CustomOption, ...componentOverrides }
    : componentOverrides;

  return (
    <Select
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
