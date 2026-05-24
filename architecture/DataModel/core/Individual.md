# Individual

## Purpose
Represents a person known to the user, such as a family member, friend, or beneficiary, for donations and zakat payments and other user-managed relationship-based records.

## Domain
Core

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Full display name for the person. |
| firstName | String | Yes | Given name. |
| lastName | String | Yes | Family name. |
| relationshipId | String | Yes | Optional foreign key to a user-defined relationship type. |
| addressLine | String | Yes | Freeform address line. |
| streetAddress | String | Yes | Street address. |
| suburb | String | Yes | Suburb or city locality. |
| postcode | Int | Yes | Postal code. |
| state | String | Yes | State or region. |
| addressFormat | String | Yes | Address formatting style; default `AU`. |
| userId | String | No | Owner user foreign key. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)
- RelationshipType (`relationshipId` → `RelationshipType.id`)

### Has Many
- ZakatPayment
- DonationPayment

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[name, userId]`
- Foreign keys to `User` and `RelationshipType`

## Notes
Individuals are user-scoped lookup entities and can act as philanthropic beneficiaries.