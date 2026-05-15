# AI Agent Development Prompt for my-financials-nextjs

**Purpose:** This document provides comprehensive, unambiguous guidelines for AI agents working on the my-financials-nextjs project. Follow all rules explicitly to avoid hallucinations and inconsistencies.

---

## 1. TECHNOLOGY STACK & PROJECT TYPE

**Project Type:** Next.js 15+ Application (T3 Stack-based)

### Required Technologies

- **Language:** TypeScript (ALL code must be TypeScript)
- **Framework:** Next.js 15+ with App Router
- **Package Manager:** pnpm (NEVER use npm)
- **Styling:** Tailwind CSS + Flowbite (prebuilt components)
- **ORM:** Prisma
- **Authentication:** NextAuth.js
- **API:** tRPC (typesafe RPC)
- **Query Library:** React Query (@tanstack/react-query)
- **Forms:** react-hook-form + zod
- **Select Dropdowns:** react-select
- **Notifications:** React Toastify
- **Icons:** React Icons
- **State Management:** Immer (for immutable updates)
- **Testing:** Vitest (unit), Cypress/Playwright (E2E)
- **CI/CD:** GitHub Actions

---

## 2. ARCHITECTURE & STRUCTURE RULES

### 2.1 Directory Organization

```
/src
  /app                    # Next.js App Router pages/routes
  /components             # Reusable React components
  /server
    /api                  # tRPC routers
    /auth                 # NextAuth configuration
  /styles                 # Global CSS and theme
  /types                  # Shared TypeScript types
  /utils                  # Shared utility functions
  /hooks                  # Custom React hooks
  /layouts                # Layout components
  /lib                    # General library code
  /env                    # Environment variable validation
/prisma
  /migrations             # Database migrations
  schema.prisma           # Prisma data model
/spec                     # Project specifications and PRDs
/public                   # Static assets
```

### 2.2 File Naming Conventions

- Components: PascalCase (e.g., `UserCard.tsx`)
- Pages/Routes: kebab-case in app directory
- Type definitions: `_types.ts` (co-located with features)
- Schemas: `_schema.ts` (co-located with features)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Test files: `*.test.ts` or `*.test.tsx`

### 2.3 Route Organization

- Use App Router (`/src/app/`) ONLY
- Use route groups `(parentheses)` for organization without affecting URLs
- Never use `/pages` directory
- API routes: `app/api/[route]/route.ts`
- Auth middleware: `middleware.ts` at project root

---

## 3. NEXT.JS FUNDAMENTALS

### 3.1 Server vs. Client Components

**Default Strategy:** Server Components for data fetching, Client Components for interactivity

#### Server Components (DEFAULT)

- Use for:
  - Data fetching from databases
  - Rendering business logic
  - Access to secrets/API keys
  - Heavy computations
- Features:
  - Use `fetch()` with caching: `fetch(url, { next: { revalidate: 60 } })`
  - Use `Suspense` for streaming
  - Use `generateMetadata()` for SEO
  - Use `generateStaticParams()` for static generation
  - Use `unstable_noStore()` for fully dynamic rendering
  - Use `React.cache()` to deduplicate requests
  - Use `Promise.all()` for parallel fetching

#### Client Components (`.tsx` with `"use client"`)

- Use ONLY for:
  - Interactive UI (buttons, forms, modals)
  - Browser APIs (localStorage, geolocation)
  - Event handlers
  - React hooks (useState, useEffect, useCallback, useMemo)
- **CRITICAL:** Never use client-side hooks or browser APIs in Server Components
- **CRITICAL:** Never fetch data in Client Components if data can be fetched on server

### 3.2 Client Wrapper Pattern (For Interactive Features)

When a Server Component needs to pass data to an interactive Client Component:

1. Keep page as Server Component
2. Create separate Client Component wrapper
3. Pass fetched data as props to Client Component
4. Client Component handles all state and events
5. Pass Server Actions as props for mutations

**Example Structure:**

