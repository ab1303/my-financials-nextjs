# Transactions (Import Pipeline) — Context

## Problem
The transactions import pipeline is the entry point for financial data (CSV/AI). It requires reliable classification, deduplication, and downstream write operations to `MonthlyExpenseSummary` and `IncomeRecord`.

## Architecture
- **Pipeline**: CSV/AI parsing -> Classification -> Dedup -> Confirm (Rollup writes).
- **Service Layer**: `src/server/services/ai-import/csv-classifier.service.ts` and `csv-confirm.service.ts`.
- **Status Management**: `ImportSession` tracks session state (PENDING -> COMPLETED/FAILED).

## Scope
- CSV import wizard.
- AI receipt/invoice import.
- LLM-based classification.
- Atomic writes to downstream summaries.
