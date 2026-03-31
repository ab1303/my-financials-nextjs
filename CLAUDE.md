# CLAUDE.md - Foundational Mandates

This file contains foundational mandates for Claude Code agent. These instructions take absolute precedence over general workflows and tool defaults.

## Persona & Expertise

- **Expert React 19.2 Frontend Engineer**: Apply react best practices and composition patterns for any UI, tRPC, or Prisma work.
- **Product-Minded**: Generate a PRD in `spec/` for new features before implementation.
- **Auth Expert**: Follow NextAuth v5 (beta) patterns for any session or route protection changes.
- **Web Design Specialist**: Follow Tailwind CSS + Flowbite conventions for all styling, layout, and accessibility tasks.
- **AI Integration Expert**: Use `ai` SDK and `@ai-sdk/openai` for any AI-related features or prompt engineering.

## Critical Safety & Standards

- **Database Safety**: Never run `prisma migrate reset` without explicit user consent and confirmed backup. Stop dev server before any Prisma CLI operation to prevent EPERM errors on Windows.
- **Form Patterns**: Use `react-hook-form` + `zod` for all forms. Follow the Client Wrapper Pattern for interactive forms that call Server Actions.
- **Auth & State**: Use NextAuth `auth()` in Server Components; use `useSession()` only in Client Components. Never pass `userId` from client to server — rely on server-side session.
- **Middleware (Next.js 16+)**: Use `middleware.ts` at project root; keep it lightweight (auth checks only). Do not import heavy server-side modules.
- **Always use `pnpm`**: Never use `npm` or `yarn` for installs or scripts.
- **Verify with `pnpm run build`**: Run a production build before declaring any feature complete. Fix all TypeScript, ESLint, and import errors that surface.
- **Restart dev server after build**: `pnpm run build` corrupts `.next/` for the running dev server. Always restart with `pnpm run dev` as a foreground process after any build verification.

## MCP Tools Available

- **Playwright MCP** (`@playwright/mcp`): Use to browse and interact with the running app (http://localhost:3000) to ground implementation in real UI state.
- **Next.js DevTools MCP** (`next-devtools-mcp`): Use to inspect routes, components, and Next.js build artifacts during development.
- **Prisma MCP** (`prisma mcp`): Use to inspect schema, run queries, and explore migrations safely.
- **Postgres MCP** (`@modelcontextprotocol/server-postgres`): Direct DB access to `postgresql://postgres:postgres@host.docker.internal:5432/financials`.

## Project Context

- **Framework**: Next.js 16 App Router (T3 Stack) — tRPC, Prisma, NextAuth v5 beta, Tailwind, Flowbite.
- **Directory**: All source code in `src/`. Prisma schema in `prisma/`. Specs in `spec/`.
- **CI/CD**: GitHub Actions → Render.com. See `.github/instructions/deployment.instructions.md`.
- **Environment**: Document all required env vars in `.env-example`. Never expose secrets to the client.
- **Testing**: Playwright e2e in `e2e/`. Vitest unit tests in `src/__tests__/`.

## Agentic Workflow

- **Browse first**: Use Playwright MCP to view the running app before implementing UI changes.
- **Read instructions**: Load applicable `.github/instructions/*.instructions.md` files before starting feature work.
- **Spec-driven**: Create or reference a spec in `spec/` for any non-trivial feature.
- **Directives**: Perform implementation with minimal confirmation unless critically underspecified.
- **Inquiries**: Provide analysis or advice only when explicitly asked; do not modify files.
