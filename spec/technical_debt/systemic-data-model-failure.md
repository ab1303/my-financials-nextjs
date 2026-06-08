# Systemic Technical Debt: Data Model Conflation & M:N Foundation Failure

## Systemic Issues
The application suffers from pervasive domain conflation due to an overloaded `DonationPayment` model and an incorrectly architected M:N evidence foundation. These architectural failures force application-level logic to act as a surrogate for missing database constraints and domain boundaries.

## Foundational Failure: DonationPayment M:N Mapping
The foundational mapping of `DonationPayment` to `Transaction` via `DonationPaymentEvidence` is architecturally unsound:
1.  **Improper Model Overloading:** The M:N evidence relationship is applied broadly across `VOLUNTARY` donations, `INTEREST_CLEANSING`, and `ZAKAT` without domain-specific separation. This forces the join table to handle wildly different financial lifecycles under a single schema, making it impossible to enforce domain invariants.
2.  **Structural Incoherence:** The system currently relies on both 1:1 FKs (e.g., `interestTxId`) and M:N join tables (`DonationPaymentEvidence`) for the same semantic purpose (attribution). This dual-structure creates a maintenance nightmare where the system cannot deterministically resolve the source of truth for an attribution.
3.  **Application-Layer Enforcement:** Because the data model does not enforce domain boundaries, the service layer is riddled with spaghetti code that attempts to reconcile these structures. Developers are forced to implement "fuzzy" logic to find links, leading to inconsistent application state and false positives/negatives (e.g., the ledger classification UX bug).

## Impact
*   **Domain Corruption:** The lack of strict boundaries means a bug or change in Interest Cleansing logic can inadvertently corrupt Donation or Zakat records.
*   **Maintenance Burden:** Any feature update in the charitable domain requires traversing a highly complex, non-standardized M:N web rather than interacting with a clean, domain-scoped API.
*   **UX Incoherence:** The Ledger UI is forced to guess transaction classification because the data model provides no authoritative source for attribution across the three distinct charitable purposes.
*   **Reporting Fragility:** Financial reports must perform expensive, complex queries across mismatched relationship structures, increasing the risk of reporting errors and performance bottlenecks.

## Required Remediation
1.  **Break the God Object:** Decompose `DonationPayment` into isolated domain models (`Donation`, `ZakatPayment`, `CleansingRecord`).
2.  **Standardize Attribution:** Abolish the M:N evidence pattern in favor of clean, purpose-specific, well-bounded relationships.
3.  **Explicit Domain Boundaries:** Remove all attempts by the Transaction Ledger to perform charitable attribution. The ledger must remain an immutable event store; attribution and status must be handled entirely within the domain-specific services that own the data.
