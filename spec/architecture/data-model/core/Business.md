# Business

## Purpose
Represents an organisation, such as a bank, charity, or brokerage, that participates in the user's financial activity and may serve as an institution or payment beneficiary.

## Domain
Core

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Organisation name. |
| addressLine | String | Yes | Freeform address line. |
| streetAddress | String | Yes | Street address. |
| suburb | String | Yes | Suburb or locality. |
| postcode | Int | Yes | Postal code. |
| state | String | Yes | State or region. |
| type | BusinessEnumType | Yes | Business type such as `BANK`, `PHILANTHROPY`, or `BROKERAGE`. |
| userId | String | Yes | Optional owner user; null allows global/admin-managed institutions. |

## Relationships
### Belongs To
- User (`userId` → `User.id`, optional)

### Has Many
- FinancialAccount
- ZakatPayment
- DonationPayment
- BankInterestLiability
- BankInterestPayment

## Indexes & Constraints
- Primary key on `id`
- Optional foreign key to `User`

## Notes
A null `userId` indicates a shared/global institution record rather than a user-specific one.