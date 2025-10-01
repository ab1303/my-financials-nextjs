# Copilot Instructions for my-financials-nextjs

## General Principles

- **Use TypeScript everywhere**: All code (frontend, backend, API, models) must be in TypeScript.
- **App Router only**: Use the `app` directory for all routing. Do not use or reference the `pages` directory.
- **Server-first by default**: Use Server Components for all data fetching, rendering, and business logic unless interactivity is required.
- **Client Components for interactivity**: Only use Client Components for UI that requires browser APIs, user events, or state.
- **Never pass event handlers or non-serializable props from Server to Client Components.**
- **Explicit boundaries**: Clearly separate Server and Client logic. Use the Client Wrapper pattern for interactive features.
- **Follow T3 Stack conventions**: Use tRPC for typesafe APIs, Prisma for ORM, NextAuth for auth, Tailwind for styling.
- **No secrets in client code**: Never expose sensitive environment variables or secrets to the client.
- **Document all required environment variables in `.env-example`.**
- **All specs/PRDs in `spec/` at project root.**
- **ALWAYS run `pnpm run build` before declaring any feature complete**: Ensure the project builds without errors in production mode before marking implementation as finished. Fix any build errors, unused imports, or linting warnings that appear during the build process.

## Project Structure

- All source code in `/src`.
- Organize by feature/module where possible.
- Prisma schema and migrations in `/prisma`.
- Global styles in `/styles`.
- tRPC routers in `/server/api`.
- NextAuth config in `/server/auth`.
- All route components, layouts, handlers in `app/`.
- Shared utilities in `src/utils`.
- Shared types in `src/types`.
- Co-locate route handlers, loading, and error states within `app/`.
- Use route groups (parentheses) for organization without affecting URLs.
- API route handlers in `app/api`.
- Do not use the `pages` directory.
- Co-locate component types, schemas, and utilities in feature-specific `_types.ts` and `_schema.ts` files.

## Server Components

- Default to Server Components for all data fetching, rendering, and business logic.
- **Never use client-side hooks or browser APIs in Server Components.**
- Use `Suspense` for streaming and granular loading states.
- Use `generateMetadata` for dynamic SEO.
- Use `fetch` with `revalidate` for caching.
- Use `generateStaticParams` for static builds of dynamic routes.
- Use `unstable_noStore` for fully dynamic, non-cached rendering.
- Use `Promise.all` for parallel data fetching and `React.cache` for deduplication.

## Client Components

- Mark with `"use client"` at the top.
- Use only for UI that requires interactivity, browser APIs, or user events.
- Use `next/navigation` hooks (`useRouter`, `usePathname`) instead of `next/router`.
- Use `useFormStatus`, `useFormState`, and `useOptimistic` for Server Actions.
- Use `useState` for managing UI state (editing, modals, etc.).
- **Never fetch data in Client Components if it can be done on the server.**
- Implement prop interfaces with TypeScript.
- Use wrapper Client Components to manage state when Server Components need to pass event handlers.

## Server Actions

- Use the `"use server"` directive.
- Call from both Server and Client Components for data mutations.
- Use `useFormStatus` and `useFormState` in Client Components to track form submissions.
- Use `useOptimistic` to update UI optimistically before server confirmation.
- Use `revalidatePath` or `revalidateTag` after mutations to ensure UI consistency.
- Pass Server Actions as props to Client Components for form handling.

## Data Fetching

- Use built-in `fetch` in Server Components for all data retrieval.
- Pass caching strategies with `fetch(url, { next: { revalidate: <seconds> } })`.
- Minimize external requests in serverless environments.
- Avoid fetching in Client Components if possible.

## Route Handlers

- Use Route Handlers under `app/api` (not `pages/api`).
- `GET` handlers are static by default unless configured otherwise.
- Validate incoming data and use proper CORS/security measures.
- Support JSON, text, and file responses.

## Styling and Assets

- Use Tailwind CSS for utility-first styling and Flowbite for prebuilt components.
- Use CSS Modules or CSS-in-JS as needed.
- Use the built-in `<Image />` component for optimized images.
- Use built-in font optimization with `@next/font` or newer APIs.

## Performance

