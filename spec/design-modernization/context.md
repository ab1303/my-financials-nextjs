# Design Modernization — Context & File Inventory

## Current Project State (as of implementation audit)

### Key Implementation Files

#### Styling & Configuration
- **`src/styles/globals.css`**: Dark mode CSS variables implemented ✅
  - `:root` (light) and `.dark` (dark) CSS variable definitions
  - Color variables: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`
  - Sidebar variables: `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, etc.
  - Form styling layer with base input, checkbox, radio styles
  - Global utilities: label cursor behavior, tile display styles
  - Chart & calendar styling (ApexCharts, FullCalendar)
  
- **`tailwind.config.cjs`**: Dark mode configured ✅
  - `darkMode: ['class']` enabled (class-based toggle)
  - Theme colors using CSS variables via `hsl(var(--*))` pattern
  - All Tailwind colors reference CSS variables (no hardcoded colors)
  - shadcn/ui compatible configuration
  - Tailwindcss-animate plugin installed

- **`src/styles/theme.ts`**: Flowbite era utilities (STILL PRESENT, PENDING CLEANUP)
  - 474 lines of legacy styling utilities
  - Exports: `inputStyles`, `buttonStyles`, `layoutStyles`, `tableStyles`, `cardStyles`, `formStyles`, `navigationStyles`, `footerStyles`
  - References to hardcoded colors (gray-*, teal-*, cyan-*) — not using CSS variables
  - Used by custom components that haven't yet migrated to shadcn
  - **Status**: Deprecated but still in use; should be removed in Phase 5

#### Theme & Provider Setup
- **`src/components/theme-provider.tsx`**: next-themes wrapper ✅
  - Wraps NextThemesProvider from `next-themes`
  - Props: `attribute="class"`, `defaultTheme="light"`, `enableSystem`
  - All pages should use this wrapper

- **`src/components/ui/theme-toggle.tsx`**: Dark mode toggle ✅
  - Uses `next-themes` hook: `useTheme()`
  - Toggle button with Sun/Moon icons (lucide-react)
  - Placed in Header component
  - Properly switches `.dark` class on `<html>` element

- **`src/components/Header.tsx`**: Main header component
  - Imports `ThemeToggle` from `./ui/theme-toggle`
  - Sticky positioning with backdrop blur
  - Uses CSS variable colors: `bg-background/95`, `border-border`, `text-foreground`, `text-primary`, `text-muted-foreground`
  - Contains breadcrumb placeholder and theme toggle

