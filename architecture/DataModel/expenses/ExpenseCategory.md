# ExpenseCategory

## Purpose
Stores the system-managed expense category taxonomy used to classify monthly expense summaries and drive expense reporting and UI presentation.

## Domain
Expenses

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Unique expense category name. |
| description | String | Yes | Optional category description. |
| iconName | String | Yes | UI icon identifier. |
| isActive | Boolean | No | Active flag; defaults to `true`. |
| createdAt | DateTime | No | Record creation timestamp. |

## Relationships
### Belongs To
- None

### Has Many
- MonthlyExpenseSummary

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `name`

## Notes
This is a system-managed lookup rather than a user-owned table.