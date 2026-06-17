# Copilot Instructions for my-financials-nextjs

## Foundation

All agents must strictly follow the foundational mandates defined in `AGENTS.md`.

- Agents must not commit code or create pull requests without explicit user confirmation. Do not auto-commit.

## Universal Standards

- **Architecture**: T3 Stack (Next.js App Router, tRPC, Prisma, Tailwind).
- **Validation Workflow**:
  1. **Run `pnpm run type-check` (tsc)**: Fast type validation.
  2. **Run `pnpm run lint`**: Fast style/convention validation.
  3. **Prompt the user to run `pnpm run build`**: Final deployment verification only (perform locally).
- **Safety**: Stop dev server before Prisma operations. Never use `prisma db push`.

## Windows 11 & Token Optimization

- File Ops: NEVER use shell commands (`echo`, `Out-File`, `New-Item`, `mkdir`) to manage files. Use native workspace file tools exclusively.
- Path Syntax: All shell execution paths must use Windows backslashes (`\`).
- Suppress Noise: Always pass `--quiet` or `--silent` flags to terminal commands (`pnpm`, `prisma`) to minimize token-wasting stdout/stderr.

## Reference Index

- **Foundational Rules**: `AGENTS.md`
- **Component Patterns**: `.ai/instructions/` (Client Wrapper, Compound Components)
- **CI/CD & Deployment**: `.github/instructions/github-actions-ci-cd-best-practices.instructions.md`
- **Feature Guardrails**: `.github/instructions/reimbursement-patterns.instructions.md`
- **Spec Workflow**: See `AGENTS.md#Spec Documents`
