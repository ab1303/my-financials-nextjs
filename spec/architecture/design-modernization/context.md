# Design Modernization — Context

## Problem Statement

The My Financials application was built with Flowbite components, which provides a pre-built component system but limits customization. Modern financial applications (Linear.app, Stripe Dashboard) use design systems based on unstyled primitives (Radix UI) with custom Tailwind styling, enabling a distinctive, cohesive visual identity.

## Goals

1. **Migrate from Flowbite to shadcn/ui** — Radix UI primitives + Tailwind, fully customizable and tree-shakeable
2. **Implement dark mode** — CSS variables + next-themes for seamless light/dark switching
3. **Redesign navigation** — Modern, collapsible sidebar + responsive mobile drawer
4. **Unify components** — Consistent design language across 15+ pages and 6 feature areas
5. **Improve accessibility & responsiveness** — WCAG AA compliance, mobile-first UX (320px–1440px)

## Domain Dependencies

See `.../hld.md` for architecture domain scope.

This feature depends on:
- **Web standards**: CSS variables, Tailwind CSS, responsive design patterns
- **React 19**: Client Components (useTheme hooks, state management)
- **Next.js 16**: App Router with layout-based composition

## Scope

### In Scope
- Dark mode infrastructure (CSS variables, next-themes provider, theme toggle)
- shadcn/ui component library setup and configuration
- Design system tokens (colors, spacing, typography)
- Page layout modernization (header, sidebar, content areas)
- Icon migration (lucide-react for consistent icon set)
- Accessibility improvements (WCAG AA, semantic HTML)

### Out of Scope
- Data fetching or business logic changes
- Database schema modifications
- Feature changes (all CRUD operations remain unchanged)
