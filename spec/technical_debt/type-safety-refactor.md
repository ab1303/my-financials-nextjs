# Type Safety Refactor (Technical Debt)

## Summary

The test suite currently contains multiple instances of `as any` casting used to bypass TypeScript errors in mocks and test fixtures. This creates significant technical debt, as it disables type safety for these test components, masking potential errors if the underlying interface definitions change.

## Motivation

- **Fragility:** Bypassing the type checker means refactors that change the underlying data models (e.g., Prisma schema, service return types) will not break the tests at compile time, leading to silent failures.
- **Cognitive Load:** `as any` obfuscates the expected structure of mock data, making it harder for developers to understand what a service or component actually requires.
- **Maintainability:** Tests should be reliable; bypassing type safety makes them unreliable.

## Scope

- Refactor unit tests that currently rely on `as any` for mocking (Prisma models, API responses, complex component props).
- Replace raw object literals with type-safe factory functions (`createMockTransaction`, etc.) or robust utility types (e.g., `DeepPartial<T>`).

## Current Findings

- `src/__tests__/unit/server/services/bank-interest/interest-cleansing.scoring.test.ts`
- `src/__tests__/unit/dashboard-summary.test.ts`
- `src/__tests__/unit/services/bank-interest/suggestAllocations.test.ts`
- `src/__tests__/unit/SourceBadge.contrast.test.tsx`
- `src/__tests__/unit/TableCell.amount.test.tsx`
- `src/__tests__/unit/stock-asset.modals.test.tsx`
- `src/__tests__/unit/stock-asset.schema.test.ts`

## Proposed Plan

1.  **Develop Mock Factories:** Create a centralized set of mock factory utilities (`src/__tests__/factories/`) that produce type-safe instances of common models (Transactions, Holdings, etc.).
2.  **Replace Casts:** Systematically replace `as any` in test files with calls to these factory functions, providing only the necessary overrides.
3.  **Refactor Mocks:** Update `prismaMock` setup and `vi.mock` implementations to use proper types instead of `any` casts.
4.  **Verification:** Run `pnpm run type-check` and full `vitest` suite to ensure no regressions.

## Tasks

- [ ] Create `src/__tests__/factories/` and implement initial transaction factory.
- [ ] Refactor `src/__tests__/unit/services/bank-interest/suggestAllocations.test.ts` to use factories.
- [ ] Refactor `src/__tests__/unit/TransactionRow.test.tsx` (previously addressed via manual mock fix, now target for factory replacement).
- [ ] Systematically address remaining `as any` instances in the listed test files.
- [ ] Run `pnpm run type-check` and `pnpm test`.
