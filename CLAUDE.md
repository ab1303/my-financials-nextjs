# CLAUDE.md

All universal rules live in [`AGENTS.md`](./AGENTS.md). This file holds only Claude-specific configuration that other agents don't need.

## MCP Tools (Claude only)

- **Playwright MCP** (`@playwright/mcp`) — drive the running app at `http://localhost:3000` to ground UI work in real state.
- **Next.js DevTools MCP** (`next-devtools-mcp`) — inspect routes, components, and build artifacts during development.
- **Prisma MCP** (`prisma mcp`) — inspect schema, run queries, explore migrations safely.
- **Postgres MCP** (`@modelcontextprotocol/server-postgres`) — direct DB access at `postgresql://postgres:postgres@host.docker.internal:5432/financials`.
  - ⚠️ **READ-ONLY USE.** Never execute DDL (`CREATE` / `ALTER` / `DROP`). All schema changes go through `pnpm prisma migrate dev` — see Hard Constraints in `AGENTS.md`.
