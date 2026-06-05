# Interest Cleansing — Domain Context

## Purpose

This document provides the domain-level context for the `interest` featureset, focusing on the reviewer-facing interest-cleansing flow and the DEBIT evidence retrieval sub-phase. It captures user needs, constraints, and implementation-ready clarifications to guide the next-phase implementation (candidate picker + fuzzy matching).

## Problem Statement

Interest payouts (CREDIT transactions) are periodically received and may need to be "cleansed" by linking them to charitable DEBIT payments (donations). The existing flow surfaces a static list of unlinked DEBITs filtered by category and status; reviewers expect an interactive, credit-anchored candidate picker with fuzzy matching, confidence scores, and type-to-filter behaviour similar to the transaction-ledger reimbursement async-select UX.

Without a ranked, explainable candidate list reviewers spend time scanning transactions or performing manual searches, which increases errors and slows reconciliation.

## Users & Personas

- Reviewer (finance/admin): primary user who allocates interest credits to donation evidence. Wants fast, high-confidence suggestions and the ability to override/search manually.
- Power user: performs bulk allocations and values keyboard-driven search and precise matching controls.
- Auditor: requires an explainable trail (why a candidate was suggested) for compliance.

## Domain Dependencies

- See domain HLD and feature specs in this folder: [interest-cleansing](interest-cleansing/context.md), [cleansing-debit-linking](cleansing-debit-linking/context.md).
- Transaction models and DonationPayment contract in `prisma/schema.prisma` and server services under `src/server/services/bank-interest`.

## In-scope

- Implementing a credit-anchored candidate picker API that returns ranked DEBIT candidates with `score` and `scoreBreakdown` for the Cleanse Donation UI.
- UI: async search / type-to-filter, score badges, reason short-text, account/date filters, and manual search fallback.
- Linking: selecting a candidate sets `DonationPayment.transactionId` and uses the DEBIT's date/amount when recording the allocation.
- Server-side, explainable scoring algorithm (amount, date proximity, description similarity, account match) with configurable weights.
- Telemetry events to measure suggestion usefulness and tune weights.

## Out of scope

- Schema changes (none permitted).
- Multi-transaction linking beyond the canonical M:N credit-anchored model.
- Replacing the CREDIT-side allocation model — this is an evidence retrieval enhancement.

## Constraints & Non-Functional Requirements

- Only `CONFIRMED`, unlinked DEBIT transactions are eligible; eligibility must be determined by the configured interest category name (rename-safe).
- No schema migrations; use `DonationPayment.transactionId` for evidence mapping.
- Scoring must be deterministic, auditable, and return a `scoreBreakdown` suitable for UI display and telemetry.
- API responses should be limited (top N, default 20) and performant; server should fetch a bounded superset and score in-memory.

## UX Expectations — Reviewer Stories

- As a reviewer, when I open a CREDIT's Cleanse Drawer, I want to see ranked DEBIT candidates with a numeric confidence so I can accept the top suggestion quickly.
- As a reviewer, I want to type to filter and see results update interactively while preserving the score and a short reason why each candidate was suggested.
- As a reviewer, I want an obvious fallback to manual search or create-new-donation when no suitable candidates appear.

## Acceptance Criteria (high level)

- Drawer shows ranked candidates with `score` (0–100) and a short `reasonShort` explaining top contributors.
- Typing into search filters results (debounced) and updates the list; account/date filters apply server-side.
- Selecting a candidate updates `DonationPayment.transactionId` and the allocation uses the candidate's date and amount.
- Telemetry records suggestionShown, suggestionAccepted, manualSearch events for tuning.

## Success Metrics

- % of cleanses where top suggestion is accepted (target: 60%+ after tuning).
- Time-to-confirm median for a cleanse action (target: reduce by 30% vs static list).
- Manual-search rate (used to tune recall/precision trade-offs).

## Risks & Mitigations

- False positives (poor scoring) — mitigate by conservative default weights and an explicit manual-search fallback plus telemetry-driven weight tuning.
- Performance (scoring large result sets) — mitigate by limiting candidate fetch to a reasonable superset (e.g., 200 rows) then scoring and returning top N.

## Next Steps for Implementation

1. Implement `getCleansingDebitCandidates` service and tRPC route (credit-anchored, returns `score` and `scoreBreakdown`).
2. Add `CleansingCandidatePicker` frontend component and wire into `CleanseDonationDrawer` (debounced async search, `placeholderData` to prevent unmount when query changes).
3. Add unit tests for scoring and integration tests for drawer behaviour.
4. Feature-flag rollout and telemetry instrumentation to tune weights.

## References

- See sub-feature: [cleansing-debit-linking/context.md](cleansing-debit-linking/context.md)
- Transaction ledger patterns: `.ai/instructions/transaction-ledger-patterns.md`
