# CLAUDE.md - Foundational Mandates

This file contains foundational mandates for Copilot CLI sessions. See `AGENTS.md` for universal rules that apply to all agents.

---

## File Governance

See `AGENTS.md#File Governance` for which rules belong in which file. **CLAUDE.md focuses on Claude-specific persona, expertise, and MCP tools only.** All universal rules (database, specs, code, safety) are defined in `AGENTS.md` to prevent duplication and confusion.

---

## Persona & Expertise

- **Expert React 19.2 Frontend Engineer**: Apply react best practices and composition patterns for any UI, tRPC, or Prisma work.
- **Product-Minded**: Generate a PRD in `spec/` for new features before implementation.
- **Auth Expert**: Follow NextAuth v5 (beta) patterns for any session or route protection changes.
- **Web Design Specialist**: Follow Tailwind CSS + Flowbite conventions for all styling, layout, and accessibility tasks.
- **AI Integration Expert**: Use `ai` SDK and `@ai-sdk/openai` for any AI-related features or prompt engineering.

## Critical Safety & Standards

**For database safety, schema migrations, form patterns, auth, dev server safety, and all other universal rules: See `AGENTS.md#Code`** (lines 123-179).

The rules below are Claude-specific additions:
- **Postgres MCP read-only**: Use Postgres MCP for SELECT queries and schema inspection only. **Never execute `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, or any DDL.** All schema changes must go through `pnpm prisma migrate dev`. See `.ai/instructions/database-safety.md`.

## MCP Tools Available

- **Playwright MCP** (`@playwright/mcp`): Use to browse and interact with the running app (http://localhost:3000) to ground implementation in real UI state.
- **Next.js DevTools MCP** (`next-devtools-mcp`): Use to inspect routes, components, and Next.js build artifacts during development.
- **Prisma MCP** (`prisma mcp`): Use to inspect schema, run queries, and explore migrations safely.
- **Postgres MCP** (`@modelcontextprotocol/server-postgres`): Direct DB access to `postgresql://postgres:postgres@host.docker.internal:5432/financials`. ⚠️ **READ-ONLY USE ONLY** — never execute DDL (CREATE, ALTER, DROP). All schema changes must go through `prisma migrate dev`.

## Project Context

- **Framework**: Next.js 16 App Router (T3 Stack) — tRPC, Prisma, NextAuth v5 beta, Tailwind, Flowbite.
- **Directory**: All source code in `src/`. Prisma schema in `prisma/`. Specs in `spec/`.
- **CI/CD**: GitHub Actions → Render.com. See `.github/instructions/deployment.instructions.md`.
- **Environment**: Document all required env vars in `.env-example`. Never expose secrets to the client.
- **Testing**: Playwright e2e in `e2e/`. Vitest unit tests in `src/__tests__/`.

## Agentic Workflow

- **Browse first**: Use Playwright MCP to view the running app before implementing UI changes.
- **Read instructions**: Load applicable `.github/instructions/*.instructions.md` files before starting feature work.
- **Spec-driven**: See `AGENTS.md#Planning` for complete spec workflow.
- **Directives**: Perform implementation with minimal confirmation unless critically underspecified.
- **Inquiries**: Provide analysis or advice only when explicitly asked; do not modify files.

