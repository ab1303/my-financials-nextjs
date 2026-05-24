# IncomeRecord

## Purpose
Captures an individual income event, including when it was earned, how much it was for, its source classification, and an optional link back to an imported transaction.

## Domain
Income

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| dateEarned | DateTime | No | Date the income was earned. |
| amount | Decimal (`Money`) | No | Monetary amount earned. |
| incomeSourceId | String | No | Foreign key to the income source lookup. |
| incomeLedgerId | String | No | Foreign key to the parent income ledger. |
| transactionId | String | Yes | Optional one-to-one link to a staging transaction. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- IncomeSource (`incomeSourceId` → `IncomeSource.id`)
- IncomeLedger (`incomeLedgerId` → `IncomeLedger.id`)
- Transaction (`transactionId` → `Transaction.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `transactionId`
- Index on `[incomeLedgerId, dateEarned]`
- Foreign keys to `IncomeSource`, `IncomeLedger`, and `Transaction`

## Notes
`transactionId` enables reconciliation between imported bank activity and curated income records.