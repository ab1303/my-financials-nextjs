# IncomeSource

## Purpose
Master lookup of income source names (Salary, Freelance, etc.) used for taxonomy and UI categorization of income transactions. **Not a container for income records** — serves as a vocabulary for category assignment only.

## Domain
Income

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| name | String | No | Unique income source label (e.g., "Salary", "Freelance", "Rental"). |
| description | String | Yes | Optional source description. |
| isActive | Boolean | No | Active flag; defaults to `true`. Soft-delete via deactivation. |
| createdAt | DateTime | No | Record creation timestamp. |

## Relationships
### Belongs To
- None

### Has Many
- None (previously had IncomeRecord, now deprecated)

## Indexes & Constraints
- Primary key on `id`
- Unique constraint on `name`

## Usage

`IncomeSource` is used for two purposes:

1. **Category vocabulary dropdown** — When users categorize a CREDIT transaction or create manual income, the UI presents available `IncomeSource.name` values as the category options.

2. **Tax/reporting classification** — Future reports can group income by source (e.g., "Total Salary", "Total Freelance") by matching `Transaction.category` string to `IncomeSource.name`.

Income entries themselves are stored as `Transaction` records with `type='CREDIT'` and `category` set to the source name (or an `IncomeSource` FK if added to Transaction schema in the future).

## Notes

- `IncomeSource` is a **controlled vocabulary**, not an income container.
- Deactivating a source (`isActive = false`) does not affect historical transactions that were categorized with that name.
- This mirrors the `ExpenseCategory` pattern in the Expense domain.