```typescript
// app/features/page.tsx (Server Component)
export default async function Page() {
  const data = await fetchData();
  return <FeatureClient initialData={data} {...serverActions} />;
}

// app/features/feature-client.tsx (Client Component)
"use client";
export function FeatureClient({ initialData, ...actions }) {
  const [editing, setEditing] = useState(null);
  // Handle all interactive state here
}
```

### 3.3 Server Actions

- Mark with `"use server"` directive
- Use for data mutations (create, update, delete)
- Call from both Server and Client Components
- Use `useFormStatus` and `useFormState` for tracking in Client Components
- Use `useOptimistic` for optimistic updates
- Use `revalidatePath()` or `revalidateTag()` after mutations
- Always wrap in try-catch with error handling

---

## 4. DATABASE & ORM RULES

### 4.1 Prisma Schema

- Define all models in `/prisma/schema.prisma`
- Use descriptive names for models and fields
- Include timestamps: `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- Use relations correctly: `@relation()`, avoid circular references
- Add indexes for frequently queried fields

### 4.2 Prisma Migrations

**CRITICAL SAFETY RULES:**

- **ALWAYS stop the dev server before running migrations**
- Run `Ctrl+C` in terminal to stop `pnpm run dev`
- Only then run: `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, `prisma generate`
- **NEVER run `prisma migrate reset` without explicit user consent**
  - Warn: "⚠️ WARNING: This will DELETE ALL DATA in your database"
  - Require confirmation: "Type 'DELETE MY DATA' to confirm"
  - Suggest: "Do you have a recent backup? (Y/N)"
- After migrations complete, restart dev server: `pnpm run dev` (foreground, not background)
- For migration drift, attempt manual repair first; reset only as last resort
- Use `prisma migrate status` to check migration state

### 4.3 Data Access

- Use Prisma Client for all database queries
- Implement proper error handling
- Use transactions for multi-step operations
- Never expose database directly to client

---

## 5. API & tRPC PATTERNS

### 5.1 tRPC Router Structure

```typescript
// /server/api/routers/[feature].ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const [feature]Router = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.[model].findMany();
  }),

  create: protectedProcedure
    .input(z.object({ /* validation schema */ }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.[model].create({ data: input });
    }),
});
```

### 5.2 tRPC Usage in Components

```typescript
// Client Component
'use client';
import { trpc } from '@/trpc/react';

export function Component() {
  // Query
  const { data, isLoading } = trpc.router.getAll.useQuery();

  // Mutation
  const { mutate } = trpc.router.create.useMutation({
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: [['router', 'getAll']] });
      toast.success('Created successfully!');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
```

### 5.3 Authentication in tRPC

- Use `protectedProcedure` for routes requiring authentication
- Access user session via `ctx.session`
- Always validate user has permission for the resource
- Use `TRPCError` for proper error responses

---

## 6. FORMS & DATA VALIDATION

### 6.1 Form Libraries

- Use `react-hook-form` for form state
- Use `zod` for schema validation
- Use `react-select` for dropdowns/selects
- Combine all three for type-safe forms

### 6.2 Form Implementation Pattern

```typescript
"use client";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email(),
});

type FormData = z.infer<typeof schema>;

export function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { name: "", email: "" },
  });

  const onSubmit = (data: FormData) => {
    // Handle submission
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Form fields */}
      </form>
    </FormProvider>
  );
}
```

### 6.3 Form Layout Patterns

- Use `layoutStyles.grayBackground` from theme utilities for page backgrounds
- Use `Card` components for form containers
- Use `max-w-3xl` for form width constraints
- Match existing business entity and bank details form layouts

### 6.4 Enum Integration

- Import enums from `@/types/enum`
- Provide default values for enum fields
- Render as select dropdowns with proper styling
- Include validation: `z.nativeEnum(YourEnumType).optional()`

---

## 7. AUTHENTICATION & AUTHORIZATION

### 7.1 NextAuth.js Setup

- Configure in `/server/auth.ts`
- Use OAuth providers (NextAuth adapters) where possible
- Store session securely in environment variables
- Protect API routes with `getSession()`

### 7.2 Authorization Patterns

