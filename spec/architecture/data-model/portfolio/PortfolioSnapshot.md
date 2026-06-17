# PortfolioSnapshot

## Purpose
Stores a point-in-time portfolio snapshot header for a user, grouping equity holdings and brokerage cash balances captured on the same date.

## Domain
Portfolio

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| snapshotDate | DateTime | No | Date of the portfolio snapshot. |
| usdToAudRate | Decimal | Yes | USD to AUD exchange rate captured at snapshot time. |
| userId | String | No | Owner user foreign key. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- StockHolding
- BrokerageCashBalance

## Indexes & Constraints
- Primary key on `id`
- Index on `[userId, snapshotDate]`
- Foreign key to `User`

## Notes
The optional FX rate supports consolidated valuation of USD-denominated portfolio positions.