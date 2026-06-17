# Cleansing — DEBIT Candidate Picker (Context)

## Purpose
This feature provides a credit-anchored, fuzzy candidate picker for DEBIT evidence used in interest-cleansing. It replaces static lists with an interactive, ranked suggestion UI.

## Architecture
- **API**: `bankInterest.getCleansingDebitCandidates` (tRPC).
- **Service**: `getCleansingDebitCandidates()` in `src/server/services/bank-interest/interest-cleansing.service.ts`.
- **UI**: `CleansingCandidatePicker` integrated into the Interest Cleansing workflow.
- **Persistence**: Matches are linked via purpose-specific evidence tables (e.g., `InterestCleansingEvidence`) using `transactionId`.

## Scope
- Backend: Ranked candidate API returning fuzzy matches.
- Frontend: `CleansingCandidatePicker` component (debounced search, scoring badges, account/date filters).
- Linking: Confirmation writes records to `InterestCleansingEvidence`.

## Constraints
- Only `CONFIRMED`, unlinked DEBITs filtered by interest category are eligible.
- Scoring is server-side, deterministic, and auditable.
