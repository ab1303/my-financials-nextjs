# Interest Cleansing — High-Level Design (HLD)

## Overview
Interest cleansing links bank "Credit Interest" (Inbound) to donation DEBIT transactions (Outbound).

## Architecture
- **Models**: `InterestCleansing` (Credit), `InterestCleansingEvidence` (Debit evidence join).
- **Service**: `applyAllocations()` handles M:N linking logic.
- **Reporting**: Interest totals summarized alongside voluntary/Zakat donations.
