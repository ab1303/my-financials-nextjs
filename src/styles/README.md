# Theme Utilities

This directory contains centralized styling utilities that replace the previous flowbite theme configuration.

## Overview

The theme system provides consistent styling across the application with predefined utility classes organized by component type.

## Available Utilities

### Input Styles (`inputStyles`)

- `base`: Standard input field styling
- `withIcon`: Input with left icon padding
- `error`: Error state styling
- `disabled`: Disabled state styling

```tsx
import { inputStyles } from '@/styles/theme';
<input className={inputStyles.base} />;
```

### Button Styles (`buttonStyles`)

- `primary`: Primary action button
- `secondary`: Secondary action button
- `icon`: Square icon button (40x40px)
- `iconSmall`: Small icon button (32x32px)
- `iconLarge`: Large icon button (48x48px)
- `iconCompact`: Minimal padding icon button

```tsx
import { buttonStyles } from '@/styles/theme';
<button className={buttonStyles.primary}>Save</button>
<button className={clsx(buttonStyles.icon, 'bg-teal-100 text-teal-600')}>
  <IconComponent />
</button>
```

### Table Styles (`tableStyles`)

- `container`: Table container sizing (compact, medium, large, full)
- `wrapper`: Table wrapper div styling
- `table`: Table element styling

```tsx
import { tableStyles } from '@/styles/theme';
<Table className={tableStyles.container.compact}>{/* Table content */}</Table>;
```

### Layout Styles (`layoutStyles`)

- `container`: Container widths with centering
- `spacing`: Consistent spacing utilities
- `padding`: Standard padding values

```tsx
import { layoutStyles } from '@/styles/theme';
<div className={layoutStyles.container['4xl']}>
  <form className={layoutStyles.spacing.section}>{/* Form content */}</form>
</div>;
```

### Card Styles (`cardStyles`)

- `base`: Standard card styling
- `interactive`: Card with hover effects
- `elevated`: Card with enhanced shadow
- `flat`: Minimal card styling

### Modal Styles (`modalStyles`)

- `overlay`: Modal backdrop
- `container`: Modal container
- `wrapper`: Modal positioning wrapper
- `content`: Modal content area
- `contentLarge`: Large modal content

### Form Styles (`formStyles`)

- `fieldset`: Form section spacing
- `field`: Individual field spacing
- `label`: Form label styling
- `helpText`: Help text styling
- `errorText`: Error message styling

## Migration from Flowbite

When migrating from flowbite components:

1. **Replace flowbite theme imports** with our theme utilities
2. **Use clsx for conditional styling** when combining theme classes with additional styles
3. **Maintain consistent focus rings** using the teal color scheme

### Example Migration

Before (flowbite):

```tsx
<Button theme={flowbiteTheme.button} color='primary'>
  Save
</Button>
```

After (theme utilities):

```tsx
import { buttonStyles } from '@/styles/theme';
<button className={buttonStyles.primary}>Save</button>;
```

## Best Practices

1. **Import only what you need** to keep bundle size optimized
2. **Use clsx for conditional classes** when combining theme utilities with component-specific styles
3. **Maintain consistent spacing** using the layout utilities
4. **Follow the established color scheme** (teal for primary actions, gray for neutral)
5. **Use semantic class names** rather than creating new utilities for one-off styling

## Extending the Theme

To add new utilities:

1. Add the new utility object to `theme.ts`
2. Follow the existing naming convention
3. Include comprehensive variants (sm, base, lg where applicable)
4. Update this documentation
5. Consider if the utility might be used across multiple components

## Component-Specific Guidelines

- **Tables**: Use `tableStyles.container` for width control, avoid hardcoded widths
- **Buttons**: Prefer theme variants over custom styling, use `clsx` for state-specific colors
- **Forms**: Use `formStyles` for consistent spacing and `inputStyles` for all input elements
- **Modals**: Use `modalStyles` for consistent overlay and positioning behavior
