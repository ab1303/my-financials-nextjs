# BankInterestPayment

## Purpose
Stores historical bank-interest cleansing payments tied to a bank and, optionally, a bank-interest liability. This table remains in the schema for backward compatibility while the application migrates to `DonationPayment` with purpose `INTEREST_CLEANSING`.

## Domain
Philanthropy

## Status
Deprecated

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| datePaid | DateTime | No | Date the payment was made. |
| amount | Decimal (`Money`) | No | Payment amount. |
| businessId | String | Yes | Optional foreign key to the recipient business. |
| bankInterestLiabilityId | String | Yes | Optional foreign key to the related liability. |

## Relationships
### Belongs To
- Business (`businessId` → `Business.id`, optional)
- BankInterestLiability (`bankInterestLiabilityId` → `BankInterestLiability.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Foreign keys to `Business` and `BankInterestLiability`

## Notes
Schema comments mark this table as deprecated and state existing rows were migrated to `DonationPayment(INTEREST_CLEANSING)`. Drift exists because active tRPC router, service, controller, schema, UI pages, and cleanup script still reference it.