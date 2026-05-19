# Design Modernization — High-Level Design

## Vision & Goals

**Modernize** the My Financials application's visual design and component system by:
1. **Migrating from Flowbite to shadcn/ui** — Radix UI primitives + Tailwind, fully customizable and tree-shakeable
2. **Implementing dark mode** — CSS variables + next-themes for seamless light/dark switching
3. **Redesigning navigation** — Modern, collapsible sidebar + responsive mobile drawer
4. **Unifying components** — Consistent design language across 15+ pages and 6 feature areas
5. **Improving accessibility & responsiveness** — WCAG AA compliance, mobile-first UX (320px–1440px)

**Target aesthetic**: Clean/minimal + financial/professional (inspired by Linear.app and Stripe Dashboard)

**Scope**: Full application redesign across:
- 15+ pages (Home, Cashflow, Reports, Settings, Relations, Zakat, Auth)
- 6 feature areas
- All CRUD operations remain unchanged
- No data loss or schema changes

---

## Current Reality (Status Check)

### What's Already Done ✅

| Component                  | Status   | Evidence                                          |
|----------------------------|----------|--------------------------------------------------|
| Dark mode infrastructure   | ✅ DONE  | CSS vars in globals.css, next-themes integrated |
| CSS variable tokens        | ✅ DONE  | All colors defined; tailwind.config references  |
| shadcn/ui initialized      | ✅ DONE  | components.json present; primitives added       |
| Theme toggle in Header     | ✅ DONE  | theme-toggle.tsx with Sun/Moon icons            |
| Tailwind v3 + darkMode     | ✅ DONE  | darkMode: ['class'] configured                  |
| ThemeProvider wrapper      | ✅ DONE  | next-themes provider in layout                  |

### What's In Progress ⚠️

| Component                   | Status          | Notes                                        |
|-----------------------------|-----------------|----------------------------------------------|
| shadcn component migration  | ⚠️ PARTIAL      | Primitives exist; pages still use old imports |
| Icon migration              | ⚠️ INCOMPLETE   | ~20 files still import from react-icons      |
| Navigation redesign         | ⚠️ PARTIAL      | Header done; sidebar not collapsible         |
| Page styling updates        | ⚠️ IN PROGRESS  | Mixed old/new patterns across pages          |

### What's Not Started ❌

| Component                    | Status        | Impact                                      |
|------------------------------|---------------|---------------------------------------------|
| Sidebar collapse UI          | ❌ NOT DONE   | Fixed w-64 only; no icon-only mode         |
| Mobile Sheet drawer          | ❌ NOT DONE   | Custom toggle, not shadcn Sheet            |
| Breadcrumb component         | ❌ NOT DONE   | Placeholder only                            |
| Empty states (all pages)     | ❌ NOT DONE   | Income/bank partial; others pending         |
| Accessibility audit (WCAG)   | ❌ NOT DONE   | Phase 5 priority                            |
| Flowbite cleanup             | ❌ NOT DONE   | theme.ts still present; packages removed    |
| E2E test re-run              | ❌ NOT DONE   | Must validate after migrations              |

---

## Architecture

### Design System

#### Color Palette (CSS Variables)
- **Primary**: Teal/cyan (`--primary: 189 94% 43%`) — financial brand color
- **Background**: Light white/dark charcoal (`--background`)
- **Foreground**: Dark gray/light gray (`--foreground`)
- **Semantic**: Destructive red, success green, muted grays
- **UI Elements**: Card, border, input, ring colors all CSS-variable-based

**Implementation**: All colors via `hsl(var(--color-name))` in Tailwind config; centralized in globals.css

#### Typography
- **Font**: Inter (via @next/font/google, already optimized)
- **Scale**: Tailwind defaults (no custom typography tokens needed yet)
- **Accessibility**: Sufficient contrast ratios WCAG AA (4.5:1 for text)

#### Spacing
- **Grid**: 4px base grid (Tailwind default)
- **Consistency**: All pages use Tailwind spacing utilities (p-*, m-*, gap-*, etc.)

#### Dark Mode Strategy
- **Toggle**: next-themes (reads localStorage, respects system preference)
- **Implementation**: `.dark` class on `<html>` element
- **CSS Variables**: Separate `:root` and `.dark` blocks in globals.css
- **Persistence**: localStorage via next-themes (survives page reloads)

