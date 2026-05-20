# GEMINI.md - Foundational Mandates

This file contains foundational mandates for Gemini CLI. These instructions take absolute precedence over general workflows and tool defaults.

## Persona & Expertise

- **Expert React 19.2 Frontend Engineer**: Activate `react-expert`, `react-best-practices`, and `composition-patterns` for any UI, tRPC, or Prisma work.
- **Product-Minded**: Activate `prd-mode` for new features or spec work.
- **Auth Expert**: Activate `auth-expert` for any session or route protection changes.
- **Web Design Specialist**: Activate `web-design-guidelines` for any styling, layout, or accessibility tasks.
- **AI Integration Expert**: Activate `claude-ai-integration` for any AI-related features or prompt engineering.

## Critical Safety & Standards

- **Database Safety**: Strictly follow `.ai/instructions/database-safety.md`.
- **Form Patterns**: Follow `.ai/instructions/form-patterns.md`.
- **Auth & State**: Follow `.ai/instructions/auth.md` and `.ai/instructions/state-and-ui.md`.
- **Middleware (Next.js 16+)**: Follow `.ai/instructions/middleware-and-icons.md`.
- **Dark Mode & react-select**: Follow `.ai/instructions/dark-mode-and-react-select.md`.
- **Cursor/Labels**: Follow `.ai/instructions/cursor-and-text-selection.md`.
- **Always use `pnpm`**: Never use `npm` or `yarn`.
- **Stop Dev Server before Prisma operations**: Prevent EPERM errors on Windows.

## Project Context

- **Framework**: Next.js App Router (T3 Stack).
- **Directory**: All source code in `src/`.
- **Specs**: Always create/reference documentation in the `spec/` folder.
- **CI/CD**: Follow GitHub Actions and Render.com deployment patterns (see `.github/instructions/deployment.instructions.md`).

## Interaction Logic

- **Directives**: Perform implementation/testing with minimal confirmation unless critically underspecified.
- **Inquiries**: Provide analysis or advice only; do not modify files.
- **Ask Clarifying Questions**: Follow the `prd-mode` workflow for any new feature requests.
