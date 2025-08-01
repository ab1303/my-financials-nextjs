# Copilot Instructions for my-financials-nextjs

## Dos

- Organize routes and components in the `app` directory.
- Leverage Server Components for data fetching.
- Use Server Actions for form submissions.
- Use `next/link` for internal routing and prefetching.
- Implement loading states with `loading` files.
- Optimize images with the `<Image />` component.
- Separate server and client logic carefully.
- Manage database schema changes with Prisma Migrate; keep schema and migrations in `prisma/`.
- Document all required environment variables in `.env-example`; never commit secrets.
- Use `docker-compose.yaml` for local development; refer to `render.yaml` for deployment.
- Follow T3 Stack conventions and use tRPC for typesafe APIs.

## Donts

- Do not mix the `pages` and `app` directories for routing.
- Do not fetch data in Client Components if it can be done on the server.
- Do not use `router.push` for form submissions when Server Actions are available.
- Never expose sensitive environment variables in client code.
- Do not import client-only modules into Server Components.
- Avoid using `next/router` in App

## Project Structure

- Use the `app` directory for all route components, layouts, and handlers.
- Place shared utilities in `src/utils`.
- Place shared types in `src/types`.
- Co-locate route handlers, loading, and error states within the `app` directory.
- Use route groups (parentheses) for organization without affecting URLs.
- Place API route handlers in `app/api`.
- Do not use the `pages` directory.

## Client Components

- Mark Client Components with `"use client"` at the top.
- Use `next/navigation` hooks (`useRouter`, `usePathname`) instead of `next/router`.
- Handle form state with `useFormStatus`, `useFormState`, and `useOptimistic` when using Server Actions.
- Include client-specific logic like user interaction and browser APIs.

## Server Components

- Default to Server Components for data fetching and rendering.
- Do not use client-side hooks or browser APIs in Server Components.
- Use `Suspense` boundaries for streaming and granular loading states.
- Use `generateMetadata` for dynamic SEO metadata.
- Prefer `fetch` with `revalidate` options for caching.
- Implement `generateStaticParams` for static builds of dynamic routes.
- Use `unstable_noStore` for fully dynamic, non-cached rendering.
- Use `Promise.all` for parallel data fetching and `React.cache` for request deduplication.

## Server Actions

- Define Server Actions with the `"use server"` directive.
- Call Server Actions from both Server and Client Components for data mutations.
- Use `useFormStatus` and `useFormState` in Client Components to track form submissions.
- Use `useOptimistic` to update the UI optimistically before server confirmation.

## Data Fetching

- Use the built-in `fetch` in Server Components for data retrieval.
- Pass caching strategies with `fetch(url, { next: { revalidate: <seconds> } })`.
- Minimize external requests in serverless environments.
- Avoid fetching in Client Components if possible.

## Route Handlers

- Replace deprecated `pages/api` routes with Route Handlers under `app/api`.
- `GET` handlers are static by default unless configured otherwise.
- Validate incoming data and use proper CORS/security measures.
- Support JSON, text, and other file responses.

## Styling and Assets

- Use Tailwind CSS for utility-first styling and Flowbite for prebuilt components.
- Use CSS Modules or CSS-in-JS as needed.
- Use the built-in `<Image />` component for optimized images.
- Consider built-in font optimization with `@next/font` or newer APIs.

## Performance

- Use streaming and `Suspense` for faster initial rendering.
- Dynamically import large dependencies in Client Components.
- Use `React.useMemo` and `React.useCallback` in Client Components to avoid re-renders.
- Use `fetch` caching and revalidation carefully.

## Testing and Linting

- Use `next lint` with ESLint and integrate Prettier.
- Use Prettier and `prettier-plugin-tailwindcss` for consistent formatting.
- Use Husky and lint-staged to enforce linting and formatting before commits.
- Add and configure Jest, React Testing Library, or Cypress for testing.
- Keep test files near related components.
