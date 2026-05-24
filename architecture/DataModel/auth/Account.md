# Account

## Purpose
Stores OAuth provider account links for NextAuth so an application user can authenticate with external identity providers while remaining mapped to a single internal user record.

## Domain
Auth

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| userId | String | No | Foreign key to the owning user. |
| type | String | No | Account type reported by NextAuth/provider. |
| provider | String | No | OAuth provider name, such as Google. |
| providerAccountId | String | No | Provider-side unique account identifier. |
| refresh_token | String (`Text`) | Yes | OAuth refresh token. |
| access_token | String (`Text`) | Yes | OAuth access token. |
| expires_at | Int | Yes | Access token expiry as epoch seconds. |
| token_type | String | Yes | OAuth token type. |
| scope | String | Yes | Granted OAuth scopes. |
| id_token | String (`Text`) | Yes | OpenID Connect ID token. |
| session_state | String | Yes | Provider session state value. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `[provider, providerAccountId]`
- Foreign key to `User`

## Notes
This is a standard NextAuth account-link table used only for external identity provider mappings.