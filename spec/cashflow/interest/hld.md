# Interest — Domain HLD

## Overview

This domain-level HLD captures shared architecture, data considerations, and cross-feature decisions for the `interest` domain. Individual features (interest-cleansing, cleansing-debit-linking, UI fixes, category-sync) remain in subfolders with their own `context.md` / `lld.md` as needed.

## Shared Models & Contracts

- Transactions: `Transaction` model (type, date, amount, description, bankAccountId, status, donationPayment)
- DonationPayment: `donationPurpose`, `transactionId` (nullable)
- Interest category: stored as configurable category name; features must reference configuration rather than hard-coded literals.

## Key Domain Decisions

1. Credit-anchored evidence model: Interest-cleansing remains M:N with credits as anchors and DEBITs as evidence references (via `DonationPayment.transactionId`).
2. No schema migrations at domain-level unless explicitly required and approved — prefer reuse of existing models.
3. Server-side scoring and ranking for candidate suggestions to ensure deterministic, auditable results.
4. Domain provides common helpers: text normalization, tokenization, and scoring utilities to avoid duplication across features.

## Shared Services & Utilities

- `src/server/services/bank-interest/interest-cleansing.service.ts` — canonical service for interest cleansing functions; add candidate retrieval here.
- `src/server/lib/matching/*` — domain helpers (normalizeText, trigram index helpers, fuzzyScore) reused by ledger and cleansing features.
- Telemetry events namespace: `interest.cleansing.*` (suggestionShown, suggestionAccepted, manualSearch).

## Performance & Limits

- Candidate suggestions should fetch a bounded superset (e.g., 200 rows) and compute scores in-memory, returning top N (default 20).
- Scoring must be CPU-light and rely on simple string/token operations; avoid expensive full-text compute on every request.

## Configurable Parameters

- `interest.cleansing.weights` (amount, date, desc, account) — initial defaults: { amount: 0.4, desc: 0.3, date: 0.2, account: 0.1 }
- `interest.cleansing.amountTolerance` — default relative tolerance for amount matching (e.g., 0.02 = 2%).
- `interest.cleansing.dateWindowDays` — default window for strong date score (e.g., 7 days).
- `interest.cleansing.maxCandidateFetch` — default 200.

## Security & Privacy

- Only return transactions for `ctx.session.user.id`.
- Do not expose internal scoring parameters except `scoreBreakdown` for explainability.

## Cross-Feature Interaction

- Transaction ledger matching and category-rule flows must not be altered by cleansing candidate work. Reuse `transaction-ledger` helpers for text normalization where possible.
- Ensure `buildTransactionWhere` early-return patterns remain intact for review batches.

## File Inventory (domain-level)

- `spec/cashflow/interest/context.md` ← this file
- `spec/cashflow/interest/hld.md` ← this file
- Subfolders: `interest-cleansing/`, `cleansing-debit-linking/`, `interest-cleansing-ui-fixes/`, `category-sync-fixes/`

## Implementation Roadmap

1. Add domain helpers and scoring utilities in `src/server/lib/matching`.
2. Implement `getCleansingDebitCandidates` in service layer and expose via tRPC.
3. Build `CleansingCandidatePicker` UI and integrate into `CleanseDonationDrawer`.
4. Run telemetry for 2–4 weeks, then tune weights and thresholds.
