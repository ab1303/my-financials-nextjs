# Donation Domain Boundary Refactor — Low Level Design (LLD)

This LLD details concrete changes for Phase 0 (pass-through) and optional alternative (donations read API). Implementers: follow the step-by-step tasks and tests below.

## Summary of changes (Phase 0 — pass-through)

- Client: `src/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/useCleanseDonationState.ts`
  - After `addRow` returns, pass the returned `beneficiaryId` into `applyAllocations` call: `applyAllocations({ creditId, allocations, sourceBusinessId: beneficiaryId })`.

- tRPC Router: `src/server/trpc/router/bank-interest.ts`
  - Extend `applyAllocations` input schema to accept optional `sourceBusinessId: string | null`.

- Service: `src/server/services/bank-interest/interest-cleansing.service.ts`
  - Change `applyAllocations` signature to accept `sourceBusinessId?: string | null`.
  - Remove `tx.voluntaryDonation.findFirst(...)` lookup inside the `prisma.$transaction` body.
  - Use provided `sourceBusinessId` when creating `interestCleansing`:
    `sourceBusinessId: sourceBusinessId ?? null`.

- Tests:
  - Unit test for `applyAllocations` where `sourceBusinessId` supplied results in `interestCleansing.sourceBusinessId` set.
  - Unit test where `sourceBusinessId` not supplied keeps `null` (and when DB lookup is removed, ensure fallback behavior is documented).

## Alternative (Phase 0b — Donations read API)

- Add function in Donations service: `getByTransactionId(transactionId: string)` that returns `{ businessId?: string | null } | null`.
  - Path: `src/server/services/voluntary-donations/voluntary-donation.service.ts` (exported function).
- Interest service calls internal service function instead of direct `prisma` read:
  `const matching = await voluntaryDonationService.getByTransactionId(creditId);
sourceBusinessId = matching?.businessId ?? null;`
- This keeps client unchanged but still removes direct `prisma` access from Interest domain.

## API & Type Definitions

- tRPC input (Zod example):

```ts
const ApplyAllocationsSchema = z.object({
  creditId: z.string().uuid(),
  allocations: z.array(
    z.object({ evidenceId: z.string(), amount: z.number().min(0) }),
  ),
  sourceBusinessId: z.string().nullable().optional(),
});
```

- Service signature change (TypeScript):

```ts
export const applyAllocations = async (
  creditId: string,
  allocations: Array<{ evidenceId: string; amount: number }>,
  userId: string,
  sourceBusinessId?: string | null,
): Promise<{ success: boolean; allocationsCreated: number }> => { ... }
```

## Prisma / DB Migration

- No schema change required if `InterestCleansing.sourceBusinessId` already exists.
- Backfill SQL (one-off) to populate `interest_cleansing.source_business_id` from voluntary donations (run in a maintenance window):

```sql
UPDATE interest_cleansing ic
SET source_business_id = vd.business_id
FROM voluntary_donation vd
WHERE ic.source_business_id IS NULL
  AND vd.purpose = 'INTEREST_CLEANSING'
  AND vd.transaction_id = ic.credit_tx_id;
```

Wrap in a transaction and test on staging first. If `voluntary_donation` table names differ, adapt accordingly.

## File-level patch plan

- Edit: `src/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/useCleanseDonationState.ts`
  - Ensure `addRow` server action returns `{ beneficiaryId, transactionId }` (existing behavior). Immediately after addRow, call `applyAllocations` mutation with `sourceBusinessId`.
- Edit: `src/server/trpc/router/bank-interest.ts`
  - Update input schema and pass param to service call.
- Edit: `src/server/services/bank-interest/interest-cleansing.service.ts`
  - Update function signature and remove `tx.voluntaryDonation.findFirst`.
- Optional: Add `src/server/services/voluntary-donations/voluntary-donation.service.ts` with `getByTransactionId()` helper.

## Tests & QA

- Unit tests (Vitest):
  - `applyAllocations` sets `sourceBusinessId` when provided.
  - Ensure that creating evidence allocations still upserts existing evidence correctly.
- Integration/manual QA:
  - On local/dev, run drawer flow selecting beneficiary; verify in UI that beneficiary name shows (no Unknown).
  - Run SQL to confirm `interest_cleansing.source_business_id` set for new rows.

## Rollout Steps (Phase 0)

1. Implement server changes (router + service). Keep DB lookup only if needed behind a feature flag.
2. Implement client changes to pass `sourceBusinessId`.
3. Deploy backend and frontend in same release window, or deploy backend backwards-compatible changes first (server accepts optional `sourceBusinessId`).
4. Monitor UI for regressions; run verification SQL queries.
5. Remove any temporary DB read after safe deployment.

## Verification Queries

- New cleansing rows without Unknown:

```sql
SELECT id, source_business_id FROM interest_cleansing WHERE created_at > now() - interval '1 day';
```

- Count rows missing beneficiary:

```sql
SELECT count(*) FROM interest_cleansing WHERE source_business_id IS NULL;
```

## Acceptance Tests (concrete)

- Given a voluntary donation created by drawer with beneficiary X and purpose INTEREST_CLEANSING, when allocations are applied for the related credit, then `interest_cleansing.source_business_id` == X and UI shows beneficiary name.
- Given no `sourceBusinessId` provided, behavior unchanged (null) and UI may show Unknown.

## Notes for implementer

- Keep PRs small: (a) server changes + tests, (b) client change, (c) removal of DB read & backfill.
- Adhere to repo rules in `AGENTS.md` (migrations via `pnpm prisma migrate dev`, do not run `prisma db push`).