### Component Library Strategy

#### Layers
1. **Base**: shadcn/ui Radix UI primitives (unstyled, fully accessible)
2. **Styled**: Tailwind CSS applied via Radix UI `classNames` prop
3. **Composite**: Custom wrappers (e.g., `TextInput`, `AppSelect`) that combine primitives
4. **Page-level**: Feature-specific components (e.g., `IncomeForm`, `ExpenseTable`)

#### Key Decisions
- **shadcn/ui over Flowbite**: Radix primitives → full control, tree-shakeable, active maintenance
- **lucide-react over react-icons**: Cleaner design, shadcn default, smaller bundle
- **sonner over react-toastify**: Better animations, simpler API, Tailwind-native
- **next-themes for dark mode**: Industry standard, prevents flash on page load
- **TanStack Table unchanged**: Table logic stays the same; only styling updated

### Data Fetching & State

- **Server Components**: All data fetching happens server-side (Cashflow, Reports, Settings)
- **Client Boundaries**: Interactive state (`useState`, `useReducer`, forms) lives in Client Components
- **Client Wrapper Pattern**: Server Component fetches data → passes to Client Component for interactivity
- **Forms**: react-hook-form + zod validation (no changes needed)
- **Optimistic updates**: React Context + useReducer for UI feedback before server confirmation

### Navigation Architecture

#### Sidebar
- **Desktop**: Fixed left sidebar, w-64 (expanded) or w-16 (icon-only, not yet implemented)
- **Mobile**: Sheet drawer (hamburger menu on < 768px)
- **State**: Collapsed/expanded state persisted to localStorage (not yet implemented)
- **Items**: Feature groups (Cashflow, Reports, Settings, etc.) with nested links

#### Header
- **Fixed**: Sticky at top with backdrop blur
- **Left**: Breadcrumb (not yet implemented) + sidebar toggle (mobile only)
- **Center**: App title
- **Right**: Dark mode toggle + user dropdown (not yet implemented)

#### Breadcrumbs
- **Purpose**: Show current page hierarchy
- **Implementation**: Dynamic, based on route (not yet created)
- **Mobile**: Hidden on < 768px (already in globals.css)

---

## Technology Stack

### Frontend Framework
- **Next.js 16** (App Router — no Pages directory)
- **React 19.2** (Server Components by default)
- **TypeScript** (all code)

### Styling & UI
- **Tailwind CSS v3.3.3** (not v4 — avoid double migration)
- **shadcn/ui** (Radix UI + Tailwind)
- **CSS Variables** (dark mode, color system)
- **next-themes** (dark mode toggle + persistence)

### Icons & Components
- **lucide-react** (replacing react-icons gradually)
- **react-icons** (still present during migration; ~20 files not yet updated)
- **@headlessui/react** (still present in custom components; to migrate to shadcn)
- **sonner** (toasts/notifications)

### Forms & Validation
- **react-hook-form** (form state management)
- **zod** (schema validation)

### Data & Tables
- **TanStack Table v8** (headless table logic; styling updated to shadcn)
- **Prisma** (ORM — no schema changes in this modernization)
- **tRPC** (typesafe API — no changes needed)

### Configuration Files
- **`tailwind.config.cjs`**: darkMode, theme colors (CSS vars), plugins
- **`components.json`**: shadcn/ui CLI config (alias path, style framework)
- **`globals.css`**: Base styles, CSS variable definitions, utilities
- **`tsconfig.json`**: Path aliases (@/components, @/styles, etc.)

---

## Phase Roadmap (5 Phases)

### Phase 1: Foundation ✅ COMPLETE
**Objective**: Set up dark mode infrastructure and CSS variables  
**Timeline**: Week 1–2  
**Status**: ✅ All deliverables done

- Dark mode enabled in Tailwind (class-based)
- CSS variable tokens defined in globals.css
- next-themes integrated
- ThemeProvider wrapping root layout
- Theme toggle component created and placed in Header

### Phase 2: Core Component Migration ⚠️ IN PROGRESS
**Objective**: Migrate shadcn/ui primitives and replace legacy components  
**Timeline**: Week 2–4  
**Dependencies**: Phase 1  
**Current Status**: ⚠️ Partially complete

