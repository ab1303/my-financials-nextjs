# User

## Purpose
Represents an application user and their profile, preferences, authentication data, and ownership boundary for most user-scoped financial records in the platform.

## Domain
Auth

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | Yes | Display name. |
| email | String | Yes | User email address. |
| emailVerified | DateTime | Yes | Timestamp when email was verified. |
| image | String | Yes | Profile image URL. |
| password | String | No | Stored password hash. |
| role | RoleEnumType | Yes | Authorization role; default `user`. |
| phone | String | Yes | Contact phone number. |
| bio | String | Yes | User biography or notes. |
| timezone | String | Yes | Preferred timezone; default `Australia/Sydney`. |
| linkedInUrl | String | Yes | LinkedIn profile URL. |
| preferredCurrency | CurrencyEnumType | Yes | Preferred reporting currency; default `AUD`. |
| fiscalYearType | CalendarEnumType | Yes | Preferred year mode; default `FISCAL`. |
| avatarStorageUrl | String | Yes | External avatar object URL. |
| avatarStorageProvider | StorageProviderEnum | Yes | Avatar storage provider. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- None

### Has Many
- Account
- Session
- Individual
- Business
- RelationshipType
- IncomeLedger
- ExpenseLedger
- FinancialAccount
- BankBalanceSnapshot
- PortfolioSnapshot
- ImportSession
- ImportImage
- AIUsageLog
- MerchantCategoryMap
- Transaction
- TransferMatchRule

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `email`

## Notes
`User` is the main tenancy boundary for the application. Most operational tables are directly or indirectly owned by a user.