- Check `ctx.session?.user` in protected procedures
- Implement role-based access control (RBAC) if applicable
- Validate user ownership before updating/deleting records
- Return `TRPCError` with proper HTTP status on unauthorized access

### 7.3 Middleware

- Use `middleware.ts` at project root for:
  - Route authentication checks
  - Redirects for unauthenticated users
  - Setting request headers
- Use Edge Runtime for middleware (set `matcher` for routes)

---

## 8. STYLING & UI COMPONENTS

### 8.1 Tailwind CSS

- Use utility-first approach exclusively
- Use `clsx` for conditional classes
- Follow Flowbite design system for consistency
- Import `layoutStyles` from theme utilities for common styles

### 8.2 Icon Usage

- Use React Icons library
- Prefer consistent icon sets (e.g., HeroIcons, Feather)
- Create reusable icon components in `/src/components/icons`
- Document icon usage in component files

### 8.3 Component Library

- Use Flowbite prebuilt components
- Co-locate component types in `_types.ts`
- Co-locate component schemas in `_schema.ts`
- Implement proper TypeScript interfaces for all props

---

## 9. NOTIFICATIONS & USER FEEDBACK

### 9.1 Sonner Usage

```typescript
import { toast } from 'sonner';

// Success (use after successful operations)
toast.success('Entity created successfully!');

// Error (with descriptive messages)
toast.error('Failed to create entity: ' + error.message);

// Info (for general notifications)
toast.info('Operation in progress...');
```

### 9.2 Confirmation Dialogs

- Use `window.confirm()` for destructive operations (delete)
- Provide clear confirmation messages
- Example: `if (window.confirm("Delete this item?")) { /* proceed */ }`

### 9.3 Feedback Rules

- Show feedback for ALL user actions (success AND failure)
- Use specific messages indicating what action was performed
- Provide error details when available

---

## 10. STATE MANAGEMENT

### 10.1 React Hooks

- Use `useState` for component UI state
- Use `useEffect` for side effects
- Use `useMemo` and `useCallback` to prevent unnecessary re-renders
- Reset state after successful operations

### 10.2 Immer for State Updates

```typescript
import { useImmer } from 'use-immer';

const [data, setData] = useImmer(initialData);

// Update immutably
setData((draft) => {
  draft.field = newValue; // Mutate draft directly
});
```

### 10.3 React Query Integration

- Use `trpc.[router].[procedure].useQuery()` for fetching
- Use `trpc.[router].[procedure].useMutation()` for mutations
- Always handle loading, error, and success states
- Refetch after mutations: `queryClient.refetchQueries()`

---

## 11. DEVELOPMENT WORKFLOW

### 11.1 Build Process

- **CRITICAL:** Always use `pnpm` (NEVER npm)
- Before declaring feature complete, ALWAYS run: `pnpm run build`
- Fix any TypeScript errors, unused imports, or linting warnings
- Restart dev server after build: `pnpm run dev`

### 11.2 Development Server

- Start with: `pnpm run dev`
- Server runs on `http://localhost:3000`
- Do NOT run as background process when testing
- Check for port conflicts (port 3000 should be free)

### 11.3 Linting & Formatting

- Use ESLint with `next lint`
- Use Prettier with `prettier-plugin-tailwindcss`
- Configure Husky and lint-staged for pre-commit hooks
- Run before commits: `pnpm lint`, `pnpm format`

### 11.4 Testing

- Unit tests: `pnpm test` (Vitest)
- Integration tests: `pnpm test:integration` (Vitest)
- E2E tests: Cypress or Playwright configuration
- Always write tests for new features

---

## 12. ENVIRONMENT VARIABLES

### 12.1 .env.local Setup

- Create `.env.local` with required variables
- Reference template in `.env.example` for available variables
- NEVER commit `.env.local` to git
- Keep secrets secure using GitHub Secrets for CI/CD

### 12.2 Environment Variable Access

- Server-side: Direct access to `process.env.*`
- Client-side: Use validated env from `/src/env` module
- Validate with Zod schemas
- Type-safe access prevents runtime errors

### 12.3 Required Variables

Document all required variables in `.env.example`:

