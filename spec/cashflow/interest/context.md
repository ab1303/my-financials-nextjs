# Interest Cleansing — Domain Context

## Purpose
Links bank "Credit Interest" to donor-related DEBIT transactions (evidence) to demonstrate settlement.

## Implementation (Source of Truth)
- `getYearlyCleansingData()`: Yearly overview.
- `getCleansingDebitCandidates()`: Fuzzy candidate picker API.
- `suggestAllocations()` / `applyAllocations()`: M:N allocation mechanics.
- Persistence: `InterestCleansing` + `InterestCleansingEvidence` models.