#### UI Components (shadcn/ui + Custom)
- **`src/components/ui/`**: Component library folder
  - **shadcn components**: `button.tsx`, `card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `skeleton.tsx`, `alert-dialog.tsx`, `theme-toggle.tsx`
  - **Custom components**: `AppCreatableSelect.tsx`, `AppSelect.tsx`, `ConfirmationDialog.tsx`, `InfoTooltip.tsx`, `Modal.tsx`, `Radio.tsx`, `ResponsiveInput.tsx`, `TextInput.tsx`
  - **Status**: Mixed — shadcn primitives present, custom components still use legacy patterns

#### Other Key Files Affected
- **`tailwind.config.cjs`**: Already updated for dark mode
- **`src/app/layout.tsx`**: Must wrap children with ThemeProvider
- **`next.config.mjs`**: Standard Next.js config
- **`components.json`**: shadcn/ui configuration (alias path, style framework)

### Dependencies

#### Installed
- `next-themes`: ^0.x (for dark mode management)
- `tailwindcss`: ^3.3.3
- `tailwindcss-animate`: for animations
- `lucide-react`: partial (theme-toggle uses it)
- `react-icons`: Still present (~20 files still import; not fully migrated)
- `sonner`: Toast library
- `@headlessui/react`: Still present (custom modals use it)
- `react-hook-form` + `zod`: Form handling

#### Pending Removal/Replacement
- `flowbite` + `flowbite-react`: Removed from package.json ✅ but `src/styles/theme.ts` still exists
- `react-toastify`: Replaced with `sonner`
- `react-icons`: Partially replaced with `lucide-react` (20 files still using old imports)

### Pages Affected (15+)

#### Layout Pages
- **`src/app/(authorized)/layout.tsx`**: Main authorized layout with Header + SideNav

#### Feature Areas
1. **Cashflow**: `/income`, `/expense`, `/donations`, `/bank`, `/bank-interest`, `/stocks`
2. **Reports**: `/reports/income-summary` (and other reports)
3. **Settings**: `/settings/profile`, `/settings/banks`, `/settings/calendar`
4. **Relations**: `/relation/individual`, `/relation/business`
5. **Zakat**: `/zakat`
6. **Auth**: `/auth/login`, `/auth/register`
7. **Home**: `/home` (dashboard)

### Known Flowbite Remnants Still Present

1. **`src/styles/theme.ts`** (474 lines)
   - Extensive custom styling utilities for cards, buttons, tables, forms, navigation
   - Still used by components that haven't fully migrated to shadcn
   - Contains Flowbite-specific class names and color references

2. **`@headlessui/react`** in custom components
   - Used in `src/components/ui/Modal.tsx`
   - Used in select/dropdown components

3. **`src/components/ui/Modal.tsx`**
   - Still uses `@headlessui/react` Dialog component
   - Should migrate to shadcn Dialog in Phase 2

4. **react-icons imports** (~20 files)
   - Files like `src/layouts/SideNav.tsx`, `src/layouts/SideNavLink.tsx`, etc.
   - Should migrate to `lucide-react` icons

5. **`globals.css` CSS class remnant**
   - One `.modal-body-flowbite` class at line 180+ (should be removed)

### Architecture Decisions Already Made

✅ **Dark Mode**: CSS variables + next-themes
- Light mode: `:root` CSS vars
- Dark mode: `.dark` CSS vars on `<html>` element
- Toggle persists to localStorage via next-themes

✅ **Color System**: CSS variables (not Tailwind extension)
- All colors reference `hsl(var(--color-name))`
- Easy to rebrand/update centrally

✅ **Component Library**: shadcn/ui primitives (partially)
- Radix UI foundation + Tailwind styling
- Tree-shakeable, customizable

✅ **Styling**: Tailwind CSS v3 (not v4)
- No breaking upgrades for now
- Stable, well-documented
- shadcn/ui compatible

### Data Flow Notes

- **Server Components**: Cashflow pages, Reports, Settings fetch data server-side
- **Client Wrappers**: Interactive features (modals, form state) use Client Components
- **State Management**: React Context + useReducer for optimistic updates
- **Forms**: react-hook-form + zod validation
- **Tables**: TanStack Table v8 (logic unchanged, just restyled)

### Current Completion Status

| Component                              | Status          | Notes                                                  |
|-----------------------------------------|-----------------|--------------------------------------------------------|
| Dark mode infrastructure                | ✅ DONE         | CSS variables, next-themes, toggle working            |
| CSS variable tokens                     | ✅ DONE         | All colors defined in globals.css                      |
| shadcn/ui initialization                | ✅ DONE         | `components.json` present, some components added       |
| shadcn Button, Card, Dialog, Table      | ⚠️ PARTIAL      | Primitives exist; not all pages migrated               |
| Icon migration (react-icons → lucide)   | ⚠️ INCOMPLETE   | ~20 files still use react-icons                        |
| Sidebar collapse (expanded/collapsed)   | ❌ NOT DONE     | Currently fixed w-64; no collapse UI                   |
| Mobile Sheet drawer                     | ⚠️ PARTIAL      | Custom toggle, not shadcn Sheet                        |
| Breadcrumb component                    | ❌ NOT DONE     | Placeholder in Header, not implemented                 |
| Empty states (all pages)                | ⚠️ PARTIAL      | Income, bank have empty states; others pending         |
| Flowbite cleanup                        | ⚠️ PENDING      | theme.ts still present, one class in globals.css       |
| Accessibility audit (WCAG AA)           | ❌ NOT DONE     | Needs phase 5 review                                   |
| E2E test execution                      | ❌ NOT DONE     | Not re-run since design changes                        |

---

## Migration History (Completed Work)

### Phase 1: Foundation ✅
- Tailwind darkMode configured
- CSS variables defined in globals.css
- next-themes integration complete
- ThemeProvider wrapping root layout
- Dark mode toggle in Header functional

### Phase 2: Core Components ⚠️ Partial
- shadcn/ui initialized
- Button, Card, Dialog, Input, Label components added
- react-toastify → sonner migration done
- Not all pages updated to use new components

### Phase 3: Navigation ⚠️ Partial
- Header redesigned with theme toggle
- SideNav still fixed (not collapsible)
- Mobile drawer not yet implemented as shadcn Sheet
- Breadcrumbs not implemented

### Phase 4: Page Updates ⚠️ In Progress
- All pages still have CRUD functionality
- Visual styling mixed (some pages updated, others pending)

### Phase 5: Polish & A11y ❌ Not Started
- No accessibility audit conducted
- No empty state illustrations added
- No performance optimization run
- Flowbite packages not yet removed (theme.ts cleanup pending)
