# Cleansing Donations — DEBIT Evidence Retrieval

## Purpose
Provides a fuzzy candidate picker API and UI that surface candidate DEBIT transactions for reviewer allocation.

## Architecture & Data Flow
Linking DEBIT evidence to interest credits uses purpose-specific evidence tables (e.g., `InterestCleansingEvidence`).

## Call Flow
```mermaid
sequenceDiagram
  participant UI as CleansingCandidatePicker
  participant TRPC as bankInterest.getCleansingDebitCandidates
  participant Service as getCleansingDebitCandidates()
  participant DB as Transaction / Evidence tables

  UI->>TRPC: Request candidates
  TRPC->>Service: Call scoring service
  Service->>DB: Query/Score matches
  DB-->>Service: DEBIT data
  Service-->>TRPC: Candidate[]
  TRPC-->>UI: UI renders list
```
