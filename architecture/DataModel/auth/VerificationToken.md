# VerificationToken

## Purpose
Stores email verification tokens used by NextAuth flows for proving control of an email address before completing authentication-related operations.

## Domain
Auth

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| identifier | String | No | Identifier for the token owner, typically an email address. |
| token | String | No | Unique verification token value. |
| expires | DateTime | No | Expiration timestamp for the token. |

## Relationships
### Belongs To
- None

### Has Many
- None

## Indexes & Constraints
- Unique constraint on `token`
- Composite unique constraint on `[identifier, token]`

## Notes
This is a standard NextAuth verification table and does not reference `User` directly.