- [x] shadcn/ui components added (button, card, dialog, input, label, etc.)
- [x] Sonner integrated (react-toastify removed)
- [ ] All pages updated to use new shadcn components
- [ ] Icon migration complete (lucide-react; ~20 files still use react-icons)
- [ ] Flowbite cleanup complete (theme.ts still present)

### Phase 3: Navigation Redesign ⚠️ IN PROGRESS
**Objective**: Redesign header, sidebar, and mobile navigation  
**Timeline**: Week 4–5  
**Dependencies**: Phase 2  
**Current Status**: ⚠️ Partially complete

- [x] Header redesigned (sticky, dark mode toggle)
- [ ] Sidebar collapse UI (expanded/icon-only states)
- [ ] Mobile Sheet drawer (shadcn Sheet component)
- [ ] Breadcrumb component (dynamic routes)
- [ ] Active route highlighting in sidebar

### Phase 4: Page-by-Page Visual Update ⚠️ IN PROGRESS
**Objective**: Apply modern design to all 15+ pages  
**Timeline**: Week 5–10  
**Dependencies**: Phase 2 + 3  
**Parallelizable**: Pages are independent  
**Current Status**: ⚠️ In progress (mixed old/new patterns)

- Dashboard/Home: Analytics cards, trend charts, quick actions
- Cashflow pages (6): Consistent tables, forms, empty states
- Settings pages (3): Unified layout, profile/bank/calendar sections
- Relations pages (2): Searchable entity grids
- Reports pages (1+): Analytics dashboard, charts
- Zakat page: Step-by-step wizard or accordion flow
- Auth pages (2): Centered form layout

### Phase 5: Polish & Accessibility ❌ NOT STARTED
**Objective**: Final polish, a11y audit, performance optimization  
**Timeline**: Week 10–12  
**Dependencies**: Phase 4  
**Current Status**: ❌ Not started

- Accessibility audit (WCAG AA)
- Empty state illustrations (all pages)
- Skeleton loading states (refined)
- Page transition animations
- Flowbite final cleanup (theme.ts deletion)
- Bundle size audit
- E2E test re-run

---

## Design Principles

1. **Clarity**: Use whitespace; reduce visual noise; prioritize data legibility
2. **Trust**: Professional aesthetic; finance-forward; accessible by default
3. **Consistency**: All pages follow same component library and spacing
4. **Accessibility**: WCAG AA contrast; keyboard navigation; screen reader support
5. **Dark Mode**: Equal quality in both light and dark; not an afterthought
6. **Responsiveness**: Works on 320px (mobile) through 1440px (ultrawide)

---

## Success Criteria

By end of all phases:

- ✅ All existing CRUD operations work on every page
- ✅ Dark mode toggle functional; theme persists across sessions
- ✅ Responsive on 320px, 768px, 1024px, 1440px
- ✅ `pnpm run build` passes (no TypeScript/ESLint errors)
- ✅ `pnpm exec playwright test` passes (all e2e tests)
- ✅ Lighthouse accessibility score ≥ 90 on sample pages
- ✅ No increase in bundle size (shadcn/ui tree-shakeable)
- ✅ Existing user data preserved; no data migrations required

---

## Risk Mitigation

| Risk                                  | Likelihood | Impact | Mitigation                                        |
|---------------------------------------|------------|--------|--------------------------------------------------|
| Breaking existing CRUD operations     | Medium     | High   | Phase-based rollout; test each phase before next |
| Mixed old/new UI during migration     | Medium     | Low    | Feature flags (optional) for navigation          |
| Bundle size increases                 | Low        | Medium | Tree-shake audit in Phase 5                      |
| Dark mode contrast issues             | Low        | Medium | A11y audit + DevTools in Phase 5                 |
| Responsive breakdowns on mobile       | Medium     | Medium | Playwright MCP tests at each phase               |
| Icon migration incomplete             | Low        | Low    | Keep react-icons during transition               |

---

## Out of Scope

❌ Feature additions (new pages, new forms)  
❌ Database schema changes  
❌ Authentication system overhaul  
❌ tRPC or API refactor  
❌ Chart library migration (defer or do separately)  
❌ Content updates or copy changes  
❌ Tailwind v4 upgrade (defer to after modernization)  
❌ E2E test rewrites (existing tests should still pass)
