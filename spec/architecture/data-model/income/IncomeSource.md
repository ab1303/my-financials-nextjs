# IncomeSource

## Purpose
Stores the master lookup of income source names, such as Salary or Freelance, used to classify detailed income records.

## Domain
Income

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Unique income source name. |
| description | String | Yes | Optional source description. |
| isActive | Boolean | No | Active flag; defaults to `true`. |
| createdAt | DateTime | No | Record creation timestamp. |

## Relationships
### Belongs To
- None

### Has Many
- IncomeRecord

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `name`

## Notes
The schema defines `name` as globally unique rather than user-scoped.