# Interest Cleansing — Domain Context

## Purpose

This document provides the canonical domain-level context for the interest cleansing feature. This flow links bank "Credit Interest" (inbound transactions) to donor-related DEBIT transactions (donations) that act as evidence that the interest credit has been considered settled/cleansed.

## Problem Statement

Bank interest is received and must be "cleansed" by linking it to charitable DEBIT payments. Operations staff need a way to link credits to one or more DEBIT transactions, with support for ranked fuzzy matching (evidence suggestions), partial allocations, and auditing.

## Implementation Reality (Source of Truth)

The implementation relies on:
1. `getYearlyCleansingData`: Yearly calendar view for interest credits and liability data.
2. `getUnlinkedInterestTransactions`: Drawer list of eligible interest CREDITs.
3. `getCleansingDebitCandidates`: Fuzzy candidate picker for DEBIT evidence, returning ranked matches with `score` and `scoreBreakdown`.
4. `suggestAllocations` / `applyAllocations`: Core M:N allocation mechanics between Credits (anchors) and DEBIT evidence transactions (using `DonationPaymentEvidence` join model).
5. Category-based matching: Uses `Interest Cleansing` as the canonical category name, with `Bank Interest` as a legacy fallback.

## Key Constraints

- No schema migrations; use `DonationPaymentEvidence` model for linking.
- Scoring is server-side, deterministic, and auditable.
- Configuration-based category matching (rename-safe).

## Roadmap & Next Steps

1. Maintain `CleansingCandidatePicker` and its fuzzy matching logic.
2. Regularly tune matching weights via telemetry.
3. Keep UI consistent across drawer and main-panel integrations.
