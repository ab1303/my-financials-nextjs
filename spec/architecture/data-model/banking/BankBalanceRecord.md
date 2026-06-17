# BankBalanceRecord

## Purpose
Stores the balance of a single financial account at one snapshot date, creating the detailed rows underneath a bank balance snapshot header.

## Domain
Banking

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| balance | Decimal (`Money`) | No | Account balance at snapshot time. |
| accountId | String | No | Foreign key to the financial account. |
| snapshotId | String | No | Foreign key to the parent balance snapshot. |
| importImageId | String | Yes | Optional imported file/image that produced the record. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- FinancialAccount (`accountId` → `FinancialAccount.id`)
- BankBalanceSnapshot (`snapshotId` → `BankBalanceSnapshot.id`)
- ImportImage (`importImageId` → `ImportImage.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[accountId, snapshotId]`
- Index on `[snapshotId]`
- Foreign keys to `FinancialAccount`, `BankBalanceSnapshot`, and `ImportImage`

## Notes
A snapshot can contain many account balance records, but each account may appear only once per snapshot.