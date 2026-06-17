# StockHolding

## Purpose
Represents an individual stock position recorded within a portfolio snapshot, including quantity, valuation, lifecycle, and investment-horizon details.

## Domain
Portfolio

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| ticker | String | No | Market ticker symbol. |
| companyName | String | No | Company or issuer name. |
| quantity | Decimal | No | Quantity currently held in the snapshot. |
| buyPrice | Decimal (`Money`) | No | Purchase price per unit or position basis value. |
| buyDate | DateTime | Yes | Original buy date. |
| currentPrice | Decimal (`Money`) | No | Current market price at snapshot time. |
| currency | CurrencyEnumType | No | Holding currency, such as `AUD` or `USD`. |
| plannedTerm | InvestmentTermEnumType | No | Planned investment term. |
| salePrice | Decimal (`Money`) | Yes | Sale price if disposed. |
| saleDate | DateTime | Yes | Sale date if disposed. |
| soldQuantity | Decimal | Yes | Quantity already sold. |
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
- Index on `[snapshotId]`
- Index on `[accountId]`
- Index on `[ticker]`
- Foreign keys to `FinancialAccount` and `PortfolioSnapshot`

## Notes
This model supports both active and partially or fully sold positions within a snapshot history.