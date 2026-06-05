# Cleansing — DEBIT Candidate Picker (Context)

## Purpose

This feature provides a credit-anchored, fuzzy candidate picker for DEBIT evidence used in the interest-cleansing flow. It aims to replace the static unlinked-DEBIT list with an interactive, ranked, and explainable suggestion UI so reviewers can accept high-confidence matches quickly or search manually when needed.

## Problem

Reviewers currently see an unranked list of unlinked DEBITs when allocating an interest CREDIT. They need a faster, more accurate way to find matching donation payments: an async, type-to-filter picker that returns ranked candidates with confidence scores and short explanations.

## In Scope

- Backend: credit-anchored candidate API returning ranked DEBITs with `score` and `scoreBreakdown`.
- Frontend: `CleansingCandidatePicker` component integrated into `CleanseDonationDrawer` (async search, badges, highlighted tokens, account/date filters).
- Linking: selection writes `DonationPayment.transactionId` and uses candidate date/amount for allocation.

## Out of Scope

- Schema changes.
- Multi-transaction linking beyond the canonical model.

## Constraints

- Only `CONFIRMED`, unlinked DEBITs filtered by configured interest category are eligible.
- Server-side scoring must be deterministic and auditable; return a `reasonShort` and `scoreBreakdown` for UI.

## Acceptance Criteria

- Picker returns top N ranked candidates for a given `creditId`.
- UI displays `score` (0–100), `reasonShort`, and highlighted query matches.
- Confirming a candidate sets `DonationPayment.transactionId` and records allocation using candidate date/amount.

## Implementation Plan (next steps)

1. Backend: add `getCleansingDebitCandidates` helper in `src/server/services/bank-interest/interest-cleansing.service.ts`.
   - Query: fetch bounded superset of eligible DEBITs (CONFIRMED, category = configured interest category, donationPayment null).
   - Score: implement server-side scoring using `amount`, `date`, and `description` tokens; return `score`, `scoreBreakdown`, and `reasonShort`.
   - Tests: unit tests for scoring and candidate filtering in `src/__tests__/unit/services/bank-interest/`.

2. API: expose a tRPC procedure `getCleansingDebitCandidates` in `src/server/trpc/router/bank-interest.ts` with zod validation and `limit`/`minScore` parameters.

3. Frontend: implement `CleansingCandidatePicker` component and integrate into `CleanseDonationDrawer`.
   - Behavior: debounce searches, use `placeholderData` to avoid unmount, show `score` badges and `reasonShort`.
   - Interaction: selecting a candidate calls existing `addRow` / `applyAllocations` flow without changing their contract.

4. Tests & rollout: add unit tests and a small integration test for the drawer; feature-flag the new picker and add telemetry events for tuning weights.

5. Review: open a small PR with backend + tests first, then follow with frontend wiring in a separate PR to keep changes reviewable.
