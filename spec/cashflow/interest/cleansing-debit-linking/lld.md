# Cleansing Donations — DEBIT Transaction Linking (LLD)

## Service Mapping

| Goal | Service/Action |
|---|---|
| Get Candidates | `getCleansingDebitCandidates()` |
| Apply Link | `applyAllocations()` |

## Scoring & API
- Scoring: Weighted fuzzy match based on amount, date, description, and account.
- tRPC: `bankInterest.getCleansingDebitCandidates` returns `Candidate[]`.
