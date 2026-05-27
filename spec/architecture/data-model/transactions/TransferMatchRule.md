# TransferMatchRule

## Purpose
Defines a user-managed rule for automatically matching likely debit and credit transfer pairs across accounts based on amount, keywords, timing, and optional account scoping.

## Domain
Transactions

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| userId | String | No | Owner user foreign key. |
| name | String | No | Rule name. |
| isActive | Boolean | No | Active flag; defaults to `true`. |
| amountExact | Decimal (`Money`) | Yes | Exact amount to match. |
| amountMin | Decimal (`Money`) | Yes | Minimum amount threshold. |
| amountMax | Decimal (`Money`) | Yes | Maximum amount threshold. |
| debitKeywords | String[] | No | Keywords expected on debit-side descriptions. |
| creditKeywords | String[] | No | Keywords expected on credit-side descriptions. |
| maxDayGap | Int | No | Maximum date gap between sides; default `5`. |
| debitBankAccountId | String | Yes | Optional debit-side account filter. |
| creditBankAccountId | String | Yes | Optional credit-side account filter. |
| confidenceThreshold | Int | No | Minimum confidence score; default `85`. |
| matchCount | Int | No | Number of matches produced; default `0`. |
| lastMatchedAt | DateTime | Yes | Timestamp of the last successful match. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)
- FinancialAccount (`debitBankAccountId` → `FinancialAccount.id`, optional)
- FinancialAccount (`creditBankAccountId` → `FinancialAccount.id`, optional)

### Has Many
- TransferMatchJobResult

## Indexes & Constraints
- Primary key on `id`
- Index on `[userId, isActive]`
- Foreign keys to `User` and optional debit/credit `FinancialAccount` relations

## Notes
This table stores matching heuristics rather than match outcomes. Outcomes are logged in `TransferMatchJobResult`.