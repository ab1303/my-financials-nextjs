````markdown
# Flowbite to Theme Utilities Mapping

This document shows the exact mapping between the original flowbite theme and our custom theme utilities.

## Original Flowbite Theme Analysis

### Footer Styles

```typescript
// Original Flowbite
footer: {
  root: { base: 'flex flex-col' },
  brand: { base: 'm-6 flex items-center' },
  groupLink: {
    base: 'flex flex-col flex-wrap text-gray-500 dark:text-white',
    link: { base: 'mb-4 last:mr-0 md:mr-6' }
  },
  icon: { base: 'text-gray-400 hover:text-gray-900 dark:hover:text-white' }
}

// Our Theme Utilities
footerStyles: {
  root: { base: 'flex flex-col' },                    // ✅ Exact match
  brand: { base: 'm-6 flex items-center' },           // ✅ Exact match
  groupLink: {
    base: 'flex flex-col flex-wrap text-gray-500',    // ✅ Match (removed dark mode)
    link: 'mb-4 last:mr-0 md:mr-6'                    // ✅ Exact match
  },
  icon: { base: 'text-gray-400 hover:text-gray-900' } // ✅ Match (removed dark mode)
}
```

### Modal Styles

```typescript
// Original Flowbite
modal: {
  body: {
    base: 'space-y-6 px-6 pb-4 sm:pb-6 lg:px-8 xl:pb-8';
  }
}

// Our Theme Utilities
enhancedModalStyles: {
  body: {
    flowbite: 'space-y-6 px-6 pb-4 sm:pb-6 lg:px-8 xl:pb-8'; // ✅ Exact match
  }
}
```

### Sidebar Styles

```typescript
// Original Flowbite
sidebar: {
  root: {
    base: 'h-full bg-gray-50',
    inner: 'h-full overflow-y-auto overflow-x-hidden bg-white py-4 px-3 dark:bg-gray-800'
  },
  collapse: { list: 'space-y-2 py-2 list-none' },
  item: {
    base: 'no-underline flex items-center rounded-lg p-2 text-lg font-normal text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
  },
  itemGroup: 'list-none border-t border-gray-200 pt-3 first:mt-0 first:border-t-0 first:pt-0 dark:border-gray-700'
}

// Our Theme Utilities
navigationStyles: {
  sidebar: {
    root: 'h-full bg-gray-50',                                        // ✅ Exact match
    inner: 'h-full overflow-y-auto overflow-x-hidden bg-white py-4 px-3', // ✅ Match (removed dark mode)
  },
  navList: {
    collapse: 'space-y-2 py-2 list-none',                            // ✅ Exact match
  },
  navItem: {
    flowbite: 'no-underline flex items-center rounded-lg p-2 text-lg font-normal text-gray-900 hover:bg-gray-100', // ✅ Match (removed dark mode)
  },
  itemGroup: 'list-none border-t border-gray-200 pt-3 first:mt-0 first:border-t-0 first:pt-0', // ✅ Match (removed dark mode)
}

listStyles: {
  base: 'space-y-2 py-2 list-none',                                  // ✅ Exact match to sidebar.collapse.list
  itemGroup: 'list-none border-t border-gray-200 pt-3 first:mt-0 first:border-t-0 first:pt-0', // ✅ Match (removed dark mode)
  item: {
    base: 'no-underline flex items-center rounded-lg p-2 text-lg font-normal text-gray-900 hover:bg-gray-100', // ✅ Match (removed dark mode)
  }
}
```

## Component Migration Status

### ✅ Fully Covered Components

1. **Footer Components** - `footerStyles` provides exact flowbite compatibility
2. **Modal Body** - `enhancedModalStyles.body.flowbite` provides exact match
3. **Sidebar/Navigation** - `navigationStyles` and `listStyles` provide full coverage

### 🔄 Components Needing Migration

#### **High Priority (Used extensively)**

1. **Card Component** (`src/components/card/Card.tsx`)
   - Current: `'bg-white shadow rounded-lg border border-gray-200 mt-6'`
   - Migration: Use `cardStyles.base`
   - Files affected: Banks form, Zakat form, Bank Interest form, Payment History Modal

2. **Button Component** (`src/components/buttons/Button.tsx`)
   - Current: Custom variant system with hardcoded classes
   - Migration: Use `buttonStyles` utilities
   - Files affected: Multiple forms and components

3. **SideNav Component** (`src/layouts/SideNav.tsx`)
   - Current: Custom classes
   - Migration: Use `navigationStyles.sidebar.flowbite` and `navigationStyles.navItem.flowbite`
   - Impact: Core navigation functionality

#### **Medium Priority**

4. **Modal Component** (`src/components/ui/Modal.tsx`)
   - Current: HeadlessUI with custom styling
   - Migration: Apply `enhancedModalStyles.body.flowbite`
   - Files affected: Payment History Modal and any future modals

5. **SideNavLink Component** (`src/layouts/SideNavLink.tsx`)
   - Current: Custom navigation link styling
   - Migration: Use `navigationStyles.navItem.flowbite`
   - Impact: Individual navigation items

#### **Low Priority**

6. **Auth Forms** (`src/app/auth/*/form.tsx`)
   - Current: Hardcoded Tailwind classes
   - Migration: Use theme utilities for consistency
   - Impact: Login/Register user experience

## Migration Strategy

### Phase 1: Core Components (Immediate)

- Migrate Card component to use `cardStyles`
- Migrate Button component to use `buttonStyles`
- Update SideNav to use `navigationStyles.sidebar.flowbite`

### Phase 2: Navigation (Next)

- Update SideNavLink to use `navigationStyles.navItem.flowbite`
- Apply `listStyles` to any list-based navigation

### Phase 3: Forms and Modals (Final)

- Update Modal component to use `enhancedModalStyles.body.flowbite`
- Migrate auth forms to use theme utilities
- Apply consistent styling across all forms

## Usage Examples

### Footer (if used in future)

```tsx
import { footerStyles } from '@/styles/theme';

<footer className={footerStyles.root.base}>
  <div className={footerStyles.brand.base}>Brand</div>
  <div className={footerStyles.groupLink.base}>
    <a className={footerStyles.groupLink.link}>Link</a>
  </div>
</footer>;
```

### Sidebar/Navigation

```tsx
import { navigationStyles, listStyles } from '@/styles/theme';

<div className={navigationStyles.sidebar.root}>
  <div className={navigationStyles.sidebar.inner}>
    <ul className={listStyles.base}>
      <li className={listStyles.item.base}>Nav Item</li>
      <li className={listStyles.itemGroup}>Group Separator</li>
    </ul>
  </div>
</div>;
```

### Modal Body

```tsx
import { enhancedModalStyles } from '@/styles/theme';

<Modal.Body className={enhancedModalStyles.body.flowbite}>
  Modal content with exact flowbite spacing
</Modal.Body>;
```

## Notes

- Dark mode styles were intentionally removed as the application doesn't currently use dark mode
- All flowbite styles have been preserved with exact class matching where applicable
- The theme utilities provide both flowbite-compatible styles and enhanced variants for flexibility
````
