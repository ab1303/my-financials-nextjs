# MerchantCategoryMap

## Purpose
Stores a per-user mapping from normalized transaction descriptions to expense category names so AI-assisted classification can be reused and overridden over time.

## Domain
Import/AI

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| userId | String | No | Owner user foreign key. |
| description | String | No | Lowercased, trimmed transaction description. |
| category | String | No | Expense category name to assign. |
| source | String | No | Mapping source such as `llm_confirmed` or `user_override`. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[userId, description]`
- Index on `[userId]`
- Foreign key to `User`

## Notes
This table is a user-specific classification memory used to improve future categorization accuracy.