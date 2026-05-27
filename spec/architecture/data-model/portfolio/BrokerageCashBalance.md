# BrokerageCashBalance

## Purpose
Stores idle cash balances by brokerage account and currency for a specific portfolio snapshot date.

## Domain
Portfolio

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| amount | Decimal (`Money`) | No | Cash amount held. |
| currency | CurrencyEnumType | No | Currency of the balance, such as `AUD` or `USD`. |
| accountId | String | No | Foreign key to the brokerage account. |
| snapshotId | String | No | Foreign key to the parent portfolio snapshot. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- FinancialAccount (`accountId` → `FinancialAccount.id`)
- PortfolioSnapshot (`snapshotId` → `PortfolioSnapshot.id`)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[accountId, currency, snapshotId]`
- Index on `[snapshotId]`
- Index on `[accountId]`
- Foreign keys to `FinancialAccount` and `PortfolioSnapshot`

## Notes
The composite uniqueness ensures only one cash balance per account/currency within a single snapshot.