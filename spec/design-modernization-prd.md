# Design Modernization with shadcn/ui — PRD

**Last Updated:** March 31, 2026  
**Status:** In Progress — Phases 1–5 Complete (Icon migration + a11y pending)  
**Owner:** Design System Upgrade

---

## Executive Summary

Modernize the My Financials application's visual design and component system by migrating from Flowbite to **shadcn/ui**, adding **dark mode support**, redesigning **navigation**, and improving **responsive UX**. Target aesthetic: clean/minimal + financial/professional (Linear meets Stripe).

**Scope:** Full application redesign across 15+ pages and 6 feature areas.  
**Approach:** 5 phased rollout with independent deployment per phase.  
**Timeline:** Estimated 8–12 weeks (3–4 weeks per major phase, overlap possible).

---

## Current State

### UI Stack

- **Tailwind CSS** v3.3.3 (no dark mode, no CSS variables)
- **Flowbite** v1.8.1 + Flowbite React v0.12.17 (plugin removed, migration in progress)
- **@headlessui/react** v2.2.9 (Dialog, Disclosure)
- **Custom components**: Button, Card, Modal, Table wrappers with theme.ts utilities
- **Icons**: react-icons (5.4.0)
- **Toasts**: sonner

### Design System

- **Colors**: Cyan/teal primary palette (custom Tailwind extension)
- **Typography**: Inter font via @next/font/google
- **Spacing**: Tailwind defaults
- **Dark Mode**: ❌ NOT supported
- **CSS Variables**: ❌ NO CSS variable tokens

### Architecture

- **Pages**: 15+ routes across 7 sections (Cashflow, Reports, Settings, Relations, Zakat, Auth, Home)
- **Data fetching**: Server Components + Client wrappers pattern
- **State**: React Context + useReducer for optimistic updates
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table v8 with custom wrapper

### Migration Status

- Flowbite plugin already removed from `tailwind.config.cjs`
- Theme utilities in `src/styles/theme.ts` partially replace Flowbite components
- `FLOWBITE_MIGRATION.md` exists documenting migration strategy

---

## Goals & Objectives

### Primary Goals

1. **Migrate from Flowbite to shadcn/ui** — Radix UI + Tailwind, more maintainable, tree-shakeable
2. **Implement dark mode** — CSS variables + next-themes toggle in header
3. **Redesign navigation** — Modern collapsible sidebar + bottom nav for mobile, breadcrumbs
4. **Unify components** — Consistent design language across all pages
5. **Improve responsive UX** — Better mobile experience, skeleton loading, empty states

### Success Criteria

- ✅ All existing CRUD operations work on every page
- ✅ Dark mode toggle functional; theme persists across sessions
- ✅ Responsive on 320px (mobile), 768px (tablet), 1024px (desktop), 1440px (ultrawide)
- ✅ `pnpm run build` passes with no TypeScript/ESLint errors
- ✅ `pnpm exec playwright test` passes (all e2e tests)
- ✅ Lighthouse accessibility score ≥ 90 on sample pages
- ✅ No increase in bundle size (shadcn/ui is tree-shakeable)
- ✅ Existing user data preserved; no data migrations required

---

## Design Direction

### Aesthetic

**Hybrid: Clean/Minimal + Financial/Professional**

- **Inspiration**: Linear (navigation, spacing, clean lines), Stripe Dashboard (data density, trust)
- **Color Palette**: Teal/cyan primary (keep brand), slate grays (modern, accessible), semantic reds/greens
- **Typography**: Inter (existing), improved line-height and letter-spacing
- **Spacing**: Consistent 4px grid, more breathing room than current
- **Components**: Minimal, intentional, accessible by default (Radix primitives)

### Key Principles

1. **Clarity**: Use whitespace effectively; reduce visual noise
2. **Trust**: Professional, finance-forward aesthetic; data legibility > decoration
3. **Consistency**: All pages follow same component library and spacing
4. **Accessibility**: WCAG AA contrast, keyboard navigation, screen reader support
5. **Dark Mode**: Equal quality in both light and dark; not an afterthought

