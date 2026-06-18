# Refactoring Plan: Domain-Driven Decoupling

## Objective

Decouple `src/server/services/donation.service.ts` into independent, vertical domain slices.

## Domain Structure

- **Voluntary Donations**: `src/server/services/voluntary-donations/`
- **Zakat**: `src/server/services/zakat/`
- **Interest Cleansing**: `src/server/services/interest-cleansing/`
- **Reporting**: `src/server/services/reporting/` (Read-only aggregation, strictly consumed by reporting endpoints)

## Principles

1. **No Cross-Domain Imports**: Domain services (`voluntary`, `zakat`, `interest`) must NOT import from each other.
2. **Persistence Independence**: Each domain service handles its own CRUD and Prisma operations.
3. **Model Decoupling**: Introduce domain-specific DTOs/Input models, removing reliance on shared "God DTOs".

## Phased Approach

### Phase 1: Preparation

- Define independent models (DTOs) for `Voluntary`, `Zakat`, and `Interest`.
- Create folder structure.

### Phase 2: Domain Migration

- Migrate `Zakat` service and its dependencies to `src/server/services/zakat/`.
- Migrate `Interest Cleansing` service to `src/server/services/interest-cleansing/`.
- Create `Voluntary Donation` service in `src/server/services/voluntary-donations/`.

### Phase 3: Reporting Aggregation

- Implement `src/server/services/reporting/donation-aggregator.service.ts` for cross-domain read-only metrics, explicitly forbidden from performing CRUD operations.

### Phase 4: Integration

- Update Controllers and tRPC routers to import directly from the new domain services.
- Clean up `donation.service.ts` and eventually delete it.

## Verification

- Pre-requisite: Establish baseline test suite health.
- Post-refactoring: Run unit and integration tests for each domain.
- Verify UI flows (Donation Tracking, Zakat, Interest Cleansing).

## Domain Boundary Refactor Checklist (Completed June 2026)

- [x] **Phase 0: Safety & API**
  - [x] Extend `applyAllocations` signature in `interest-cleansing.service.ts` to accept `sourceBusinessId`.
  - [x] Remove the direct `voluntaryDonation` DB lookup from Interest domain service.
  - [x] Pass the returned `beneficiaryId` from client-side `addRow` to the `applyAllocations` mutation call.
  - [x] Add unit tests for `applyAllocations` verifying `sourceBusinessId` propagation.
- [x] **Phase 1: Consolidate Interest Domain**
  - [x] Migrate all interest cleansing service logic from `bank-interest` to `interest-cleansing` domain.
  - [x] Delete `src/server/services/bank-interest/` directory and update imports across all routes and tests.
- [x] **Phase 2: Replace remaining cross-domain reads**
  - [x] Create `getVoluntaryDonationTotalsByBeneficiary` API in `voluntary-donation.service.ts`.
  - [x] Create `getLinkedTransactionIds` API in `interest-cleansing.service.ts`.
  - [x] Refactor transaction utility `donation-utils.service.ts` and reporting service `donation-aggregator.service.ts` to consume domain services instead of direct Prisma tables queries.
- [x] **Phase 3: Backfill and Hardening**
  - [x] Create the `scripts/backfill-interest-source-business.sql` script to populate historical `InterestCleansing.sourceBusinessId`.