- Database URL
- NextAuth Secret
- OAuth credentials
- API keys
- Feature flags

---

## 13. GIT & CI/CD PRACTICES

### 13.1 Branch Management

- Main branch: `main` (production-ready)
- Feature branches: `feature/...`
- Current branch: `feature/bank-assets`
- Always push to feature branch, create PR for review

### 13.2 Commit Conventions

- Follow conventional commits: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Use Commitlint for validation

### 13.3 GitHub Actions Workflows

- Store in `.github/workflows/*.yml`
- Use for: build, test, lint, deploy
- Implement CI/CD best practices (caching, matrix testing)
- Keep workflows modular and reusable

### 13.4 Pull Request Process

1. Create PR to `main` branch
2. Pass all CI checks
3. Get code review approval
4. Run `pnpm run build` successfully
5. Merge to main
6. Deploy to staging/production

---

## 14. SPECIFICATION DOCUMENTS

### 14.1 Where to Store Specs

- Location: `/spec` folder at project root
- Folder structure: `/spec/[feature-name]/` for related specs
- Existing folders: `asset-stocks-tracking/`, `bank-assets/`, `donations/`, etc.

### 14.2 Spec Document Types

- **PRD (Product Requirements Document):** High-level requirements
- **LLD (Low-Level Design):** Technical implementation details
- **Implementation Guide:** Step-by-step how-to
- **Architecture:** System design and patterns

### 14.3 Spec Naming

- Use descriptive, kebab-case filenames
- Examples: `bank-assets-prd.md`, `asset-tracking-lld.md`
- Include feature name and document type

---

## 15. FEATURE IMPLEMENTATION CHECKLIST

When implementing a new feature, follow this process:

### Pre-Implementation

- [ ] Read relevant instruction files
- [ ] Review existing similar features
- [ ] Create/update spec document in `/spec`
- [ ] Plan database schema (if needed)
- [ ] Plan component structure
- [ ] Plan API endpoints (tRPC routers)

### Code Implementation

- [ ] Create Prisma migration (if schema changes)
- [ ] Stop dev server before running migrations
- [ ] Implement Server Components for data fetching
- [ ] Implement Client Components for interactivity
- [ ] Implement tRPC routers and procedures
- [ ] Implement forms with validation
- [ ] Add error handling and user feedback
- [ ] Add TypeScript types for all data

### Testing & Validation

- [ ] Write unit tests
- [ ] Run `pnpm test` and confirm passing
- [ ] Test all user flows manually
- [ ] Check responsive design (mobile, tablet, desktop)
- [ ] Verify error states and edge cases

### Build & Deploy

- [ ] Stop dev server
- [ ] Run `pnpm run build` (MUST PASS)
- [ ] Fix any TypeScript errors or warnings
- [ ] Run `pnpm run dev` to restart dev server
- [ ] Test final feature in dev environment
- [ ] Deploy to staging for QA
- [ ] Create PR with clear description
- [ ] Get code review approval

---

## 16. COMMON PITFALLS TO AVOID

### NEVER DO:

1. ❌ Use `npm` instead of `pnpm`
2. ❌ Use `/pages` directory (only use `/app`)
3. ❌ Fetch data in Client Components when server can
4. ❌ Pass event handlers from Server to Client Components
5. ❌ Hardcode secrets in code or environment files
6. ❌ Skip `pnpm run build` validation before completion
7. ❌ Run Prisma migrations with dev server running
8. ❌ Use non-TypeScript files (.js, .jsx)
9. ❌ Run background dev server after build testing
10. ❌ Commit `.env.local` to git
11. ❌ Expose database directly to client
12. ❌ Use client-side hooks in Server Components
13. ❌ Forget error handling in tRPC procedures
14. ❌ Run migrations without backup confirmation
15. ❌ Create form without validation (zod + react-hook-form)

### ALWAYS DO:

