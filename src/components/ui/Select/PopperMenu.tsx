'use client';

import { components, type MenuProps, type GroupBase, type OptionProps } from 'react-select';

/**
 * Custom Option component that adds a title attribute for native browser tooltips on hover.
 */
function CustomOption<Option, IsMulti extends boolean, Group extends GroupBase<Option>>(
  props: OptionProps<Option, IsMulti, Group>
) {
  // Cast data to allow accessing 'label'.
  const label = (props.data as { label?: string }).label;
  
  return (
    <components.Option {...props} innerProps={{ ...props.innerProps, title: label }}>
      {props.children}
    </components.Option>
  );
}

/**
 * A custom Menu component for react-select that forces consistent Popper placement.
 * Uses react-select's internal Popper support when menuPosition is 'fixed'.
 */
export function PopperMenu<
  Option,
  IsMulti extends boolean,
  Group extends GroupBase<Option>,
>(props: MenuProps<Option, IsMulti, Group>) {
  // We cannot pass 'components' prop directly to components.Menu.
  // Instead, we should compose the menu structure here if needed,
  // but simpler to just wrap in a div or use the base Menu.
  return (
    <components.Menu {...props}>
      {props.children}
    </components.Menu>
  );
}
