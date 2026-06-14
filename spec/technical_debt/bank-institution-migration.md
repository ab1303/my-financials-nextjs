# Bank → Institution Migration (Technical Debt)

## Summary

The codebase recently migrated the Prisma `FinancialAccount` relation from `bank` to `institution` (field: `institutionId`). Several code paths, tests, and UI components still reference the legacy `bank`/`bankId` naming which causes inconsistencies and test failures. This spec documents the remaining surface area, recommended approach, and acceptance criteria for completing the migration in a follow-up pass.

## Scope

- Update server-side controllers, trpc routers, services, and Zod schemas where the public API should adopt `institutionId` instead of `bankId`.
- Update frontend types, components, and forms to use `institutionId` consistently.
- Update unit and integration tests to use `institutionId` (or explicitly accept `bankId` as backwards-compatible input where required).
- Ensure migrations to Prisma schema are complete and that all prisma client usages use `institution` includes.

Out of scope for this pass:

- Changing public HTTP API routes that must remain backwards-compatible without a deprecation plan.
- Database migrations — those were already applied and are considered complete.

## Motivation

Inconsistent naming increases developer cognitive load, causes failing tests, and risks introducing bugs when handlers expect `bankId` but Prisma/DB uses `institutionId`. Finishing this migration will improve type-safety and maintainability.

## Current Findings (as of branch `refactor-donation-model-v3`)

- Services and routers updated: `transfer.service.ts`, `transfer-rule-job.service.ts`, `bank-asset.service.ts`, `trpc/router/transfer.ts`.
- Tests still referencing `bankId`: `src/__tests__/**` (multiple tests in interest-cleansing, bank schema tests, snapshot modal tests).
- UI components: `src/app/(authorized)/assets/bank/NewSnapshotModal.tsx` referenced `bankId` but was patched to prefer `institutionId` with fallback.
- Zod input schemas: `src/server/schema/bank-asset.schema.ts`, `src/server/schema/bank.schema.ts` still declare `bankId` (decide on API compatibility before renaming).

## Proposed Plan

1. Inventory: run a repo-wide search for `bankId`, `bankAccount.bankId`, and `bank` includes to produce a definitive file list.
2. Decide compatibility strategy:
   - Option A (breaking): Rename all public input fields and tests to `institutionId`.
   - Option B (compat): Keep Zod/public inputs as `bankId` but map to `institutionId` in service/controller layer and add unit tests asserting the mapping.
3. Implement changes in small commits grouped by domain (server tests, frontend, schemas):
   - Update Zod schemas (if Option A chosen).
   - Update controller param names and mapping.
   - Update frontend types and forms.
   - Update tests and fixtures.
4. Run `pnpm run type-check` and `pnpm run lint` locally; fix type errors.
5. Run unit tests and fix failing mocks.
6. Open PR with changes, include migration summary and list of modified files.

## Acceptance Criteria

- No lingering `financialAccount.include.bank` include patterns in source files.
- All unit tests pass locally (`pnpm vitest`).
- `pnpm run type-check` reports no new TypeScript errors.
- Zod schema decision is recorded in a short follow-up note in this spec (compatibility choice).

## Risk & Rollback

- Risk: Renaming public API fields is a breaking change. Mitigation: choose Option B (compat) or version the API and document the change.
- Rollback: revert the branch and reopen a scoped PR for the breaking change with clear migration notes.

## Tasks (for next pass)

- [ ] Run final inventory search and add any missed files to this spec.
- [ ] Decide compatibility strategy and record it.
- [ ] Apply changes across tests and UI consistently.
- [ ] Run type-check, lint, and unit tests; fix issues.
- [ ] Prepare PR description and changelog entry.

## Notes

- When changing many files, follow the repo rule to constrain automated tools and avoid global formatting or unrelated changes.
- Use targeted commits for spec migration vs implementation commit separation as described in `AGENTS.md`.
