# DonationPayment

## Purpose
Captures a single donation payment, including voluntary giving, zakat-related disbursements, and bank-interest cleansing donations, with optional transaction reconciliation.

## Domain
Philanthropy

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| datePaid | DateTime | No | Date the donation was paid. |
| amount | Decimal (`Money`) | No | Donation amount. |
| beneficiaryType | BeneficiaryEnumType | No | Indicates whether the beneficiary is an individual or business. |
| taxCategory | String | No | Tax/reporting category for the donation. |
| businessId | String | Yes | Optional foreign key when beneficiary is a business. |
| individualId | String | Yes | Optional foreign key when beneficiary is an individual. |
| donationLedgerId | String | No | Foreign key to the parent donation ledger. |
| transactionId | String | Yes | Optional one-to-one link to a transaction. |
| donationPurpose | DonationPurposeEnum | No | Purpose of the payment; default `VOLUNTARY`. |

## Relationships
### Belongs To
- Business (`businessId` → `Business.id`, optional)
- Individual (`individualId` → `Individual.id`, optional)
- DonationLedger (`donationLedgerId` → `DonationLedger.id`)
- Transaction (`transactionId` → `Transaction.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `transactionId`
- Foreign keys to `Business`, `Individual`, `DonationLedger`, and `Transaction`

## Notes
`donationPurpose` is important for distinguishing normal donations from interest-cleansing and zakat-related flows.