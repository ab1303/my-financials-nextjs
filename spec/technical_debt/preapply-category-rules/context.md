Feature: Pre-apply Category Rules Before LLM Classification

## Summary

Pre-apply user-defined category rules to parsed CSV transactions in-memory before sending unmatched transactions to the LLM classifier. The goal is to reduce LLM usage (tokens, latency) by deterministically categorising transactions that match explicit rules and only calling the LLM for the remainder.

## Motivation

- Reduce recurring costs from the LLM by filtering with cheap, deterministic rules first.
- Improve determinism and auditability for rule-matched transactions.
- Maintain current confirm/persist semantics and provide a safe rollout path.

## Scope

- Applies to the CSV import flow: `/api/transactions/csv/classify` (SSE) and the confirm/persist endpoint `/api/transactions/csv/confirm`.
- Add a shared rule-matcher used by both the pre-filter and the DB safety net.
- Surface pre-matched annotations to the client UI so users can review/override before confirm.

## Phases

- Phase 1 (MVP): In-memory pre-apply + UI annotations only. Pre-matches are streamed to the client as `preMatch` and can be reviewed/overridden. Do NOT persist `appliedRuleId` to the main `transaction` table in this phase — instead, include annotations in the confirm payload and/or persist them to `importSession.metadata` if necessary for auditing.
- Phase 2 (Provenance persistence): Optional follow-up where we add a persistent provenance field (`metadata.appliedRuleId` or a dedicated `appliedRuleId` column) and stop relying on `importSession.metadata` for provenance. This phase may require a Prisma migration and schema changes and should be scheduled separately.

## Out of scope

- Replacing existing DB-side `runCategoryRules` behaviour immediately. The DB job remains as a safety net but will be adjusted to respect provenance.

## Success criteria

- Measured reduction in LLM tokens per import for typical CSVs (target >30% savings for rule-heavy users).
- Parity between pre-filtered rule matches and DB job results (unit tests pass).
- No loss of auditability: persisted transactions record applied rule provenance.
- No loss of auditability: (Phase 2) persisted transactions record applied rule provenance when the schema migration is executed.
