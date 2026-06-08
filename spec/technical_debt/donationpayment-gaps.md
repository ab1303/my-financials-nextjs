# UI / UX / Data Model Gaps — Old -> New Design

This document lists gaps and required changes to ensure a no-regression migration from the legacy `DonationPayment` model to the split domain models.

1. API DTO shape

- Gap: frontend expects `transactionId` field for some donation rows (interest credits). New models use `creditTxId` or evidence arrays.
- Mitigation: server DTOs must map: `transactionId` := `creditTxId` for `InterestCleansing`; for Voluntary/Zakat, if the UX expects a single `transactionId`, return the first evidence.transactionId or `null`.

2. Beneficiary identity

- Gap: `DonationPayment` stored `businessId` OR `individualId`. New models keep same fields but ensure controllers still return `beneficiaryId` consistently.
- Mitigation: DTO mappers must prefer `businessId` when `beneficiaryType` is `BUSINESS`, else `individualId`.

3. Ledger reads

- Gap: ledger UI reads `Transaction` for the main list and calls donation endpoints for detail. No change required if `Transaction` remains authoritative and donation detail endpoints map new models into the old detail shape.

4. Interest-cleansing UX flows

- Gap: `applyAllocations` currently relies on `interestTxId` on `DonationPayment`. New model stores `creditTxId` on `InterestCleansing`.
- Mitigation: update service functions (`applyAllocations`, `suggestAllocations`, `getUnlinkedInterestTransactions`) to query `InterestCleansing.creditTxId` and `InterestCleansingEvidence` appropriately. Keep API responses unchanged.

5. Zakat obligation mapping

- Gap: `DonationPayment.donationLedgerId` is used for donations; Zakat has `ZakatObligation` structure. Ensure mapping between `donationLedgerId` and `zakatObligationId` for backfill.
- Mitigation: Backfill script should attempt a 1:1 mapping; log fails.

6. Tax/deductibility

- Gap: `isDeductible` was computed via `business.isDgrRegistered`. New model does not change this — ensure DTO includes `isDeductible` computed at read-time.

7. Evidence deletion behaviour

- Gap: legacy code clears `interestTxId` on `DonationPayment` when all evidence removed. New behaviour should: when removing all `InterestCleansingEvidence` for a given `InterestCleansing`, clear `creditTxId`.

8. Edge cases and ambiguous rows

- Ambiguous rows: donation rows with incorrect purpose or missing evidence. Backfill should flag these for manual review and keep legacy data until resolved.

9. Performance

- New joins across per-purpose evidence tables may require adding indexes (transactionId, donationLedgerId). Add them in migrations.

Conclusion

- All gaps are solvable on the server side without frontend changes by mapping new models to the old DTO shapes, preserving field names and API contracts.
