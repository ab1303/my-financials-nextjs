# TransferMatchJobResult

## Purpose
Logs the result of a single transfer-matching job run, including how many pairs were auto-linked, flagged for review, or skipped.

## Domain
Transactions

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| userId | String | No | User identifier associated with the job run. |
| importSessionId | String | No | Foreign key to the import session processed. |
| ruleId | String | Yes | Optional foreign key to the rule used. |
| autoLinkedCount | Int | No | Number of pairs auto-linked. |
| flaggedCount | Int | No | Number of candidate pairs flagged for review. |
| skippedCount | Int | No | Number of records skipped. |
| reviewedAt | DateTime | Yes | Timestamp when the result set was reviewed. |
| createdAt | DateTime | No | Job result creation timestamp. |

## Relationships
### Belongs To
- ImportSession (`importSessionId` → `ImportSession.id`)
- TransferMatchRule (`ruleId` → `TransferMatchRule.id`, optional)

### Has Many
- None

## Indexes & Constraints
- Primary key on `id`
- Index on `[userId, importSessionId]`
- Foreign keys to `ImportSession` and optional `TransferMatchRule`

## Notes
`userId` is indexed with `importSessionId` but the provided summary does not describe a formal Prisma relation from this table back to `User`.