- Use streaming and `Suspense` for faster initial rendering.
- Dynamically import large dependencies in Client Components.
- Use `React.useMemo` and `React.useCallback` in Client Components to avoid re-renders.
- Use `fetch` caching and revalidation carefully.

## Building Project

** DO NOT USE `npm` as the tool to build project **

- Always use `pnpm` to build project

## Testing and Linting

- Use `next lint` with ESLint and integrate Prettier.
- Use Prettier and `prettier-plugin-tailwindcss` for formatting.
- Use Husky and lint-staged to enforce linting/formatting before commits.
- Add/configure Jest, React Testing Library, or Cypress for testing.
- Keep test files near related components.

## Client/Server Boundary Patterns

> **Do not remove the Client Wrapper Pattern instructions below. Add new patterns as additional bullets. Both patterns are required. Use the Client Wrapper Pattern for interactive features that require both server data and client state. Use the user-specific data pattern for business/bank details and similar cases.**

- **Client Wrapper Pattern (for interactive features that require both server data and client state):**
  - Create a Client Component wrapper that receives data and Server Actions as props from a Server Component parent.
  - Handle all interactive state (`useState`, `useEffect`) in Client Components, never in Server Components.
  - Pass event handlers between Client Components as props, not from Server to Client Components.
  - Use TypeScript interfaces to define the contract between Server and Client boundaries.

- **For user-specific data (e.g., business/bank details):**
  - Keep the page as a Server Component.
  - Render a Client Component for interactivity/state.
  - The Client Component should fetch its own data (e.g., via tRPC), and the server will inject the user context/session automatically (do not pass userId from client to server).
  - Never convert the whole page to a Client Component just to access user/session; use the Bank Details pattern as reference.

## Form and State Management Patterns

- For edit/update functionality, manage editing state in Client Components using `useState<RecordType | null>`.
- Use `useEffect` to populate form fields when editing records change.
- Implement conditional rendering based on state (e.g., "Create" vs "Update" button text).
- Reset forms and clear editing state after successful Server Action completion.
- Use `react-hook-form` with `zod` validation for complex forms with TypeScript integration.

## Table and Data Display Patterns

- Use TanStack Table with TypeScript generics for type-safe tables.
- Implement action columns with edit/delete using icon buttons from `react-icons`.
- Pass event handlers as props to table components for row actions.
- Structure table components to receive data and handlers from parent Client Components.
- Use proper accessibility attributes (`aria-label`) for interactive table elements.

## Database Migration Safety

> **CRITICAL: These rules prevent catastrophic data loss. Follow strictly.**

- **ALWAYS check for running development servers before Prisma operations**:
  - Stop the dev server (`Ctrl+C` in terminal) before running `prisma generate`, `prisma migrate dev`, or `prisma db push`
  - Running Prisma commands while dev server is active causes EPERM file locking errors on Windows
  - Check for running Node.js processes with `tasklist | grep -i node` if needed
  - Restart dev server after Prisma operations complete
- **NEVER run `prisma migrate reset` without explicit user consent and backup confirmation.**
- **ALWAYS warn before destructive operations** that can cause data loss.
- **Migration drift resolution**:
  - First attempt: Manual migration repair techniques
  - Last resort: `prisma migrate reset` only with user approval and confirmed backup
  - NEVER assume development data is disposable
- **Required warnings before destructive commands**:
  - "⚠️ WARNING: This will DELETE ALL DATA in your database"
  - "Do you have a recent backup? (Y/N)"
  - "Type 'DELETE MY DATA' to confirm"
- **Safe migration practices**:
  - Add columns with default values when adding required fields
  - Use separate migrations for schema changes and data migrations
  - Test migrations on database copies first
  - Always provide rollback instructions
- **Backup requirements**:
  - Recommend `pg_dump` before major schema changes
  - Document backup restoration procedures
  - Never proceed with destructive operations without confirmed backup

## Error Handling and Naming

- Always handle errors explicitly in both Server and Client Components. Show user-friendly error messages.
- Use clear, descriptive names for files, components, and functions. Follow feature-based naming for co-located files.

## Spec Files

- All spec files (including PRDs) must be created in the `spec` folder at the project root.
- Filenames must clearly reflect the feature or change (e.g., `bank-details-update-functionality.md`).
- Do not create spec or PRD files in any other location.
