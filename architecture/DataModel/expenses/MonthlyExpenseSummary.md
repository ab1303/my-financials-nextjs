# MonthlyExpenseSummary

## Purpose
Stores aggregated monthly spend totals by category, representing summarized expense data rather than individual bank or card transactions.

## Domain
Expenses

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| month | Int | No | Month number from 1 to 12. |
| amount | Decimal (`Money`) | No | Aggregated spend amount for the month/category. |
| categoryId | String | No | Foreign key to the expense category. |
| expenseLedgerId | String | No | Foreign key to the parent expense ledger. |
| importImageId | String | Yes | Optional reference to the imported image/file that produced the summary. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- ExpenseCategory (`categoryId` → `ExpenseCategory.id`)
- ExpenseLedger (`expenseLedgerId` → `ExpenseLedger.id`)
- ImportImage (`importImageId` → `ImportImage.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Index on `[expenseLedgerId, month]`
- Foreign keys to `ExpenseCategory`, `ExpenseLedger`, and `ImportImage`

## Notes
This model captures consolidated spend and should not be treated as a transactional fact table.