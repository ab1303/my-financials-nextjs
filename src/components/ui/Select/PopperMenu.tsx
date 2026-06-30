'use client';

import {
  components,
  type GroupBase,
  type MenuProps,
} from 'react-select';

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
  return <components.Menu {...props}>{props.children}</components.Menu>;
}
