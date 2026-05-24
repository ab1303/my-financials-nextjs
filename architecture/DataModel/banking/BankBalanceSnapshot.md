# BankBalanceSnapshot

## Purpose
Stores a point-in-time snapshot header for a user's bank balances on a given date so individual account balances can be grouped under one snapshot event.

## Domain
Banking

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| snapshotDate | DateTime | No | Date of the balance snapshot. |
| userId | String | No | Owner user foreign key. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- BankBalanceRecord

## Indexes & Constraints
- Primary key on `id`
- Index on `[userId, snapshotDate]`
- Foreign key to `User`

## Notes
The snapshot header pattern prevents repeated storage of snapshot-level metadata for each account balance row.