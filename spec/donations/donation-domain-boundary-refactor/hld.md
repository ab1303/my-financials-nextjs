# Donation Domain Boundary Refactor — High Level Design (HLD)

## Overview

This HLD describes the domain boundary refactor to remove cross-domain reads from the Interest domain into Donations. Goal: ensure Donations domain owns `VoluntaryDonation` persistence and Interest domain consumes canonical read APIs or receives required identifiers from the UI.

Reference: existing draft plan at [spec/technical_debt/donation-domain-boundary-refactor.md](spec/technical_debt/donation-domain-boundary-refactor.md).

## Scope

- In-scope:
  - Interest cleansing flow where `InterestCleansing.sourceBusinessId` must reflect the beneficiary selected in the donations drawer.
  - API surface between Donations and Interest domains used by server-side code (tRPC + services).
  - Backfill of existing InterestCleansing rows missing `sourceBusinessId`.
- Out-of-scope (for now): reporting refactor, full service consolidation beyond interest/donations read-call fixes.

## Problem Statement

Current state: `src/server/services/bank-interest/interest-cleansing.service.ts` performs a direct `prisma.voluntaryDonation.findFirst(...)` lookup inside a transaction to populate `sourceBusinessId`. This introduces domain leakage and coupling, and bypasses Donations domain APIs.

Desired state: Interest domain does NOT directly read/write Donations tables. Instead, one of:

- Preferred short-term: UI (drawer flow) returns `beneficiaryId` from Donations creation and passes it into `applyAllocations` (server) — immediate removal of direct DB read.
- Alternative short-term: Expose a Donations read API `getByTransactionId(txId)` used by Interest service (server-side API call within same process), keeping persistence ownership in Donations domain.

Long-term: Consolidate interest-related logic into a single `interest-cleansing` service boundary, cleanly consuming Donations APIs where needed.

## Data Ownership

- `VoluntaryDonation` table: owned by Donations domain (`src/server/services/voluntary-donations/`). Canonical create/read/update occurs through Donations service.
- `InterestCleansing` and `InterestCleansingEvidence`: owned by Interest domain (`src/server/services/interest-cleansing/`).
- `DonationLedger` and ledger relationships: Donations domain.

## High-level Sequence (preferred flow)

1. User opens Cleanse Drawer and selects beneficiary.
2. Drawer server action `addRow` creates `VoluntaryDonation` and returns `{ beneficiaryId, transactionId }`.
3. Client calls `bankInterest.applyAllocations({ creditId, allocations, sourceBusinessId: beneficiaryId })`.
4. `bankInterest.applyAllocations` uses provided `sourceBusinessId` when creating `InterestCleansing` (no cross-domain DB reads).

Alternative sequence (API read):

1. Client calls `bankInterest.applyAllocations({ creditId, allocations })` as before.
2. `applyAllocations` calls Donations service API `voluntaryDonations.getByTransactionId(creditId)` to resolve `businessId`.
3. `applyAllocations` persists `InterestCleansing` with returned `businessId`.

## Non-functional & Constraints

- Keep transactions atomic and avoid long-running locks; prefer pass-through to reduce DB lookups inside the `prisma.$transaction` body.
- Follow repository governance: changes must be split into small PRs per phase; do not run `prisma db push`; use `pnpm prisma migrate dev` for schema changes if any.
- Keep API backward-compatible during rollout; make `sourceBusinessId` optional and fall back safely.

## Acceptance Criteria

- No direct `prisma.voluntaryDonation` reads exist in Interest domain files after Phase 0 removal.
- Cleanse drawer flow continues to display beneficiary names (no `Unknown`).
- Unit tests cover `applyAllocations` behavior for both provided `sourceBusinessId` and when missing.
- A backfill plan exists and can be executed to populate historical `InterestCleansing.sourceBusinessId` where available.

## Rollout Phases (summary)

- Phase 0: Short-term (safe) — implement pass-through `sourceBusinessId` parameter and update client drawer; remove direct prisma call. Alternatively, add Donations read API if pass-through is infeasible.
- Phase 1: Consolidate interest logic into `src/server/services/interest-cleansing/` and limit router wiring to a small adapter layer.
- Phase 2: Replace other cross-domain reads (reporting, transaction utils) with Donations APIs.
- Phase 3: Backfill data and finalize tests and docs.

## Risks & Rollback

- Risk: UI or client code fails to pass `sourceBusinessId` — fallback remains `null` and UI shows `Unknown`. Mitigation: keep DB-side lookup temporarily until client changes are deployed to allow progressive rollout; add feature flag if necessary.
- Rollback: revert router/service changes; keep temporary DB lookup until stable.

## Next Steps

- Draft LLD with API signatures, Prisma migration/backfill SQL, file-level changes, and test cases.
- Implement Phase 0 in a small PR.
