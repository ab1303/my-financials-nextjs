# Linting Strong-Typing Playbook (`@typescript-eslint/no-explicit-any`)

## Goal

Replace `any` with concrete, local, and safe types while keeping behavior unchanged.

## Working Rules

- Keep `@typescript-eslint/no-explicit-any` enabled. Do not suppress globally to make progress.
- Prefer narrow local types over broad shared abstractions during cleanup.
- Validate after each batch (`eslint` + `type-check`) so regressions are localized.
- Refactor highest-impact production files first, then tests.

## Practical Patterns

### 1) Replace Prisma delegate casts

Instead of:

- `(prisma.model as any).findMany(...)`

Use:

- `prisma.model.findMany(...)`

Benefits:

- Inferred return payloads from Prisma
- Removes many downstream casts

### 2) Use transaction-compatible DB client types

When helpers are used both inside and outside transactions:

- `type DbClient = PrismaClient | Prisma.TransactionClient`

Pass `DbClient` to helper functions so calls remain strongly typed in both contexts.

### 3) Use Prisma payload helpers for query shapes

For include/select-heavy records, define local payload types:

- `Prisma.TransactionGetPayload<{ include: {...} }>`

This avoids hand-written pseudo-types and accidental drift from schema relations.

### 4) Replace `error: any` with `unknown`

Use safe extraction helpers:

- `const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback`

### 5) UI query data: local view models

For component-side casting from tRPC query data:

- Define local interfaces matching exactly what the component renders.
- Include non-primitive runtime types (for example `Decimal`) where needed.

### 6) Enum conversions at boundaries

If API payload is `string` but formatter expects enum:

- Add small converter functions (for example `asCurrencyEnum`) instead of `as any`.

## Common Pitfalls Seen

- Assuming stale Prisma relation names (causes type-check failures).
- Replacing `any` without accounting for `Decimal` in UI helpers.
- Fixing one file without running `type-check`, which hides cross-file fallout.
- Destructuring variables that become unused after refactor (`no-unused-vars`).

## Batch Workflow

1. Generate exact `no-explicit-any` locations via ESLint JSON.
2. Refactor one logical slice (2-4 files max).
3. Run targeted lint on touched files.
4. Run project `type-check`.
5. Recompute global `no-explicit-any` count.
6. Move to next highest-impact slice.

## Decision Order for Prioritization

1. Production service/router files with high `any` count.
2. Production UI files with repetitive `any` casts.
3. Test files last (unless they block CI or hide API contract issues).

## Quality Bar Before Moving On

- No new lint warnings in touched files.
- `type-check` passes.
- No behavior changes introduced during typing cleanup.
- Count trend is documented (before/after).
