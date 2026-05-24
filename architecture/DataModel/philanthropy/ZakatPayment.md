# ZakatPayment

## Purpose
Captures a single zakat disbursement to either an individual or business beneficiary and optionally links it back to the originating transaction.

## Domain
Philanthropy

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| datePaid | DateTime | No | Date the payment was made. |
| amount | Decimal (`Money`) | No | Payment amount. |
| beneficiaryType | BeneficiaryEnumType | No | Indicates whether the beneficiary is an individual or business. |
| businessId | String | Yes | Optional foreign key when beneficiary is a business. |
| individualId | String | Yes | Optional foreign key when beneficiary is an individual. |
| zakatObligationId | String | No | Foreign key to the parent zakat obligation. |
| transactionId | String | Yes | Optional one-to-one link to a transaction. |

## Relationships
### Belongs To
- Business (`businessId` → `Business.id`, optional)
- Individual (`individualId` → `Individual.id`, optional)
- ZakatObligation (`zakatObligationId` → `ZakatObligation.id`)
- Transaction (`transactionId` → `Transaction.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `transactionId`
- Foreign keys to `Business`, `Individual`, `ZakatObligation`, and `Transaction`

## Notes
Exactly one beneficiary path is expected per row based on `beneficiaryType`.