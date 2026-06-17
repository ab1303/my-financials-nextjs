# SpecialCategory

## Purpose
Provides a system-managed lookup of special transaction classifications such as Transfer or Excluded for UI display and classification workflows.

## Domain
Expenses

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Unique special category name. |
| description | String (`Text`) | No | Detailed description of the special category. |
| isActive | Boolean | No | Active flag; defaults to `true`. |
| isEditable | Boolean | No | Indicates whether users/admins can edit it; default `false`. |
| color | String | Yes | Optional UI badge color value. |
| createdAt | DateTime | No | Record creation timestamp. |

## Relationships
### Belongs To
- None

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `name`

## Notes
This table has no direct foreign-key relationships to other models. It is still actively used by settings UI and category-management code, so it is low-coupled rather than unused.