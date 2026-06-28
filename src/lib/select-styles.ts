/**
 * Shared react-select styles that use CSS variables for theme consistency.
 * Supports dark mode and palette swaps automatically.
 */
import type { GroupBase, StylesConfig } from 'react-select';

export function getSelectStyles<
  T = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<T> = GroupBase<T>,
>(): StylesConfig<T, IsMulti, Group> {
  return {
    control: (base, state) => ({
      ...base,
      backgroundColor: state.isDisabled
        ? 'hsl(var(--background) / 0.5)'
        : 'hsl(var(--background))',
      borderColor: state.isFocused
        ? 'hsl(var(--ring))'
        : state.isDisabled
          ? 'hsl(var(--border) / 0.5)'
          : 'hsl(var(--input))',
      borderRadius: 'calc(var(--radius) - 2px)',
      boxShadow: state.isFocused
        ? '0 0 0 1px hsl(var(--ring))'
        : base.boxShadow,
      '&:hover': {
        borderColor: state.isDisabled ? undefined : 'hsl(var(--ring))',
      },
      minHeight: '36px',
      opacity: state.isDisabled ? 0.6 : 1,
      cursor: state.isDisabled ? 'default' : 'default',
    }),
    menu: (base, state) => ({
      ...base,
      backgroundColor: 'hsl(var(--popover))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'var(--radius)',
      boxShadow:
        '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      zIndex: 9999,
      // Allow callers to pass a menuWidth prop (number) to match the control width
      boxSizing: 'border-box',
      minWidth: (() => {
        const mw = (state?.selectProps as any)?.menuWidth as number | undefined;
        const MIN = 400; // use 400px min-width per common UI guidelines for dropdowns
        if (mw && !Number.isNaN(mw)) return `${Math.max(mw, MIN)}px`;
        return `${MIN}px`;
      })(),
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px',
      maxHeight: '280px',
      overflowY: 'auto',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'hsl(var(--primary) / 0.12)'
        : state.isFocused
          ? 'hsl(var(--accent) / 0.75)'
          : 'transparent',
      color: state.isSelected
        ? 'hsl(var(--foreground))'
        : 'hsl(var(--muted-foreground))',
      borderRadius: 'calc(var(--radius) - 4px)',
      cursor: 'pointer',
      fontWeight: state.isSelected ? 600 : 400,
      opacity: state.isSelected ? 1 : 0.88,
      '&:active': { backgroundColor: 'hsl(var(--primary) / 0.2)' },
    }),
    singleValue: (base, state) => ({
      ...base,
      color: 'hsl(var(--foreground))',
      opacity: state.isDisabled ? 0.6 : 1,
    }),
    input: (base) => ({
      ...base,
      color: 'hsl(var(--foreground))',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--border))',
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      '&:hover': { color: 'hsl(var(--foreground))' },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      '&:hover': { color: 'hsl(var(--destructive))' },
    }),
    multiValue: (base) => ({
      ...base,
      backgroundColor: 'hsl(var(--accent))',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: 'hsl(var(--accent-foreground))',
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      '&:hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'hsl(var(--destructive-foreground))',
      },
    }),
  };
}

/**
 * Compact variant for table cells — same CSS-variable colours as getSelectStyles()
 * but with reduced height and font size for inline editing.
 */
export function getCompactSelectStyles<
  T = unknown,
  IsMulti extends boolean = false,
  Group extends GroupBase<T> = GroupBase<T>,
>(): StylesConfig<T, IsMulti, Group> {
  const base = getSelectStyles<T, IsMulti, Group>();
  return {
    ...base,
    control: (provided, state) => ({
      ...(base.control?.(provided, state) ?? provided),
      minHeight: '32px',
      fontSize: '0.875rem',
    }),
    valueContainer: (provided, state) => ({
      ...(base.valueContainer?.(provided, state) ?? provided),
      padding: '0.25rem 0.5rem',
    }),
    input: (provided, state) => ({
      ...(base.input?.(provided, state) ?? provided),
      margin: 0,
      padding: 0,
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    indicatorsContainer: (provided, state) => ({
      ...(base.indicatorsContainer?.(provided, state) ?? provided),
      height: 'auto',
    }),
  };
}
