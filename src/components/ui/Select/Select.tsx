'use client';

import Select, {
  type GroupBase,
  type Props as SelectProps,
  type OptionProps,
  components as selectComponents,
} from 'react-select';

import { getCompactSelectStyles, getSelectStyles } from '@/lib/select-styles';
import { PopperMenu } from './PopperMenu';

function CustomOption<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
  props: OptionProps<Option, IsMulti, Group>,
) {
  const label = (props.data as { label?: string }).label;
  return (
    <selectComponents.Option {...props} innerProps={{ ...props.innerProps, title: label }}>
      <div
        className={`flex w-full items-center gap-2 ${
          props.isSelected ? 'text-foreground' : 'text-muted-foreground'
        }`}
      >
        {props.selectProps.isMulti && (
          <span
            aria-hidden='true'
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              props.isSelected
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-background/60 text-muted-foreground'
            }`}
          >
            {props.isSelected && <span className='text-[10px] leading-none'>✓</span>}
          </span>
        )}
        <span className='min-w-0 flex-1 truncate'>{props.children}</span>
      </div>
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

  const components = {
    Option: CustomOption,
    ...(usePortal ? { Menu: PopperMenu } : {}),
    ...componentOverrides,
  };

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
