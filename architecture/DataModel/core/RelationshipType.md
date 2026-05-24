# RelationshipType

## Purpose
Provides a user-managed lookup of relationship labels, such as Mother or Spouse, that can be attached to `Individual` records for classification and reporting.

## Domain
Core

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Relationship label. |
| userId | String | No | Owner user foreign key. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- Individual

## Indexes & Constraints
- Primary key on `id`
- Composite unique constraint on `[name, userId]`
- Foreign key to `User`

## Notes
This is a scoped lookup table; users can maintain their own relationship taxonomy independently.