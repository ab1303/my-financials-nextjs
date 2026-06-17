# Session

## Purpose
Persists NextAuth session records so authenticated users can keep an active application session across requests until the session token expires.

## Domain
Auth

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| sessionToken | String | No | Unique opaque token used to identify the session. |
| expires | DateTime | No | Session expiration timestamp. |
| userId | String | No | Foreign key to the signed-in user. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `sessionToken`
- Foreign key to `User`

## Notes
This is a standard NextAuth session store table.