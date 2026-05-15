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

## react-select Dark Mode — ALWAYS use `AppSelect`

`react-select` does **not** automatically respect Tailwind dark mode. Its default styles
inject inline CSS that always renders a white background.

**The project provides `src/components/ui/AppSelect.tsx`** — use it for all selects.
It automatically applies dark-mode-compatible styles via CSS variables. Never import
`Select` from `react-select` directly.

### Standard select

```tsx
import { AppSelect } from '@/components/ui/AppSelect';

<AppSelect<OptionType>
  options={options}
  value={selected}
  onChange={setSelected}
  placeholder="Choose..."
/>
```

### Compact select (for table cells / inline editors)

```tsx
<AppSelect<OptionType> compact options={options} value={value} onChange={onChange} />
```

### Overriding specific style keys

The `styles` prop is merged on top of the defaults:

```tsx
<AppSelect
  styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
  menuPortalTarget={document.body}
  ...
/>
```

### ❌ Never do this

```tsx
// Direct react-select import — white background in dark mode
import Select from 'react-select';
<Select ... />

// Using unstyled + classNames pattern (superseded by AppSelect)
<Select unstyled classNames={selectClassNames} ... />

// Calling getSelectStyles() manually (superseded by AppSelect)
import { getSelectStyles } from '@/lib/select-styles';
<Select styles={getSelectStyles()} ... />
```

### How it works

`AppSelect` wraps react-select and passes `styles={getSelectStyles()}` automatically.
`getSelectStyles()` (in `src/lib/select-styles.ts`) uses CSS custom properties
(`hsl(var(--background))`, `hsl(var(--foreground))`, etc.) that automatically reflect
the current theme — no `dark:` conditionals needed in the component code.

