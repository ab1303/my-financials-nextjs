# ImportSession

## Purpose
Tracks the lifecycle of a file import operation, including type, processing status, confidence, date range, metadata, and downstream records created.

## Domain
Import/AI

## Status
Active

## Fields
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | String | No | Primary key generated with `cuid()`. |
| userId | String | No | Owner user foreign key. |
| importType | ImportTypeEnum | No | Import mode such as `EXPENSE`, `BANK_ASSET`, or `STOCK`. |
| status | ImportStatusEnum | No | Processing state such as `PENDING`, `PROCESSING`, or `COMPLETED`. |
| overallConfidence | Float | Yes | Overall confidence score for the import. |
| recordsCreated | Int | No | Count of records created; default `0`. |
| metadata | Json | Yes | Additional import metadata payload. |
| startDate | DateTime | Yes | Optional inferred or declared range start date. |
| endDate | DateTime | Yes | Optional inferred or declared range end date. |
| createdAt | DateTime | No | Record creation timestamp. |
| updatedAt | DateTime | No | Auto-updated modification timestamp. |

## Relationships
### Belongs To
- User (`userId` → `User.id`)

### Has Many
- ImportImage
- AIUsageLog
- Transaction
- TransferMatchJobResult

## Indexes & Constraints
- Primary key on `id`
- Index on `[userId, createdAt]`
- Foreign key to `User`

## Notes
This is the orchestration header for all import-related processing and auditing.