1. ✅ Use TypeScript for all code
2. ✅ Use Server Components as default
3. ✅ Handle errors explicitly
4. ✅ Show user feedback (success/error toasts)
5. ✅ Use tRPC for type-safe APIs
6. ✅ Validate with zod schemas
7. ✅ Stop dev server before migrations
8. ✅ Run `pnpm run build` before completion
9. ✅ Test on dev server after build
10. ✅ Use environment variables for secrets
11. ✅ Co-locate types and schemas with features
12. ✅ Implement proper RBAC/authorization
13. ✅ Use proper naming conventions
14. ✅ Document complex logic with comments
15. ✅ Follow T3 Stack conventions

---

## 17. PROJECT CONTEXT

### Project Information

- **Name:** my-financials-nextjs
- **Repository:** ab1303/my-financials-nextjs
- **Current Branch:** feature/bank-assets
- **Default Branch:** main
- **Current Date:** February 28, 2026

### Key Features

- User authentication and session management
- Bank account tracking and management
- Asset tracking (stocks, cash, etc.)
- Income and expense tracking
- Zakat calculations
- Donations management
- Business/individual entity relations
- Address management (global support)

### Deployment Targets

- Staging: Automated on `develop` branch
- Production: Manual approval required for `main` branch
- Platform: Vercel or self-hosted (Node.js/Docker)

---

## 18. HOW AI AGENTS SHOULD USE THIS DOCUMENT

### Before Starting Any Task

1. Read the relevant sections of this guide
2. Check [Instruction Files](#relevant-instruction-files) below
3. Review existing implementations of similar features
4. Plan your approach clearly

### When Implementing Features

1. Follow the **Feature Implementation Checklist** (Section 15)
2. Reference specific sections for guidance (e.g., Section 7 for auth)
3. Use code examples from this document as templates
4. Never deviate from the stated rules without strong justification

### When Stuck or Uncertain

1. Re-read the relevant section carefully
2. Search codebase for similar implementations
3. Check specification documents in `/spec`
4. Ask for clarification rather than guessing

### Final Validation

- Always run `pnpm run build` before declaring completion
- Verify all TypeScript errors are resolved
- Restart dev server in foreground after build
- Confirm feature works in development environment

---

## 19. RELEVANT INSTRUCTION FILES

These instruction files provide additional detail on specific topics:

- **Authentication:** `.github/instructions/authentication.instructions.md`
- **Deployment:** `.github/instructions/deployment.instructions.md`
- **Forms:** `.github/instructions/form-implementation-patterns.instructions.md`
- **CI/CD:** `.github/instructions/github-actions-ci-cd-best-practices.instructions.md`
- **Icons:** `.github/instructions/icons.instructions.md`
- **Middleware:** `.github/instructions/middleware-edge.instructions.md`
- **Notifications:** `.github/instructions/notifications.instructions.md`
- **Performance:** `.github/instructions/performance.instructions.md`
- **State Management:** `.github/instructions/state-management.instructions.md`

---

## 20. QUICK REFERENCE

### Command Reference

```bash
# Development
pnpm install              # Install dependencies
pnpm run dev             # Start dev server
pnpm run build           # Production build
pnpm run lint            # Run ESLint
pnpm run format          # Format with Prettier

# Database
prisma migrate dev --name "description"  # Create migration
prisma migrate deploy                    # Deploy migrations
prisma studio                            # Open database UI
prisma generate                          # Generate Prisma Client

# Testing
pnpm test                # Run unit tests
pnpm test:integration    # Run integration tests

# Git/CI
git checkout -b feature/...   # Create feature branch
git push origin feature/...    # Push to remote
# Create PR on GitHub
```

### Key Directories

- **Pages/Routes:** `src/app/`
- **Components:** `src/components/`
- **API (tRPC):** `src/server/api/`
- **Types:** `src/types/`
- **Database:** `prisma/`
- **Specs:** `spec/`
- **Styles:** `src/styles/`

### Key Files

- Main config: `next.config.mjs`
- tRPC root: `src/server/api/root.ts`
- Auth config: `src/server/auth.ts`
- Env validation: `src/env/index.ts`
- Tailwind config: `tailwind.config.cjs`

---

**Last Updated:** February 28, 2026  
**Version:** 1.0  
**Maintained By:** Development Team  
**For Questions:** Refer to relevant instruction files or project README