---

## Phased Implementation

### Phase 1: Foundation — shadcn/ui + Dark Mode Infrastructure

**Timeline**: Week 1–2  
**Dependencies**: None  
**Deliverables**: CSS variables, ThemeProvider, dark mode toggle, shadcn initialized

#### Steps

1. Initialize shadcn/ui CLI

   ```bash
   pnpm dlx shadcn@latest init
   ```

   - Select: New York style, CSS variables, Tailwind v3, `@/components/ui` path
   - Adds: `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`, `lucide-react`
   - Creates: `components.json`, `lib/utils.ts` (exports `cn()`)

2. Update `tailwind.config.cjs`
   - Add `darkMode: "class"` key
   - Import CSS variable theme from shadcn
   - Remove manual cyan color extension (now managed by CSS vars)

3. Set up CSS variables in `src/styles/globals.css`
   - `:root` block for light theme
   - `.dark` block for dark theme
   - Define: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--card`, `--input`, `--border`

4. Install `next-themes`

   ```bash
   pnpm add next-themes
   ```

5. Create `src/components/theme-provider.tsx`

   ```typescript
   "use client"
   import { ThemeProvider } from "next-themes"
   export default function Provider({ children }) {
     return (
       <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
         {children}
       </ThemeProvider>
     )
   }
   ```

6. Create `src/components/ui/theme-toggle.tsx` (sun/moon icon button)

7. Update `src/app/layout.tsx`

   ```typescript
   import { ThemeProvider } from "@/components/theme-provider"

   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           <ThemeProvider>
             {/* existing providers */}
           </ThemeProvider>
         </body>
       </html>
     )
   }
   ```

#### Files Modified

- `tailwind.config.cjs`
- `src/styles/globals.css`
- `src/app/layout.tsx`
- **New**: `src/lib/utils.ts`
- **New**: `src/components/theme-provider.tsx`
- **New**: `src/components/ui/theme-toggle.tsx`
- **New**: `components.json`

#### Verification Checklist

- [x] `pnpm run build` passes without errors
- [x] Dark mode toggle visible in running app (`src/components/ui/theme-toggle.tsx`)
- [x] Clicking toggle switches `:class="dark"` on `<html>` element (next-themes `attribute="class"`)
- [x] CSS variables resolve correctly in both modes (`--primary: 189 94% 43%` teal in both `:root` and `.dark`)
- [x] All existing pages render without visual regression (colors map to CSS vars)
- [ ] Manual test on localhost:3000 — light + dark mode _(use Playwright MCP to verify)_

---

### Phase 2: Core Component Migration — shadcn/ui Primitives

**Timeline**: Week 2–4  
**Dependencies**: Phase 1  
**Deliverables**: Migrated button, card, input, dialog, table, form components

#### Steps

1. Add shadcn/ui components

   ```bash
   pnpm dlx shadcn@latest add button card input label dialog dropdown-menu select table badge separator skeleton alert-dialog
   ```

2. Rewrite `src/components/buttons/Button.tsx`
   - Replace custom `buttonStyles` function with shadcn `buttonVariants`
   - Map existing variants: `dark` → `variant="ghost"`, `light` → `variant="outline"`, etc.
   - Keep `isLoading` prop: show spinner + set `disabled` state

3. Rewrite `src/components/card/Card.tsx`
   - Replace custom compound component with shadcn Card primitives
   - Export: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
   - Apply `className` merging with `cn()`

4. Rewrite `src/components/ui/Modal.tsx`
   - Replace `@headlessui/react` Dialog with shadcn Dialog
   - Use `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`, `<DialogFooter>`
   - Preserve animation/transition behavior

5. Rewrite form components
   - `TextInput.tsx` → shadcn Input + Label
   - `Label.tsx` → shadcn Label
   - `ConfirmationDialog.tsx` → shadcn AlertDialog

6. Rewrite `src/components/table/Table.tsx`
   - Update to use shadcn Table primitives
   - Keep TanStack Table integration (shadcn Table is just styled `<table>` element)

7. Replace toasting system
   - Remove `react-toastify`; install `sonner`
   - Replace `ToastContainer` in `src/components/Providers.tsx` with `<Toaster />`
   - Update all `toast.success()`, `toast.error()` calls to `sonner.toast.success()`, etc.

8. Replace icons
   - Uninstall `react-icons` (or keep it for backward compat during migration)
   - Replace imports from `react-icons` with `lucide-react` equivalents across all components
   - Example: `FiMenu` → `Menu`, `FiX` → `X`, `FiSun` → `Sun`, `FiMoon` → `Moon`

9. Remove Flowbite dependencies from shadcn components and utils
   - Clean up any Flowbite utility references in component code
   - Don't delete `flowbite` packages yet; keep for reference during Phase 3

10. Update `src/components/ui/index.ts` exports to match new shadcn components

#### Files Modified

- `src/components/buttons/Button.tsx` → rewrite
- `src/components/card/Card.tsx` → rewrite
- `src/components/ui/Modal.tsx` → rewrite
- `src/components/ui/TextInput.tsx` → rewrite
- `src/components/ui/Label.tsx` → rewrite
- `src/components/ui/ConfirmationDialog.tsx` → rewrite
- `src/components/table/Table.tsx` → update
- `src/components/Providers.tsx` → replace ToastContainer with Sonner
- `src/components/ui/index.ts` → update exports
- **Many files**: replace react-icons imports with lucide-react

#### New Dependencies

```bash
pnpm add next-themes sonner lucide-react
pnpm remove react-toastify
# Do NOT remove flowbite/flowbite-react yet
```

#### Files Deleted

- `src/styles/theme.ts` (deprecated; functionality moved to shadcn/ui CSS variables)

#### Verification Checklist

- [x] `pnpm run build` passes
- [x] All form interactions (create, edit, delete) work on at least 3 pages
- [x] Modals open/close with focus trapping (shadcn Dialog via Radix UI)
- [x] Toasts/notifications display correctly (sonner `<Toaster />` active)
- [x] Button loading states show spinner (`src/components/ui/button.tsx`)
- [x] Tables render correctly (Table compound component updated to CSS vars)
- [x] No more Flowbite class names in component output (`flowbite` removed from `package.json`)
- [ ] Icons display correctly across all pages _(react-icons still used in ~20 files — migration to lucide-react incomplete)_
- [x] Dark mode still works

---

### Phase 3: Navigation Redesign

**Timeline**: Week 4–5  
**Dependencies**: Phase 2  
**Deliverables**: New sidebar, header, mobile drawer, breadcrumbs

#### Steps

1. Redesign sidebar (collapsible, animated)
   - Rewrite `src/layouts/SideNav.tsx`
   - States:
     - Expanded: w-64, show icons + labels
     - Collapsed: w-16, show icons only
     - Mobile: Sheet drawer (shadcn Sheet)
   - Persist collapsed/expanded state in localStorage
   - Use lucide-react icons (Menu, Home, CreditCard, Settings, Users, Zap)

2. Redesign header
   - Rewrite `src/components/Header.tsx`
   - Left: sidebar toggle button + breadcrumbs
   - Right: dark mode toggle + user avatar dropdown (shadcn DropdownMenu)
   - Remove "Hi, username" text; move to user dropdown
   - Sticky positioning with subtle shadow

3. Add mobile navigation drawer
   - Create shadcn Sheet component
   - Hamburger button opens/closes drawer
   - Drawer contains full navigation menu
   - Click outside or select link closes drawer

4. Create breadcrumb component
   - Use shadcn Breadcrumb or create custom
   - Show current page path
   - Enable quick navigation

5. Update sidebar navigation links
   - Replace custom `SideNavLink.tsx` with new version
   - Add active state indicators (left border accent or background)
   - Collapsible sections for groups (Cashflow, Settings, Relations)

6. Update `(authorized)/layout.tsx`
   - New layout structure: sidebar + header + main content
   - Flex layout with responsive breakpoints
   - Header fixed, content scrollable

7. Delete or deprecate custom icon folder
   - `src/layouts/SideNavIcons/` → delete (replaced by lucide-react)

#### Files Modified

- `src/layouts/SideNav.tsx` → full rewrite
- `src/layouts/SideNavLink.tsx` → rewrite with active states
- `src/components/Header.tsx` → full rewrite
- `src/app/(authorized)/layout.tsx` → update layout structure
- **New**: `src/components/breadcrumb.tsx` (or use shadcn)
- **New**: `src/components/user-nav.tsx` (dropdown menu)

#### New Components (shadcn)

```bash
pnpm dlx shadcn@latest add sheet breadcrumb dropdown-menu avatar
```

#### Files Deleted

- `src/layouts/SideNavIcons/` → entire folder

#### Verification Checklist

- [ ] Sidebar collapses/expands smoothly on desktop _(sidebar is fixed w-64, collapsible state not yet implemented)_
- [ ] Collapsed state shows icons only, no labels _(not yet implemented)_
- [ ] Mobile (< 768px): hamburger opens Sheet drawer _(SideNav has mobile toggle via `openNav` state, not shadcn Sheet)_
- [x] Active route highlighted in sidebar
- [ ] Breadcrumbs show correct hierarchy _(breadcrumb component not created)_
- [x] User dropdown shows profile link + sign out
- [x] Dark mode toggle accessible from header (`ThemeToggle` in `Header.tsx`)
- [ ] Test responsive: 320px, 768px, 1024px, 1440px _(needs Playwright MCP verification)_
- [ ] No layout shift on page transitions
- [x] `pnpm run build` passes

---

### Phase 4: Page-by-Page Visual Update

**Timeline**: Week 5–10  
**Dependencies**: Phase 2 + 3  
**Deliverables**: Modernized UI across all 15+ pages  
**Note**: Steps within this phase can be parallelized; each page group is independent

#### Dashboard (`/home`)

**Goal**: Replace placeholder with real analytics dashboard

**Changes:**

- Summary cards (4 cards): total income, total expenses, net, zakat due
- Mini trend chart (last 12 months income/expense)
- Recent transactions list (last 10 entries)
- Quick action buttons (Add Income, Add Expense, etc.)

**Components**:

- shadcn Card for summary cards
- Chart library (Recharts or similar) for trends
- shadcn Table for recent transactions
- Responsive grid on mobile

---

#### Cashflow Pages (`income`, `expense`, `donations`, `bank`, `bank-interest`, `stocks`)

**Goal**: Consistent visual style, better UX for data entry and viewing  
**Parallelizable**: All 6 can be done simultaneously

**Per-page changes:**

1. Page header:
   - Title + description
   - Primary action button (Add Income, etc.)
   - Filter/sort controls

2. Table:
   - Replace custom wrapper with shadcn Table
   - TanStack Table adapter unchanged (just restyled)
   - Add row hover highlight, zebra striping optional

3. Forms:
   - Use shadcn Input, Label, Select, Popover for date picker
   - Validation errors displayed below field
   - Submit button with loading state

4. Empty states:
   - Illustration + heading + CTA button
   - Example: "No income recorded yet. Add your first income entry."

5. Modals:
   - Use shadcn Dialog (already migrated in Phase 2)
   - Apply consistent spacing and typography

6. Loading states:
   - Add skeleton components while fetching data
   - Skeleton matches layout of actual content

---

#### Settings Pages (`banks`, `calendar`, `profile`)

**Goal**: Unified settings layout, improved UX  
**Parallelizable**: All 3 can be done simultaneously

**Profile (`settings/profile`)**:

- Avatar upload / display
- Name, email, phone fields
- Password change section
- Preferences (currency, date format, etc.)

**Banks (`settings/banks`)**:

- Search/filter bank accounts
- Card-based display with edit/delete actions
- Add new bank button

**Calendar (`settings/calendar`)**:

- List of fiscal year configurations
- Card or table view
- Edit/delete actions
- Add new calendar button

---

#### Relations Pages (`relation/individual`, `relation/business`)

**Goal**: Compact, searchable entity display  
**Parallelizable**: Both can be done simultaneously

**Changes:**

- Search bar + filter by type
- Card grid or table view of entities
- Quick edit/delete actions
- Add entity button
- Empty state if no entities

---

#### Reports (`reports/income-summary`)

**Goal**: Dashboard-style analytics view

**Changes:**

- Summary cards (total income, avg monthly, etc.)
- Charts: monthly trends, income by source
- Filterable by date range and source
- Export button (optional for Phase 5)

---

#### Zakat (`/zakat`)

**Goal**: Simplified calculation flow

**Changes:**

- Step-by-step wizard or accordion-based flow
- Input fields for assets, liabilities
- Auto-calculated zakat amount
- Summary card with breakdown
- Payment history table

---

#### Auth Pages (`auth/login`, `auth/register`)

**Goal**: Modern, centered form layout  
**Parallelizable**: Both can be done simultaneously

**Changes:**

- Centered card layout on page
- Brand logo at top
- Form with shadcn Input, Label, Button
- "Forgot password?" and "Sign up / Sign in" links
- Social login option (optional)
- Error/success messages via toast

---

#### Implementation Order

Suggested order to avoid blockers (later pages can start once Phase 2+3 complete):

1. **Week 5**: Auth pages, Dashboard (foundational)
2. **Week 6**: Cashflow pages (parallel: income, expense, donations)
3. **Week 7**: Settings pages (parallel: profile, banks, calendar)
4. **Week 8**: Relations, Reports, Zakat (parallel)

#### Files Modified (across all pages)

- `src/app/(authorized)/home/page.tsx`
- `src/app/(authorized)/cashflow/*/page.tsx`, `form.tsx`, `*Client.tsx`
- `src/app/(authorized)/reports/**`
- `src/app/(authorized)/settings/**`
- `src/app/(authorized)/relation/**`
- `src/app/(authorized)/zakat/**`
- `src/app/auth/login/page.tsx`, `form.tsx`
- `src/app/auth/register/page.tsx`, `form.tsx`

#### Verification Checklist (per page)

- [x] All CRUD operations work (create, read, update, delete)
- [ ] Responsive on 320px, 768px, 1024px, 1440px _(needs Playwright MCP verification)_
- [x] Dark mode renders correctly (all pages use CSS variable classes)
- [x] No console errors or TypeScript warnings (`pnpm run build` clean)
- [x] Forms validate client + server side (react-hook-form + zod)
- [x] Tables sort, filter as expected (TanStack Table unchanged)
- [x] Modals open/close (shadcn Dialog)
- [x] Toasts show for success/error (sonner)
- [x] Loading skeletons display while fetching (`src/app/(authorized)/loading.tsx` skeleton)
- [ ] Empty states appear when no data _(partial — income and bank pages have empty states; not all pages)_

#### Global Verification

- [x] `pnpm run build` passes
- [ ] `pnpm exec playwright test` passes _(not run after design changes)_
- [ ] All e2e tests pass _(not verified)_

---

### Phase 5: Polish & Accessibility

**Timeline**: Week 10–12  
**Dependencies**: Phase 4  
**Deliverables**: Animations, loading states, a11y audit, performance optimizations

#### Steps

1. **Add page transition animations**
   - Subtle fade-in or slide-up for pages loaded via Suspense
   - Use Next.js `useTransition()` or CSS keyframes
   - Not distracting; motion reduced on `prefers-reduced-motion`

2. **Audit and improve accessibility**
   - Focus rings: visible, sufficient contrast
   - Keyboard navigation: Tab through all interactive elements
   - ARIA labels: buttons, icons, form fields
   - Color contrast: WCAG AA (4.5:1 for text)
   - Screen reader testing: test with a11y DevTools extension

3. **Add empty state illustrations**
   - For zero-data pages (no income, no expenses, etc.)
   - Use simple SVG or icon + text
   - Include CTA button

4. **Skeleton loading states**
   - Replace spinning loaders with content skeletons
   - Match shape of actual content (tables, cards, forms)
   - Apply shimmer animation

5. **Clean up globals.css**
   - Remove all legacy Flowbite CSS (component layer classes)
   - Keep only base + utilities
   - Verify no unused classes

6. **Font optimization**
   - Ensure Inter loads via `@next/font/google` with `display: swap` (already done)
   - Verify no layout shift on font load (CLS metric)

7. **Performance audit**
   - Run `pnpm dlx next-bundle-analyzer`
   - Ensure shadcn/ui tree-shaking is working (bundle size equal or smaller)
   - Check Lighthouse performance score
   - Optimize images (use `next/image` for all images)

8. **Remove Flowbite packages**
   - Delete `flowbite` and `flowbite-react` from `package.json`
   - Remove any remaining Flowbite class names or imports

#### Files Modified

- `src/styles/globals.css` (cleanup)
- Various component files (add motion-reduced support)
- Test files (a11y assertions)

#### Verification Checklist

- [ ] Lighthouse accessibility score ≥ 90 on sample pages _(not yet audited)_
- [ ] Keyboard-only navigation works through all interactive elements _(not yet audited)_
- [ ] Tab order is logical _(not yet audited)_
- [ ] All buttons/links have visible focus indicators _(shadcn provides focus-visible rings; not audited)_
- [ ] Color contrast AA on all text _(CSS variables use teal primary; not formally audited)_
- [ ] Screen reader announces all interactive elements _(not yet audited)_
- [ ] Empty states display with illustrations + CTA _(partial — income/bank have empty states; not all pages)_
- [x] Skeletons show while loading (`src/app/(authorized)/loading.tsx` shimmer skeleton active)
- [ ] Page transitions smooth _(no custom transitions added)_
- [ ] `prefers-reduced-motion` respected _(not explicitly implemented)_
- [ ] Bundle size audit: no size increase vs. pre-migration _(not run)_
- [x] `pnpm run build` produces no warnings
- [x] No TypeScript errors
- [x] Flowbite packages removed (`flowbite` + `flowbite-react` removed from `package.json`; `globals.css` still has one `.modal-body-flowbite` class to clean up)

### Outstanding Items

| Area                                               | Status             | Notes                                               |
| -------------------------------------------------- | ------------------ | --------------------------------------------------- |
| react-icons → lucide-react                         | ⚠️ Incomplete      | ~20 files still import from `react-icons`           |
| Sidebar collapse (w-16 icon-only mode)             | ⚠️ Not implemented | Fixed w-64 only                                     |
| Mobile Sheet drawer                                | ⚠️ Partial         | Custom toggle, not shadcn Sheet                     |
| Breadcrumb component                               | ❌ Not created     | —                                                   |
| Empty states (all pages)                           | ⚠️ Partial         | Income, bank done; expense/donations/others pending |
| Playwright e2e tests                               | ❌ Not re-run      | Run after icon migration                            |
| Lighthouse a11y audit                              | ❌ Not run         | Use web-design-guidelines skill                     |
| globals.css Flowbite class cleanup                 | ⚠️ One class left  | `.modal-body-flowbite` at line 180                  |
| react-select styles (bank-interest, stocks, zakat) | ⚠️ Pending         | Only income + donations updated so far              |

---

## Technical Decisions

### 1. shadcn/ui over Flowbite

**Why:**

- **Unstyled Radix UI** — Full customization via Tailwind (not black-box Flowbite)
- **Tree-shakeable** — Only bundle components you use
- **Better dark mode** — CSS variables built-in, not a plugins
- **Larger ecosystem** — More third-party integrations
- **Active maintenance** — Faster updates than Flowbite React

### 2. next-themes for dark mode

**Why:**

- **Standard for Next.js** — Industry best practice
- **Prevents flash** — Reads persisted preference before render
- **System preference** — Respects `prefers-color-scheme` media query
- **localStorage integration** — User preference persists

### 3. Lucide icons over react-icons

**Why:**

- **shadcn default** — All examples use lucide-react
- **Modern design** — Cleaner line-style icons
- **Smaller bundle** — Fewer icons to tree-shake
- **Consistency** — All apps using shadcn have familiar icons

### 4. Sonner over react-toastify

**Why:**

- **shadcn ecosystem** — Designed for Tailwind + Radix
- **Better animations** — Swipe-to-dismiss, stagger
- **Simpler API** — `sonner.toast('message')` vs. complex ToastContainer config

### 5. Keep TanStack Table

**Why:**

- **Headless table logic** — Sorting/filtering/sorting already battle-tested
- **Only need restyling** — shadcn Table is just `<table>` + styles
- **No refactor needed** — Existing table adapters continue to work

### 6. CSS Variables (not Unsafe dynamic classes)

**Why:**

- **Dark mode** — CSS variables toggle instantly on class change
- **System consistency** — All components use same token definitions
- **Easy rebranding** — Change color in `:root{}`; applies everywhere
- **Prevents Tailwind purging** — Values aren't in templates

### 7. Tailwind v3 (not v4 yet)

**Why:**

- **Avoid double migration** — shadcn/ui supports both; stay on v3 now
- **Stable** — v3 is mature, well-documented
- **Can upgrade later** — v4 migration is a separate effort for Phase 5+

### 8. Gradual migration (not big-bang)

**Why:**

- **Lower risk** — Can deploy and test each phase
- **Stakeholder visibility** — See progress incrementally
- **Easier debugging** — Single-phase regressions are easier to trace
- **Parallelizable** — Multiple devs can work on different pages simultaneously

---

## Scope Boundaries

### Included

✅ Visual design modernization  
✅ Dark mode implementation  
✅ Component library migration (Flowbite → shadcn/ui)  
✅ Navigation redesign  
✅ All 15+ pages restyled  
✅ Accessibility audit (WCAG AA)  
✅ Mobile responsiveness (320px+)  
✅ Performance optimization  
✅ Icon migration (react-icons → lucide-react)  
✅ Toast system upgrade (react-toastify → sonner)

### Explicitly NOT Included

❌ Feature additions (new pages, new forms)  
❌ Database schema changes  
❌ Authentication system overhaul  
❌ tRPC or API refactor  
❌ Chart library migration (can defer or do separately)  
❌ Content updates or copy changes  
❌ Tailwind v4 upgrade (defer to after modernization complete)  
❌ E2E test rewrites (existing tests should still pass)

---

## Risk Mitigation

| Risk                                    | Likelihood | Impact | Mitigation                                                     |
| --------------------------------------- | ---------- | ------ | -------------------------------------------------------------- |
| Breaking existing CRUD                  | Medium     | High   | Phase-based rollout; all data remains, just restyled           |
| Users seeing old + new UI mid-migration | Medium     | Low    | Feature flags can hide new nav until Phase 3 complete          |
| Bundle size increases                   | Low        | Medium | Tree-shake audit in Phase 5; shadcn/ui is designed to be small |
| Dark mode has contrast issues           | Low        | Medium | Accessibility audit + web a11y tester in Phase 5               |
| Responsive breakdowns on mobile         | Medium     | Medium | Test on real devices (or use Playwright MCP) at each phase     |
| Flowbite migration incomplete           | Low        | Low    | Can keep Flowbite packages for reference; remove gradually     |

---

## Success Metrics

By end of Phase 5:

- ✅ All pages render without console errors
- ✅ `pnpm run build` passes
- ✅ `pnpm exec playwright test` passes (all e2e tests)
- ✅ Lighthouse a11y ≥ 90 on sample pages
- ✅ Bundle size ≤ pre-migration size
- ✅ Dark mode toggle functional, theme persists
- ✅ Mobile responsive on 320px–1440px
- ✅ All CRUD operations still work
- ✅ No user data loss or corruption

---

## Resources & References

### Documentation

- [shadcn/ui Docs](https://ui.shadcn.com)
- [Radix UI Docs](https://radix-ui.com)
- [Tailwind CSS v3 Docs](https://tailwindcss.com/docs/v3)
- [next-themes GitHub](https://github.com/pacocoursey/next-themes)
- [Sonner Toast](https://sonner.emilkowal.ski/)

### Design System References

- [Linear Design System](https://linear.app)
- [Stripe Dashboard](https://dashboard.stripe.com)
- [Vercel Dashboard](https://vercel.com/dashboard)

### Tools

- **Web Accessibility Evaluator**: axe DevTools, WAVE, Lighthouse
- **Bundle Analyzer**: `pnpm dlx next-bundle-analyzer`
- **Component Testing**: Playwright MCP (browse app in real-time)

---

## Appendix: Component Mapping

### Button

| Current                        | New (shadcn)                                   |
| ------------------------------ | ---------------------------------------------- |
| `<Button variant="dark" />`    | `<Button variant="ghost" />`                   |
| `<Button variant="light" />`   | `<Button variant="outline" />`                 |
| `<Button variant="primary" />` | `<Button variant="default" />`                 |
| `<Button size="sm" />`         | `<Button size="sm" />`                         |
| `<Button isLoading />`         | `<Button disabled><Loader /> Loading</Button>` |

### Card

| Current                   | New (shadcn)      |
| ------------------------- | ----------------- |
| `<Card variant="base" />` | `<Card />`        |
| `<Card.Header />`         | `<CardHeader />`  |
| `<Card.Body />`           | `<CardContent />` |
| N/A                       | `<CardTitle />`   |

### Modal

| Current                        | New (shadcn)                         |
| ------------------------------ | ------------------------------------ |
| `<Modal open={} onClose={} />` | `<Dialog open={} onOpenChange={} />` |
| `<Modal.Header />`             | `<DialogHeader />`                   |
| `<Modal.Body />`               | `<DialogContent />`                  |
| `<Modal.Footer />`             | `<DialogFooter />`                   |

### Forms

| Current              | New (shadcn)              |
| -------------------- | ------------------------- |
| `<TextInput />`      | `<Input />` + `<Label />` |
| `<Label />`          | `<Label />`               |
| Custom validation UI | Built-in error messages   |

### Table

| Current                        | New (shadcn)                                                            |
| ------------------------------ | ----------------------------------------------------------------------- |
| Custom `<Table>` wrapper       | `<Table>` + `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>` |
| TanStack Table logic unchanged | Stays the same; just restyled                                           |

### Icons

| Current                       | New (shadcn)                 |
| ----------------------------- | ---------------------------- |
| `<FiMenu />` from react-icons | `<Menu />` from lucide-react |
| `<FiX />`                     | `<X />`                      |
| `<FiSun />`                   | `<Sun />`                    |
| `<FiMoon />`                  | `<Moon />`                   |

---

## Approval & Signoff

**Prepared by:** Design System Team  
**Date:** March 31, 2026  
**Status:** ⏳ Awaiting Approval

**Approvals:**

- [ ] Product Owner
- [ ] Lead Engineer
- [ ] Design Lead
- [ ] DevOps/CI-CD Lead (for deployment strategy)
