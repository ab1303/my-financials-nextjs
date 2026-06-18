# Donation → Interest Cleansing: Domain Boundary Refactor

Status: Draft
Owner: Engineering
Date: 2026-06-18

## Purpose

Document a prioritized, actionable refactor plan to remove domain-boundary leakage between the Donations domain (`VoluntaryDonation`) and Interest Cleansing domain (`InterestCleansing`). This file captures audit findings, gaps, and a phased remediation plan with concrete file-level tasks and acceptance criteria.

## Background

- The UI drawer used to "Confirm allocation" is part of the Donations UX and persists a `VoluntaryDonation` (purpose `INTEREST_CLEANSING`).
- The Interest Cleansing flow creates/updates `InterestCleansing` records and links evidence to interest credit transactions for reporting and matching.
- A stopgap change temporarily introduced a direct DB read from the Interest domain into `voluntaryDonation` to copy beneficiary info. That creates a cross-domain coupling and violates our domain boundaries.

## Audit findings (gaps / evidence)

- Cross-domain DB read in interest code:
  - `tx.voluntaryDonation.findFirst(...)` in `src/server/services/bank-interest/interest-cleansing.service.ts` — reads donations table from interest domain.
- Duplicate/split responsibilities:
  - Heavy interest logic exists in `src/server/services/bank-interest/interest-cleansing.service.ts` while a separate `src/server/services/interest-cleansing/interest-cleansing.service.ts` exposes overlapping CRUD methods.
- Transactions/Reporting mix domain-level APIs and direct DB reads:
  - `src/server/services/transactions/donation-utils.service.ts` mixes calls to `voluntary-donations` API and direct `prisma.interestCleansingEvidence` queries.
  - `src/server/services/reporting/donation-aggregator.service.ts` calls `prisma.voluntaryDonation.findMany(...)` directly.
- Client→Server mismatch:
  - Drawer `addRow` persists `VoluntaryDonation` but the subsequent `applyAllocations` call does not pass the beneficiary id; backend looked up the donation to obtain the beneficiary.

## Goals / Acceptance Criteria

- No Interest domain code performs direct reads/writes on Donations primary tables.
- `VoluntaryDonation` persistence remains canonical and isolated to `src/server/services/voluntary-donations`.
- `InterestCleansing` records created from donations must receive beneficiary info via parameters or domain-read API (not by direct DB read from interest service).
- Reporting and transaction helpers call domain read APIs (or orchestration layer) rather than reading other domains' tables directly.
- Drawer flow consistently passes beneficiary id to interest APIs; `InterestCleansing.sourceBusinessId` is populated for drawer-created records.

## Phased Remediation Plan

Phase 0 — Safety & API (Immediate, low-risk)

- 0.1 Add/read API: Extend `voluntary-donations` service with `getByTransactionId(transactionId)` (read-only DTO).
  - File: `src/server/services/voluntary-donations/voluntary-donation.service.ts` (export new function)
  - Deliverable: stable API returning beneficiaryId/beneficiaryType
  - Est: 2–4h

- 0.2 Client pass-through: Update drawer client to pass beneficiary id returned by `addRow` into `applyAllocations` call.
  - File: `src/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/useCleanseDonationState.ts`
  - Est: 1–2h

- 0.3 tRPC + service input: Extend `applyAllocations` tRPC input (and service signature) to accept `sourceBusinessId` (optional) and persist on create; remove `tx.voluntaryDonation.findFirst(...)` lookup.
  - Files: `src/server/trpc/router/bank-interest.ts`, `src/server/services/bank-interest/interest-cleansing.service.ts` (or migrate into `interest-cleansing` domain service)
  - Est: 2–4h

Acceptance for Phase 0: After change, no direct `prisma.voluntaryDonation.*` reads from interest service; drawer-created interest rows have `sourceBusinessId`.

Phase 1 — Consolidate Interest Domain (Medium)

- 1.1 Consolidate interest business logic into `src/server/services/interest-cleansing/` (move scoring, applyAllocations, suggestAllocations, getYearlyCleansingData).
  - Files: migrate/merge `bank-interest/interest-cleansing.service.ts` content into `interest-cleansing/interest-cleansing.service.ts` and keep `bank-interest` router thin.
  - Est: 1–2d

- 1.2 Update routers to call consolidated service and add unit tests in `src/__tests__/unit/interest-cleansing*`.
  - Est: 1d

Acceptance for Phase 1: Single domain owning interest logic; tests updated and passing.

Phase 2 — Replace remaining cross-domain reads (Medium)

- 2.1 Replace `prisma.voluntaryDonation` direct reads in reporting/transactions with domain read API calls or the orchestration layer.
  - Files: `src/server/services/reporting/donation-aggregator.service.ts`, `src/server/services/transactions/donation-utils.service.ts`.
  - Est: 1–2d

- 2.2 Introduce orchestration/read-only reporting service that composes domain APIs.
  - Files: `src/server/services/reporting/*`
  - Est: 1d

Phase 3 — Backfill and Hardening (Low)

- 3.1 Data migration/backfill script to populate `InterestCleansing.sourceBusinessId` where missing using voluntary donations with matching `transactionId`.
  - Files: `scripts/backfill-interest-source-business.ts` or SQL in `scripts/`.
  - Est: 0.5–1d

- 3.2 Add integration tests and update `spec/cashflow/donations/refactoring-plan.md` with final inventory and PR checklist.
  - Est: 1–2d

## PR Strategy

- Make small, reviewable PRs per phase/subtask:
  - PR A: Phase 0 (API + client + router + service small changes). Keep backwards-compatible where possible.
  - PR B: Consolidation (Phase 1) — larger, but split into logical sub-PRs (move, rename, wire up router).
  - PR C: Replace cross-domain reads + reporting orchestration.
  - PR D: Backfill script + tests + docs.

Each PR must include:

- `pnpm run type-check` and `pnpm run lint` passed locally.
- Unit tests added/updated for changed behavior.
- A short migration note if DB changes are required.

## Risk & Mitigations

- Risk: Tests and consumers still import legacy modules → CI failures.
  - Mitigation: Add deprecation shims in the old modules that forward to new APIs for a short time, include tests.
- Risk: Backfill might be incomplete or ambiguous.
  - Mitigation: Create idempotent backfill script and run in staging first; provide audit output.

## Next immediate tasks (pick one)

1. Implement Phase 0 end-to-end (recommended immediate): add read API, update client to pass beneficiary, update `applyAllocations` signature and remove cross-domain lookup.
2. Begin Phase 1 consolidation by moving `applyAllocations` and related functions into `interest-cleansing` service and updating routers.

## Links / Evidence (code references)

- Interest service (stopgap read): `src/server/services/bank-interest/interest-cleansing.service.ts`
- Drawer writer: `src/app/(authorized)/cashflow/donations/actions.ts`
- Drawer state: `src/app/(authorized)/cashflow/bank-interest/_components/cleanse-drawer/useCleanseDonationState.ts`
- Voluntary donation service: `src/server/services/voluntary-donations/voluntary-donation.service.ts`
- Donation utils/transactions mix: `src/server/services/transactions/donation-utils.service.ts`
- Reporting aggregator: `src/server/services/reporting/donation-aggregator.service.ts`

---

_Created by code audit on 2026-06-18._
