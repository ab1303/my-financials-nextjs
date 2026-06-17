# Interest Cleansing — High-Level Design (HLD)

## Architecture

| Decision | Implementation |
| :--- | :--- |
| M:N Model | `InterestCleansing` (Credit) + `InterestCleansingEvidence` (Debit evidence) |
| Fuzzy Matching | `getCleansingDebitCandidates()` |
| Server-side Scoring | Deterministic weight-based scoring |

## Process Flow
```mermaid
graph TD
    A[Reviewer] --> B[Load Monthly Credits]
    B --> C{Select Credit}
    C --> D[Open Evidence Picker]
    D --> E[getCleansingDebitCandidates]
    E --> F[Display Ranked DEBITs]
    F --> G{Select DEBITs}
    G --> H[ApplyAllocations: Create Evidence]
```
