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

Use `unstyled` together with the `classNames` prop. Define it as a **`const`** (not a function)
so the same object can be shared across multiple `<Select>` instances in the same file.
See `.ai/instructions/dark-mode-and-react-select.md` for the canonical pattern.

### ❌ Never do this

```tsx
// Missing unstyled — default inline styles override dark mode
<Select classNamePrefix="rs" ... />

// Missing dark: variants — broken in dark mode
<Select unstyled classNames={{ control: () => 'bg-white border' }} ... />
```
