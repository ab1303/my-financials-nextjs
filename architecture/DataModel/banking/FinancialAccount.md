# FinancialAccount

## Purpose
Represents a user's specific bank or brokerage account and provides the anchor point for transactions, balance snapshots, holdings, and transfer-matching rules.

## Domain
Banking

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | User-facing account name. |
| institutionId | String | No | Foreign key to the institution/business. |
| userId | String | No | Owner user foreign key. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- Business (`institutionId` → `Business.id`)
- User (`userId` → `User.id`)

### Has Many
- BankBalanceRecord
- StockHolding
- BrokerageCashBalance
- Transaction
- TransferMatchRule (debit account)
- TransferMatchRule (credit account)

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[name, institutionId, userId]`
- Index on `[userId, institutionId]`
- Foreign keys to `Business` and `User`

## Notes
This is the shared account dimension for both banking and brokerage workflows.