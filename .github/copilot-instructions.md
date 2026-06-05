# Copilot Instructions for my-financials-nextjs

## Foundation
All agents must strictly follow the foundational mandates defined in `AGENTS.md`.

## Universal Standards
- **Architecture**: T3 Stack (Next.js App Router, tRPC, Prisma, Tailwind).
- **Process**: Always run `pnpm run build` for validation.
- **Safety**: Stop dev server before Prisma operations. Never use `prisma db push`.

## Reference Index
- **Foundational Rules**: `AGENTS.md`
- **Component Patterns**: `.ai/instructions/` (Client Wrapper, Compound Components)
- **CI/CD & Deployment**: `.github/instructions/github-actions-ci-cd-best-practices.instructions.md`
- **Feature Guardrails**: `.github/instructions/reimbursement-patterns.instructions.md`
- **Spec Workflow**: See `AGENTS.md#Spec Documents`
