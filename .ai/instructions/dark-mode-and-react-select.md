# Dark Mode & react-select Styling

## Tailwind Dark Mode — General Rules

Always include `dark:` variants for every color utility. The project uses Tailwind's `class` strategy:

| Element | Light | Dark |
|---|---|---|
| Page background | `bg-white` / `bg-gray-50` | `dark:bg-gray-900` / `dark:bg-gray-950` |
| Card/panel | `bg-white` | `dark:bg-gray-900` |
| Input background | `bg-white` | `dark:bg-gray-950` |
| Input border | `border-gray-300` | `dark:border-gray-700` |
| Body text | `text-gray-900` | `dark:text-gray-100` |
| Muted text | `text-gray-500` | `dark:text-gray-400` |
| Dividers | `border-gray-200` | `dark:border-gray-800` |
| Disabled input bg | `bg-gray-100` | `dark:bg-gray-800` |

Never leave a color class without its dark variant on interactive or surfaced elements.

---

## react-select Dark Mode — ALWAYS use `unstyled` + `classNames`

`react-select` does **not** automatically respect Tailwind dark mode. Its default styles
inject inline CSS that always renders a white background. **Never** use the default styling
or `classNamePrefix` alone — they will break dark mode.

### Required pattern

Define `classNames` as a **`const`** (not a function) — the callbacks only use boolean flags
(`isFocused`, `isDisabled`, `isSelected`) and never access option data, so no generic is needed:

```tsx
import Select, { type ClassNamesConfig } from 'react-select';
import clsx from 'clsx';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectClassNames: ClassNamesConfig<any, false> = {
  control: ({ isFocused, isDisabled }) =>
    clsx(
      'rounded-md border text-sm min-h-[38px] transition-colors',
      isDisabled
        ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60'
        : 'bg-white dark:bg-gray-950',
      isFocused
        ? 'border-teal-500 ring-1 ring-teal-500'
        : 'border-gray-300 dark:border-gray-700',
    ),
  valueContainer: () => 'px-3 py-1 gap-1',
  input: () => 'text-gray-900 dark:text-gray-100',
  singleValue: () => 'text-gray-900 dark:text-gray-100',
  placeholder: () => 'text-gray-400 dark:text-gray-500',
  indicatorSeparator: () => 'bg-gray-300 dark:bg-gray-600',
  dropdownIndicator: () => 'text-gray-400 dark:text-gray-500 px-2',
  menu: () =>
    'mt-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-50',
  option: ({ isFocused, isSelected }) =>
    clsx(
      'px-3 py-2 text-sm cursor-pointer',
      isSelected
        ? 'bg-teal-500 text-white'
        : isFocused
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          : 'text-gray-700 dark:text-gray-200',
    ),
  noOptionsMessage: () => 'px-3 py-2 text-sm text-gray-500 dark:text-gray-400',
};

// Usage — always include `unstyled`, pass const directly (no call):
<Select unstyled classNames={selectClassNames} ... />
```

Adjust the focus ring colour to match the feature context (e.g. `amber-500` for donations,
`teal-500` for general forms) but always keep the `dark:` variants.

### ❌ Never do this

```tsx
// Missing unstyled — default inline styles override dark mode
<Select classNamePrefix="rs" ... />

// Generic function — causes TypeScript to infer option type as {} and break onChange types
function selectClassNames<T>(): ClassNamesConfig<T, false> { ... }
<Select classNames={selectClassNames()} ... />

// Missing dark: variants — broken in dark mode
<Select unstyled classNames={{ control: () => 'bg-white border' }} ... />
```
